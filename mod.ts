import { ensureDir } from "https://deno.land/std@0.191.0/fs/mod.ts";
import { basename, dirname, join, relative, resolve } from "https://deno.land/std@0.191.0/path/mod.ts";
import { getInput } from "npm:@actions/core";
import { context } from "npm:@actions/github";
import dotenv from "npm:dotenv";
import JSZip from "npm:jszip";
import { Octokit } from "npm:octokit@2.0.15";
import { RequestError } from "npm:@octokit/request-error";
// @deno-types="npm:@types/semver"
import { clean, coerce, parse, satisfies, valid } from "npm:semver";
import { simpleGit } from "npm:simple-git";

dotenv.config();

if (!Deno.env.get("GITHUB_PERSONAL_ACCESS_TOKEN")) {
    console.error("GitHub PAT not set.");
    Deno.exit(1);
}

const PAYLOAD_VERSION = "1.5.0";
const { pusher } = context.payload;
const gitConfigName: string = getInput("git-config-email")
    ? getInput("git-config-email")
    : (pusher?.name
        ? pusher.name
        : (Deno.env.has("GITHUB_ACTOR") ? Deno.env.get("GITHUB_ACTOR") : "GitHub Workflow Update and Release"));
const gitConfigEmail: string = getInput("git-config-email")
    ? getInput("git-config-email")
    : (pusher?.email
        ? pusher.email
        : `${Deno.env.get("GITHUB_ACTOR") ?? "github-workflow-update-and-release"}@users.noreply.github.com`);

const REPO = { owner: "toebeann", repo: "BepInEx.Subnautica" };
const BEPINEX_REPO = { owner: "BepInEx", repo: "BepInEx" };
const PAYLOAD_DIR = "payload";
const DIST_DIR = "dist";
const METADATA_FILE = ".metadata.json";
const BepInExReleaseTypes = ["x86", "x64", "unix"] as const;
const UNITY_VERSION = "2019.4.36";
const includedCorlibs = [
    "netstandard.dll",
    "System.Net.Http.dll",
    "System.Runtime.Serialization.dll",
    "System.Xml.Linq.dll",
];
const corlibsFilter = (corlib: string) => includedCorlibs.includes(corlib);

type BepInExReleaseType = typeof BepInExReleaseTypes[number];
type Release = Awaited<ReturnType<InstanceType<typeof Octokit>["rest"]["repos"]["getRelease"]>>["data"];
type Asset = Release["assets"][number];

interface Metadata {
    version?: string;
    source?: string;
    payloadVersion?: string;
}

const assetFilter = (asset: Asset, type: BepInExReleaseType, unityMono: boolean) =>
    asset.name.toLowerCase().includes(type.toLowerCase()) &&
    (!unityMono || asset.name.toLowerCase().includes("unitymono"));

const getAsset = (release: Release, type: BepInExReleaseType) =>
    release.assets.find((asset) => assetFilter(asset, type, true)) ??
        release.assets.find((asset) => assetFilter(asset, type, false));

const getVersion = (release: Release) => {
    const cleaned = clean(release.tag_name, true);
    const validated = valid(cleaned, true);

    return validated ? validated : coerce(cleaned, { loose: true })?.version;
};

const getMetadata = async (): Promise<Metadata> => {
    try {
        return JSON.parse(await Deno.readTextFile(METADATA_FILE)) as Metadata;
    } catch {
        return {
            version: "0",
        };
    }
};

const createMetadata = (release: Release): Metadata => {
    return {
        version: getVersion(release),
        source: release.html_url,
        payloadVersion: Deno.env.get("payload_version"),
    };
};

const writeMetadataToDisk = (metadata: Metadata) => Deno.writeTextFile(METADATA_FILE, JSON.stringify(metadata));

const getFileNames = async (path: string) => {
    const files: string[] = [];
    try {
        const entries = Deno.readDir(resolve(path));
        for await (const entry of entries) {
            const resolved = resolve(path, entry.name);
            if (entry.isDirectory) {
                files.push(...await getFileNames(resolved));
            } else {
                files.push(resolved);
            }
        }
    } catch { /* */ }
    return files;
};

const isRequestError = (error: unknown): error is RequestError =>
    error instanceof Error &&
    error.name === "HttpError" &&
    "status" in error &&
    typeof error.status === "number";

const handleReleaseError = (error: unknown, repo: { owner: string; repo: string }) => {
    // an error occured while attempting to get the latest release
    if (isRequestError(error)) {
        const message = error.status === 404 ? "No releases were found" : "Could not retrieve releases";

        console.error(
            `${message} for repo: /${repo.owner}/${repo.repo}`,
            `${error.status} ${error.message}`,
        );
    } else {
        console.error(
            `Could not retrieve releases for repo: /${repo.owner}/${repo.repo}`,
            error,
        );
    }
};

const handleAssetError = (error: unknown, type: BepInExReleaseType) => {
    // an error occured while attempting to get the asset from the release
    if (isRequestError(error)) {
        const message = error.status === 404 ? `${type} asset not found` : `Could not retrieve ${type} asset`;

        console.error(
            `${message} for repo: /${BEPINEX_REPO.owner}/${BEPINEX_REPO.repo}`,
            `${error.status} ${error.message}`,
        );
    } else {
        console.error(
            `Could not retrieve ${type} asset for repo: /${BEPINEX_REPO.owner}/${BEPINEX_REPO.repo}`,
            error,
        );
    }
};

const downloadAsset = async (asset: Asset, type: BepInExReleaseType) => {
    console.log(`Downloading ${type} archive...`);

    const response = await fetch(asset.browser_download_url);

    if (!response.ok) {
        handleAssetError(`${response.status} ${response.statusText}`, type);
    }

    try {
        return await response.arrayBuffer();
    } catch {
        handleAssetError(
            `Invalid data for ${type} asset: ${typeof response.body}`,
            type,
        );
    }
};

const downloadCorlibs = async (unityVersion: string) => {
    console.log(`Downloading core libraries for Unity version: ${unityVersion}...`);

    try {
        const response = await fetch(
            `https://unity.bepinex.dev/corlibs/${unityVersion}.zip`,
        );

        if (!response.ok) {
            console.error(
                `Could not retrieve corlibs for Unity version: ${unityVersion}`,
                response.status,
                response.statusText,
                response.url,
            );
            return;
        }

        return response.arrayBuffer();
    } catch (error) {
        console.error(
            `Could not retrieve corlibs for Unity version: ${unityVersion}`,
            error,
        );
    }
};

const embedPayload = async (archive: JSZip) => {
    console.log(`Embedding payload in archive...`);

    // embed payload
    for (const path of (await getFileNames(PAYLOAD_DIR)).sort()) {
        const base = basename(path);
        const typeFilters = base
            .split(".")
            .slice(1)
            .filter((ext) => BepInExReleaseTypes.includes(ext as BepInExReleaseType));

        const dir = dirname(path);
        const file = base
            .split(".")
            .filter((ext) => !typeFilters.includes(ext))
            .join(".");
        const relativePath = relative(PAYLOAD_DIR, join(dir, file));
        archive.file(relativePath, await Deno.readTextFile(path));
    }

    return archive;
};

const embedCorlibs = async (archive: JSZip, buffer: ArrayBuffer) => {
    console.log(`Embedding corlibs in archive...`);

    const corlibs = await JSZip.loadAsync(buffer);
    for (const path of Object.keys(corlibs.files).filter(corlibsFilter)) {
        archive.file(
            join("corlibs", path),
            await corlibs.file(path)!.async("uint8array"),
        );
    }

    return archive;
};

const writeZipToDisk = async (path: string, archive: JSZip) => {
    console.log(`Writing archive to disk...`);
    const data = await archive.generateInternalStream({ type: "uint8array" })
        .accumulate();
    await Deno.writeFile(resolve(path), data);
};

const getAssetArchive = async (release: Release, type: BepInExReleaseType) => {
    let asset: ReturnType<typeof getAsset>;
    try {
        asset = getAsset(release, type);
        if (!asset) {
            return { asset, type, success: false };
        }

        const assetBuffer = await downloadAsset(asset, type);
        if (!assetBuffer) {
            return { asset, type, success: false };
        }

        return {
            asset,
            type,
            success: true,
            archive: await JSZip.loadAsync(assetBuffer),
        };
    } catch {
        return { asset, type, success: false };
    }
};

const mergeArchives = async (...archives: JSZip[]) => {
    const merged = new JSZip();

    await Promise.all(archives.map(async (archive) => {
        for (const [path, file] of Object.entries(archive.files)) {
            merged.file(path, await file.async("uint8array"));
        }
    }));

    return merged;
};

const octokit = new Octokit({
    auth: Deno.env.get("GITHUB_PERSONAL_ACCESS_TOKEN"),
});

console.log("Getting latest release...");
let latestRelease: Release | undefined;
try {
    latestRelease = (await octokit.rest.repos.getLatestRelease(REPO)).data;
} catch (error) {
    handleReleaseError(error, REPO);
}

const latestReleaseVersion = latestRelease ? getVersion(latestRelease) : "0.0.0";

let latestBepInExRelease: Release;
try {
    latestBepInExRelease = (await octokit.rest.repos.getLatestRelease(BEPINEX_REPO)).data;
} catch (error) {
    handleReleaseError(error, BEPINEX_REPO);
    Deno.exit(1);
}

if (!Deno.env.has("payload_version")) {
    Deno.env.set("payload_version", PAYLOAD_VERSION);
    if (!Deno.env.get("payload_version")) {
        console.error("Could not get current payload version!");
        Deno.exit(1);
    }
}

const previousMetadata = await getMetadata();
const metadata = createMetadata(latestBepInExRelease);

const version = `${metadata.version}-payload.${parse(Deno.env.get("payload_version"), true)}`;

console.log(`Latest release: ${latestReleaseVersion}`);
console.log(`New version: ${version}`);

if (
    metadata.version &&
    satisfies(metadata.version, `<= ${previousMetadata.version}`, {
        loose: true,
        includePrerelease: true,
    }) && // check bepinex release
    satisfies(version, `<= ${latestReleaseVersion}`, {
        loose: true,
        includePrerelease: true,
    })
) { // check internal version
    // both bepinex and this package have not released an update since last check, so we should cancel
    console.log("No updates since last check.");
    Deno.exit();
}

// we have a new (or unknown) release, let's handle it
const corlibsBuffer = await downloadCorlibs(UNITY_VERSION);
if (!corlibsBuffer) Deno.exit(1);

const archives = await Promise.all([
    getAssetArchive(latestBepInExRelease, "x64"),
    getAssetArchive(latestBepInExRelease, "unix"),
]);

const failed = archives.filter((result) => !result.success);
if (failed.length > 0) {
    for (const failure of failed) {
        console.error(`Failed to get ${failure.type} archive`, failure.asset);
    }
    console.error(`Encountered errors getting assets from repo /${BEPINEX_REPO.owner}/${BEPINEX_REPO.repo}`);
    Deno.exit(1);
}

if (archives.every((result) => !result.success)) {
    console.error(`No valid assets were found in repo /${BEPINEX_REPO.owner}/${BEPINEX_REPO.repo}`);
    Deno.exit(1);
}

const merged = await mergeArchives(
    ...archives.map((result) => result.archive!),
);
await Promise.all([
    embedCorlibs(merged, corlibsBuffer),
    embedPayload(merged),
    ensureDir(DIST_DIR),
]);
await writeZipToDisk(join(DIST_DIR, "BepInEx.zip"), merged);

if (Deno.env.get("MODE") === "dev") {
    Deno.exit();
}

// at this point all assets have been successfully downloaded, merged and saved to disk with embedded payloads
await writeMetadataToDisk(metadata); // update metadata

const git = simpleGit();
const status = await git.status();
const changedFiles = [...status.not_added, ...status.modified];
const metadataPath = changedFiles.find((file) => file.endsWith(METADATA_FILE));

if (!metadataPath) {
    console.error("Metadata unchanged!");
    Deno.exit(1);
}

await git.addConfig(
    "safe.directory",
    Deno.env.get("GITHUB_WORKSPACE") || "",
    false,
    "global",
);
await git.addConfig("user.name", gitConfigName);
await git.addConfig("user.email", gitConfigEmail);
await git.addConfig("core.ignorecase", "false");

console.log("Committing metadata...");
await git.add(".metadata.json");
const commit = await git.commit("Updating metadata", [metadataPath]);
await git.push();

try {
    console.log("Creating release...");
    const release = await octokit.rest.repos.createRelease({
        ...REPO,
        tag_name: `v${version}`,
        target_commitish: commit.commit,
        name: latestBepInExRelease.name ?? `BepInEx ${metadata.version}`,
        body: latestBepInExRelease.body ?? undefined,
        generate_release_notes: true,
    });

    console.log("Uploading release assets...");
    const assets = await getFileNames(DIST_DIR);
    for await (const asset of assets) {
        await octokit.rest.repos.uploadReleaseAsset({
            ...REPO,
            release_id: release.data.id,
            name: basename(asset),
            data: await Deno.readTextFile(asset),
            headers: {
                "content-type": latestBepInExRelease.assets.find((a) => a.name === basename(asset))?.content_type ??
                    "application/x-zip-compressed",
            },
        });
    }
} catch (error) {
    console.error(error);
    Deno.exit(1);
}
