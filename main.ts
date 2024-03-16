import "https://deno.land/std@0.219.1/dotenv/load.ts";
import { ensureDir } from "https://deno.land/std@0.219.1/fs/mod.ts";
import {
  basename,
  dirname,
  relative,
  resolve,
} from "https://deno.land/std@0.219.1/path/mod.ts";
import { getInput } from "npm:@actions/core@^1.10.1";
import { context } from "npm:@actions/github@^5.1.0";
import JSZip from "npm:jszip@^3.10.1";
// @deno-types="npm:@types/lodash.maxby@^4"
import maxBy from "npm:lodash.maxby@^4.6.0";
import { Octokit } from "npm:octokit@^3.1.2";
// @deno-types="npm:@types/parse-github-url@^1"
import gh from "npm:parse-github-url@^1.0.2";
import { simpleGit } from "npm:simple-git@^3.22.0";
// @deno-types="npm:@types/semver@^7"
import {
  clean,
  coerce,
  inc,
  parse,
  Range,
  satisfies,
  valid,
} from "npm:semver@^7.6.0";
import { z } from "npm:zod@^3.22.4";
import payloadJson from "./payload.json" with { type: "json" };

const REPO: Repo = { owner: "toebeann", repo: "bepinex.subnautica" };
const BEPINEX_REPO: Repo = { owner: "BepInEx", repo: "BepInEx" };
const PAYLOAD_DIR = "payload";
const DIST_DIR = "dist";
const DIST_NAME = "Tobey's BepInEx Pack for Subnautica.zip";
const METADATA_FILE = ".metadata.json";
const BEPINEX_RELEASE_TYPES = ["x86", "x64", "unix"];

type Repo = { owner: string; repo: string };

type BepInExReleaseType = typeof BEPINEX_RELEASE_TYPES[number];
type Release = Awaited<
  ReturnType<InstanceType<typeof Octokit>["rest"]["repos"]["getRelease"]>
>["data"];
type Asset = Release["assets"][0];

const metadataSchema = z.object({
  bepinex: z.string().optional().default("0"),
  payload: z.string().optional(),
  sources: z.string().array().optional(),
});
type Metadata = z.infer<typeof metadataSchema>;

const httpErrorSchema = z.object({
  name: z.literal("HttpError"),
  status: z.number(),
  message: z.string(),
}).passthrough();
type HttpError = z.infer<typeof httpErrorSchema>;

const bepinexAssetFilter = (
  asset: Asset,
  type: BepInExReleaseType,
  unityMono?: boolean,
) =>
  asset.name.toLowerCase().includes(type.toLowerCase()) &&
  (!unityMono || asset.name.toLowerCase().includes("unitymono"));

const getBepInExAsset = (release: Release, type: BepInExReleaseType) =>
  release.assets.find((asset) => bepinexAssetFilter(asset, type, true)) ??
    release.assets.find((asset) => bepinexAssetFilter(asset, type));

const getVersion = (version: string) => {
  const cleaned = clean(version, true);
  return valid(cleaned, true) ??
    coerce(cleaned, { loose: true })?.version;
};

const getMetadata = async () => {
  try {
    return metadataSchema.parse(
      (await import(`./${METADATA_FILE}`, { with: { type: "json" } })).default,
    );
  } catch {
    return { bepinex: "0" };
  }
};

const createMetadata = (
  bepinexRelease: Release,
  ...payloadReleases: Release[]
) =>
  ({
    bepinex: getVersion(bepinexRelease.tag_name) ?? "0",
    payload: payloadJson.version,
    sources: [
      bepinexRelease.html_url,
      ...payloadReleases.map((release) => release.html_url),
    ],
  }) satisfies Metadata;

async function* getFilePaths(dir: string): AsyncGenerator<string> {
  for await (const entry of Deno.readDir(dir)) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory) {
      yield* getFilePaths(path);
    } else {
      yield path;
    }
  }
}

const handleReleaseError = (error: unknown, repo: Repo) => {
  // an error occured while attempting to get the latest release
  const parsed = httpErrorSchema.safeParse(error);
  if (parsed.success) {
    const message = parsed.data.status === 404
      ? "No releases were found"
      : "Could not retrieve releases";

    console.error(
      `${message} for repo: /${repo.owner}/${repo.repo}`,
      `${parsed.data.status} ${parsed.data.message}`,
    );
  } else {
    console.error(
      `Could not retrieve releases for repo: /${repo.owner}/${repo.repo}`,
      error,
    );
  }
};

const handleAssetError = (error: unknown, asset: Asset) => {
  // an error occured while attempting to get the latest release
  const parsed = httpErrorSchema.safeParse(error);
  if (parsed.success) {
    const message = parsed.data.status === 404
      ? `Asset ${asset.name} not found`
      : `Could not retrieve asset ${asset.name}`;

    console.error(
      `${message} for repo: /${BEPINEX_REPO.owner}/${BEPINEX_REPO.repo}`,
      `${parsed.data.status} ${parsed.data.message}`,
    );
  } else {
    console.error(
      `Could not retrieve asset ${asset.name} for repo: /${BEPINEX_REPO.owner}/${BEPINEX_REPO.repo}`,
      error,
    );
  }
};

const downloadAsset = async (
  asset: Asset,
  repo: Repo,
  octokit: Octokit = new Octokit(),
) => {
  console.log(`Downloading archive ${asset.name}...`);

  let response: Awaited<ReturnType<typeof octokit.request>>;
  try {
    const getReleaseAssetStream = octokit.rest.repos.getReleaseAsset.defaults({
      headers: {
        accept: "application/octet-stream",
      },
    });

    response = await octokit.request(
      `${getReleaseAssetStream.endpoint.DEFAULTS.method} ${getReleaseAssetStream.endpoint.DEFAULTS.url}`,
      {
        ...getReleaseAssetStream.endpoint.DEFAULTS,
        ...repo,
        asset_id: asset.id,
      },
    );
  } catch (error) {
    handleAssetError(error, asset);
    return;
  }

  if (!(response?.data instanceof ArrayBuffer)) {
    console.error(
      `Invalid data for asset ${asset.name}: ${typeof response.data}`,
    );
    return;
  }

  return response.data;
};

const embedPayload = async (archive: JSZip) => {
  console.log("Embedding payload in archive...");

  for (
    const path of ((await Array.fromAsync(getFilePaths(PAYLOAD_DIR))).sort())
  ) {
    archive.file(relative(PAYLOAD_DIR, path), await Deno.readFile(path));
  }

  return archive;
};

const writeArchiveToDisk = (path: string, archive: JSZip) => {
  console.log(`Writing archive to disk: ${path}`);
  return archive.generateInternalStream({ type: "uint8array" })
    .accumulate()
    .then((data) => Deno.writeFile(resolve(path), data));
};

const getBepInExArchive = async (
  release: Release,
  type: BepInExReleaseType,
  octokit: Octokit = new Octokit(),
) => {
  let asset: ReturnType<typeof getBepInExAsset>;
  try {
    asset = getBepInExAsset(release, type);
    if (!asset) return { asset, type, success: false };

    const assetBuffer = await downloadAsset(asset, BEPINEX_REPO, octokit);
    if (!assetBuffer) return { asset, type, success: false };

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

const getPayloadArchive = async (
  release: Release,
  predicate: (asset: Asset) => boolean,
  octokit: Octokit = new Octokit(),
) => {
  const repo = gh(release.html_url);
  const asset = release.assets.find(predicate);
  if (!repo?.owner || !repo?.name || !asset) {
    return { asset, repo, success: false };
  }

  try {
    const assetBuffer = await downloadAsset(asset, {
      owner: repo.owner,
      repo: repo.name,
    }, octokit);
    if (!assetBuffer) return { asset, repo, success: false };

    return {
      asset,
      success: true,
      archive: await JSZip.loadAsync(assetBuffer),
    };
  } catch {
    return { asset, repo, success: false };
  }
};

const mergeArchives = async (...archives: JSZip[]) => {
  const merged = new JSZip();

  for (const archive of archives) {
    for (const [path, file] of Object.entries(archive.files)) {
      merged.file(path, await file.async("uint8array"));
    }
  }

  return merged;
};

if (import.meta.main) {
  if (!Deno.env.get("GITHUB_PERSONAL_ACCESS_TOKEN")) {
    console.error("GitHub PAT not set.");
    Deno.exit(1);
  }

  const { pusher } = context.payload;
  const gitConfigName = (getInput("git-config-email") ||
    pusher?.name satisfies string | undefined) ??
    Deno.env.get("GITHUB_ACTOR") ??
    "GitHub Workflow Update and Release";
  const gitConfigEmail = (getInput("git-config-email") ||
    pusher?.email satisfies string | undefined) ??
    `${
      Deno.env.get("GITHUB_ACTOR") ?? "github-workflow-update-and-release"
    }@users.noreply.github.com`;

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

  const latestReleaseVersion = latestRelease
    ? getVersion(latestRelease.tag_name)
    : "0.0.0";

  let latestBepInExRelease: Release;
  try {
    latestBepInExRelease =
      (await octokit.rest.repos.getLatestRelease(BEPINEX_REPO)).data;
  } catch (error) {
    handleReleaseError(error, BEPINEX_REPO);
    Deno.exit(1);
  }

  const latestPayloadReleases: Release[] = [];
  for await (const source of payloadJson.sources) {
    const repo = gh(source);
    try {
      if (!repo?.owner || !repo?.name) {
        throw source;
      }

      try {
        latestPayloadReleases.push(
          (await octokit.rest.repos.getLatestRelease({
            owner: repo.owner,
            repo: repo.name,
          })).data,
        );
      } catch (e) {
        const parsed = httpErrorSchema.safeParse(e);
        if (parsed.success && parsed.data.status === 404) {
          // stable release wasn't found, let's also try prereleases

          const release = maxBy(
            (await octokit.rest.repos.listReleases({
              owner: repo.owner,
              repo: repo.name,
            })).data,
            (r) => new Date(r.created_at).valueOf(),
          );

          if (release) {
            latestPayloadReleases.push(release);
          } else {
            throw e;
          }
        } else {
          throw e;
        }
      }
    } catch (error) {
      handleReleaseError(error, {
        owner: repo?.owner ?? JSON.stringify(repo?.owner),
        repo: repo?.name ?? JSON.stringify(repo?.name),
      });
      Deno.exit(1);
    }
  }

  const oldMetadata = await getMetadata();
  const releases = [latestBepInExRelease, ...latestPayloadReleases];
  const metadata = createMetadata(
    latestBepInExRelease,
    ...latestPayloadReleases,
  );

  const updatedSources = oldMetadata.sources?.filter((source) => {
    const latestRelease = releases.find((release) =>
      dirname(release.html_url) === dirname(source)
    );
    if (!latestRelease) {
      // no matching source in latest metadata, so we can't compare versions
      // probably this means there's a new payload source repo, so we should manually version bump and release,
      // but potentially in future we could automate this by incrementing the minor version
      return false;
    }
    const oldVersion = getVersion(basename(source));
    const version = getVersion(latestRelease.tag_name);
    return oldVersion && version &&
      satisfies(version, new Range(`> ${oldVersion}`), {
        loose: true,
        includePrerelease: true,
      });
  });

  if (updatedSources && updatedSources.length > 0) {
    console.log(
      "Updated sources:",
      updatedSources.map((source) => gh(source)?.repository),
    );

    if (
      !updatedSources.every((source) => {
        const parsed = gh(source);
        return parsed?.owner === BEPINEX_REPO.owner &&
          parsed?.name === BEPINEX_REPO.repo;
      }) &&
      payloadJson.version === metadata.payload
    ) {
      // this is an automated update which includes a payload source update, so we should increment the patch version
      metadata.payload =
        payloadJson.version =
          inc(payloadJson.version, "patch") ??
            inc(metadata.payload, "patch") ??
            payloadJson.version;

      await Deno.writeTextFile(
        "payload.json",
        JSON.stringify(payloadJson, null, 2),
      );
    }
  }

  const version = `${metadata.bepinex}-payload.${
    parse(payloadJson.version, true)
  }`;

  console.log(`Latest release version: ${latestReleaseVersion}`);
  console.log(`New version: ${version}`);

  if (
    satisfies(version, new Range(`<= ${latestReleaseVersion}`), {
      loose: true,
      includePrerelease: true,
    })
  ) {
    // both bepinex and our payload have not released an update since last check, so we should cancel
    console.log("No updates since last check.");
    Deno.exit();
  }

  // we have a new release, let's handle it
  const archives = await Promise.all([
    getBepInExArchive(latestBepInExRelease, "x64", octokit),
    ...latestPayloadReleases.map((release) =>
      getPayloadArchive(
        release,
        gh(release.html_url)?.repository?.toLowerCase() ===
            "bepinex/bepinex.melonloader.loader"
          ? (asset) =>
            asset.name.toLowerCase().includes("bepinex5") ||
            asset.name.toLowerCase().startsWith("bepinex.melonloader.loader")
          : (asset) => asset.name === `${gh(release.html_url)?.name}.zip`,
        octokit,
      )
    ),
  ]);

  // check for failures
  const failed = archives.filter((archive) => !archive.success);
  if (failed.length > 0) {
    for (const failure of failed) {
      console.error(`Failed to get archive`, failure.asset);
    }
    Deno.exit(1);
  }

  if (failed.length === archives.length) {
    console.error(
      `No valid assets were found in repo /${BEPINEX_REPO.owner}/${BEPINEX_REPO.repo}`,
    );
    Deno.exit(1);
  }

  const merged = await mergeArchives(
    ...archives.map((result) => result.archive!),
  );
  await Promise.all([
    embedPayload(merged),
    ensureDir(DIST_DIR),
  ]);
  await writeArchiveToDisk(
    resolve(DIST_DIR, DIST_NAME),
    merged,
  );

  if (!Deno.env.get("CI")) {
    Deno.exit();
  }

  // at this point all assets have been successfully downloaded and saved to disk with our payload embedded
  await Deno.writeTextFile(METADATA_FILE, JSON.stringify(metadata));

  const git = simpleGit();
  const status = await git.status();
  const changedFiles = [...status.not_added, ...status.modified];
  const metadataPath = changedFiles.find((file) =>
    file.endsWith(METADATA_FILE)
  );

  if (!metadataPath) {
    console.error("Metadata unchanged!");
    Deno.exit(1);
  }

  await Promise.all([
    git.addConfig(
      "safe.directory",
      Deno.env.get("GITHUB_WORKSPACE") || "",
      false,
      "global",
    ),
    git.addConfig("user.name", gitConfigName),
    git.addConfig("user.email", gitConfigEmail),
    git.addConfig("core.ignorecase", "false"),
  ]);

  console.log("Committing metadata...");
  await git.add(metadataPath);
  const commit = await git.commit(
    "Update metadata",
    [metadataPath, changedFiles.find((file) => file.endsWith("payload.json"))]
      .filter(Boolean),
  );
  await git.push();

  try {
    console.log("Creating release...");
    const release = await octokit.rest.repos.createRelease({
      ...REPO,
      tag_name: `v${version}`,
      target_commitish: commit.commit,
      name: `v${version}`,
      body: `# Payload auto-update

${
        (updatedSources ?? []).map((source) => {
          const parsed = gh(source);
          const release = releases.find((release) =>
            dirname(release.html_url) === dirname(source)
          );
          if (!release || !parsed?.owner || !parsed?.name) return "";

          return `<details>
<summary>Update ${parsed.repository} to ${release.tag_name}</summary>

## [Release notes](${release.html_url})

${release.body ?? "No release notes provided."}

</details>`;
        }).join("\n\n")
      }`,
      generate_release_notes: true,
    });

    console.log("Uploading assets...");
    for await (const asset of getFilePaths(DIST_DIR)) {
      const uploadReleaseAsset = octokit.rest.repos.uploadReleaseAsset.defaults(
        {
          headers: {
            "content-type": latestBepInExRelease.assets.find((a) =>
              a.name === basename(asset)
            )?.content_type ?? "application/x-zip-compressed",
          },
        },
      );

      await octokit.request(
        `${uploadReleaseAsset.endpoint.DEFAULTS.method} ${uploadReleaseAsset.endpoint.DEFAULTS.url}`,
        {
          ...uploadReleaseAsset.endpoint.DEFAULTS,
          ...REPO,
          release_id: release.data.id,
          name: basename(asset),
          data: (await Deno.readFile(asset)),
        },
      );
    }
  } catch (error) {
    console.error("Failed to create release", error);
    Deno.exit(1);
  }
}
