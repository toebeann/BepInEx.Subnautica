import { readFile, writeFile } from "node:fs/promises";
import { EOL } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { env, exit } from "node:process";
import { Glob, inspect } from "bun";
import { getInput } from "@actions/core";
import { context } from "@actions/github";
import { ensureDir } from "fs-extra";
import JSZip from "jszip";
import maxBy from "lodash.maxby";
import { Octokit } from "octokit";
import gh from "parse-github-url";
import { simpleGit } from "simple-git";
import { coerce, inc, parse, Range, satisfies } from "semver";
import { z } from "zod";
import payloadJson from "./payload.json" with { type: "json" };

const repoSchema = z.object({
  owner: z.string(),
  name: z.string().optional(),
  repo: z.string(),
  repository: z.string().optional(),
})
  .transform((obj) => ({ ...obj, repo: obj.name ?? obj.repo }));
type Repo = z.infer<typeof repoSchema>;

const unitySchema = z.object({
  version: z.string(),
  corlibs: z.string().array().optional(),
  libraries: z.string().array().optional(),
});

const platformSchema = z.union([
  z.literal("linux_x64"),
  z.literal("linux_x86"),
  z.literal("macos_x64"),
  z.literal("win_x64"),
  z.literal("win_x86"),
]);
type Platform = z.infer<typeof platformSchema>;
const platformsSchema = z.array(platformSchema);

const REPO = repoSchema.parse(gh(payloadJson.repo));
const BEPINEX_REPO = repoSchema.parse(gh(payloadJson.bepinex));
const PAYLOAD_DIR = "payload";
const DIST_DIR = "dist";
const METADATA_FILE = ".metadata.json";
const BEPINEX_PLATFORMS = platformsSchema.parse(payloadJson.platforms);
const UNITY = "unity" in payloadJson &&
  Object.freeze(unitySchema.parse(payloadJson.unity));

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

const bepinexAssetFilter = (
  asset: Asset,
  platform: Platform,
  unityMono?: boolean,
) =>
  asset.name.toLowerCase().includes(platform.toLowerCase()) &&
  (!unityMono || asset.name.toLowerCase().includes("unitymono"));

const getBepInExAsset = (release: Release, platform: Platform) =>
  release.assets.find((asset) => bepinexAssetFilter(asset, platform, true)) ??
    release.assets.find((asset) => bepinexAssetFilter(asset, platform));

const getVersion = (version: string) =>
  coerce(version, { loose: true, includePrerelease: true })?.version;

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
  const glob = new Glob("**/*");
  for await (
    const entry of glob.scan({
      cwd: dir,
      onlyFiles: true,
    })
  ) {
    yield resolve(dir, entry);
  }
}

const handleReleaseError = (error: unknown, { owner, repo }: Repo) => {
  // an error occured while attempting to get the latest release
  const parsed = httpErrorSchema.safeParse(error);
  if (parsed.success) {
    const message = parsed.data.status === 404
      ? "No releases were found"
      : "Could not retrieve releases";

    return [
      `${message} for repo: /${owner}/${repo}`,
      parsed.data.status,
      parsed.data.message,
    ].join(" ");
  } else {
    return [
      `Could not retrieve releases for repo: /${owner}/${repo}`,
      inspect(error, { colors: true }),
    ].join(EOL);
  }
};

const handleAssetError = (error: unknown, { name }: Asset) => {
  // an error occured while attempting to get the latest release
  const parsed = httpErrorSchema.safeParse(error);
  if (parsed.success) {
    const message = parsed.data.status === 404
      ? `Asset ${name} not found`
      : `Could not retrieve asset ${name}`;

    console.error(
      `${message} for repo: /${BEPINEX_REPO.owner}/${BEPINEX_REPO.repo}`,
      parsed.data.status,
      parsed.data.message,
    );
  } else {
    console.error(
      `Could not retrieve asset ${name} for repo: /${BEPINEX_REPO.owner}/${BEPINEX_REPO.repo}`,
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

const downloadData = async (url: string) => {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.error(
        `Could not retrieve asset from URL: ${url}`,
        response.status,
        response.statusText,
        response.url,
      );
      return;
    }

    return response.arrayBuffer();
  } catch (error) {
    console.error(`Could not retrieve asset from URL: ${url}`, error);
  }
};

const embedPayload = async (archive: JSZip) => {
  console.log("Embedding payload in archive...");

  for (
    const path of ((await Array.fromAsync(getFilePaths(PAYLOAD_DIR))).sort())
  ) {
    archive.file(relative(PAYLOAD_DIR, path), await readFile(path));
  }

  return archive;
};

const embedData = async (
  archive: JSZip,
  buffer: ArrayBuffer,
  predicate?: (filename: string) => boolean,
) => {
  const dataArchive = await JSZip.loadAsync(buffer);
  for (
    const path of predicate
      ? Object.keys(dataArchive.files).filter(predicate)
      : Object.keys(dataArchive.files)
  ) {
    archive.file(
      join("corlibs", path),
      await dataArchive.file(path)!.async("uint8array"),
    );
  }
  return archive;
};

const writeArchiveToDisk = (path: string, archive: JSZip) => {
  console.log(`Writing archive to disk: ${path}`);
  return archive.generateInternalStream({ type: "uint8array" })
    .accumulate()
    .then((data) => writeFile(resolve(path), data));
};

const getBepInExArchive = async (
  release: Release,
  platform: Platform,
  octokit: Octokit = new Octokit(),
) => {
  let asset: ReturnType<typeof getBepInExAsset>;
  try {
    asset = getBepInExAsset(release, platform);
    if (!asset) return { asset, platform, success: false };

    const assetBuffer = await downloadAsset(asset, BEPINEX_REPO, octokit);
    if (!assetBuffer) return { asset, platform, success: false };

    return {
      asset,
      platform,
      success: true,
      archive: await JSZip.loadAsync(assetBuffer),
    };
  } catch {
    return { asset, platform, success: false };
  }
};

const getPayloadArchive = async (
  release: Release,
  predicate: (asset: Asset) => boolean,
  octokit: Octokit = new Octokit(),
) => {
  const asset = release.assets.find(predicate);
  const parsed = repoSchema.safeParse(gh(release.html_url));
  if (!asset || !parsed.success) return { asset, repo: parsed, success: false };
  const repo = parsed.data;

  try {
    const assetBuffer = await downloadAsset(asset, repo, octokit);
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
  const { GITHUB_PERSONAL_ACCESS_TOKEN, CI, GITHUB_ACTOR } = env;

  if (!GITHUB_PERSONAL_ACCESS_TOKEN && CI) {
    throw ("GitHub PAT not set.");
  }

  const { pusher } = context.payload;
  const gitConfigName = (getInput("git-config-email") ||
    pusher?.name satisfies string | undefined) ??
    GITHUB_ACTOR ??
    "GitHub Workflow Update and Release";
  const gitConfigEmail = (getInput("git-config-email") ||
    pusher?.email satisfies string | undefined) ??
    `${
      GITHUB_ACTOR ?? "github-workflow-update-and-release"
    }@users.noreply.github.com`;

  const octokit = new Octokit({
    auth: GITHUB_PERSONAL_ACCESS_TOKEN,
  });

  console.log("Getting latest release...");
  let latestRelease: Release | undefined;
  try {
    latestRelease = (await octokit.rest.repos.getLatestRelease(REPO)).data;
  } catch (error) {
    throw handleReleaseError(error, REPO);
  }

  const latestReleaseVersion = latestRelease
    ? getVersion(latestRelease.tag_name)
    : "0.0.0";

  let latestBepInExRelease: Release;
  try {
    latestBepInExRelease =
      (await octokit.rest.repos.getLatestRelease(BEPINEX_REPO)).data;
  } catch (error) {
    throw handleReleaseError(error, BEPINEX_REPO);
  }

  const latestPayloadReleases: Release[] = [];
  for await (const source of payloadJson.sources) {
    let repo: Repo | undefined;
    try {
      repo = repoSchema.parse(gh(source));

      try {
        latestPayloadReleases.push(
          (await octokit.rest.repos.getLatestRelease(repo)).data,
        );
      } catch (e) {
        const parsed = httpErrorSchema.safeParse(e);
        if (parsed.success && parsed.data.status === 404) {
          // stable release wasn't found, let's also try prereleases

          const release = maxBy(
            (await octokit.rest.repos.listReleases(repo)).data,
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
      throw handleReleaseError(error, {
        owner: repo?.owner ?? JSON.stringify(repo?.owner),
        repo: repo?.name ?? JSON.stringify(repo?.name),
      });
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

    const { owner, repo } = BEPINEX_REPO;
    if (
      !updatedSources.every((source) => {
        const parsed = repoSchema.safeParse(gh(source));
        return parsed.success &&
          parsed.data.owner.toLowerCase() === owner.toLowerCase() &&
          parsed.data.repo.toLowerCase() === repo.toLowerCase();
      }) &&
      payloadJson.version === metadata.payload
    ) {
      // this is an automated update which includes a payload source update, so we should increment the patch version
      metadata.payload =
        payloadJson.version =
          inc(payloadJson.version, "patch") ??
            inc(metadata.payload, "patch") ??
            payloadJson.version;

      await writeFile(
        "payload.json",
        JSON.stringify(payloadJson, null, 2),
        "utf8",
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
    exit();
  }

  // we have a new release, let's handle it
  const archives = await Promise.all([
    ...BEPINEX_PLATFORMS.map((platform) =>
      getBepInExArchive(latestBepInExRelease, platform, octokit)
    ),
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
    exit(1);
  }

  if (failed.length === archives.length) {
    throw `No valid assets were found in repo /${BEPINEX_REPO.owner}/${BEPINEX_REPO.repo}`;
  }

  const merged = await mergeArchives(
    ...archives.map((result) => result.archive!),
  );
  await Promise.all([
    embedPayload(merged),
    UNITY && UNITY.corlibs
      ? (async () => {
        console.log(
          `Downloading corlibs for Unity version: ${UNITY.version}...`,
        );

        const corlibs = await downloadData(
          `https://unity.bepinex.dev/corlibs/${UNITY.version}.zip`,
        );

        if (!corlibs) {
          throw `Failed to download corlibs for Unity version: ${UNITY.version}`;
        }

        console.log(`Embedding corlibs: ${UNITY.version}...`);
        return embedData(
          merged,
          corlibs,
          UNITY.corlibs!.length === 0
            ? undefined
            : (filename) => UNITY.corlibs!.includes(filename),
        );
      })()
      : Promise.resolve(),
    UNITY && UNITY.libraries
      ? (async () => {
        console.log(
          `Downloading Unity libraries for version: ${UNITY.version}...`,
        );
        const libraries = await downloadData(
          `https://unity.bepinex.dev/libraries/${UNITY.version}.zip`,
        );

        if (!libraries) {
          throw `Failed to download Unity libraries for version: ${UNITY.version}`;
        }
        console.log(`Embedding Unity libraries: ${UNITY.version}...`);
        return embedData(
          merged,
          libraries,
          UNITY.libraries!.length === 0
            ? undefined
            : (filename) => UNITY.libraries!.includes(filename),
        );
      })
      : Promise.resolve(),
    ensureDir(DIST_DIR),
  ]);
  await writeArchiveToDisk(
    resolve(DIST_DIR, `${payloadJson.name}.zip`),
    merged,
  );

  if (!CI) exit();

  // at this point all assets have been successfully downloaded and saved to disk with our payload embedded
  await writeFile(METADATA_FILE, JSON.stringify(metadata), "utf8");

  const git = simpleGit();
  const status = await git.status();
  const changedFiles = [...status.not_added, ...status.modified];
  const metadataPath = changedFiles.find((file) =>
    file.endsWith(METADATA_FILE)
  );

  if (!metadataPath) {
    throw "Metadata unchanged!";
  }

  const { GITHUB_WORKSPACE } = env;

  await Promise.all([
    git.addConfig(
      "safe.directory",
      GITHUB_WORKSPACE || "",
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

${
            release.body?.split("\n").map((s) => `> ${s.trimEnd()}`).join(
              "\n",
            ) ?? "No release notes provided."
          }

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
          data: await readFile(asset),
        },
      );
    }
  } catch (error) {
    throw [
      "Failed to create release",
      inspect(error, { colors: true }),
    ]
      .join(EOL);
  }
}
