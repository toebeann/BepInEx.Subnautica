import fs from 'fs-extra';
import { exit } from 'node:process';
import { Octokit } from 'octokit';
import { RequestError } from '@octokit/request-error';
import { join, relative, resolve } from 'node:path';
import JSZip from 'jszip';
import { clean, coerce, parse, satisfies, valid, Range as SemVerRange } from 'semver';

const BEPINEX = 'BepInEx';
const BEPINEX_REPO = { owner: BEPINEX, repo: BEPINEX };
const PAYLOAD_DIR = 'payload';
const ASSETS_DIR = 'assets';
const METADATA_FILE = '.metadata.json';

type Release = Awaited<ReturnType<typeof octokit.rest.repos.getRelease>>['data'];
type Asset = Release['assets'][0];
type BepInExReleaseType = 'x86' | 'x64' | 'unix';

interface Metadata {
    tag_name?: string,
    version?: string
}

const assetFilter = (asset: Asset, type: BepInExReleaseType) =>
    asset.content_type === 'application/x-zip-compressed' && asset.name.toLowerCase().includes(type.toLowerCase());

const getAsset = (release: Release, type: BepInExReleaseType) => release.assets.find(asset => assetFilter(asset, type));

const getVersion = (release: Release) => {
    const cleaned = clean(release.tag_name, true);
    return (valid(cleaned, true)
        ? parse(cleaned, true)
        : coerce(cleaned, { loose: true }))?.version;
};

const getMetadata = async (): Promise<Metadata> => {
    try {
        return await fs.readJson(METADATA_FILE) as Metadata;
    } catch {
        return {
            version: '0'
        };
    }
};

const createMetadata = (release: Release): Metadata => {
    return {
        tag_name: release.tag_name,
        version: getVersion(release)
    };
};

const writeMetadataToDisk = (metadata: Metadata) => fs.writeJson(METADATA_FILE, metadata);

const getFileNames = async (path: string) => {
    const files: string[] = [];
    const entries = await fs.readdir(resolve(path), { withFileTypes: true });
    for (const entry of entries) {
        const resolved = resolve(path, entry.name);
        if (entry.isDirectory()) {
            files.push(...await getFileNames(resolved));
        } else {
            files.push(resolved);
        }
    }
    return files;
}

const handleAssetError = (error: unknown, type: BepInExReleaseType) => {
    // an error occured while attempting to get the latest release
    if (error instanceof RequestError) {
        const message = error.status === 404
            ? `${type} asset not found`
            : `Could not retrieve ${type} asset`;

        console.error(`${message} for repo: /${BEPINEX_REPO.owner}/${BEPINEX_REPO.repo}`);
        console.error(`${error.status} ${error.message}`);
    } else {
        console.error(`Could not retrieve ${type} asset for repo: /${BEPINEX_REPO.owner}/${BEPINEX_REPO.repo}`);
        console.error(error);
    }
};

const downloadAsset = async (asset: Asset, type: BepInExReleaseType) => {
    console.log(`Downloading ${type} archive...`);

    let response: Awaited<ReturnType<typeof octokit.request>>;
    try {
        const getReleaseAssetStream = octokit.rest.repos.getReleaseAsset.defaults({
            headers: {
                accept: 'application/octet-stream'
            }
        });

        response = (await octokit.request(`${getReleaseAssetStream.endpoint.DEFAULTS.method} ${getReleaseAssetStream.endpoint.DEFAULTS.url}`, {
            ...getReleaseAssetStream.endpoint.DEFAULTS,
            ...BEPINEX_REPO,
            asset_id: asset.id
        }));
    } catch (error) {
        handleAssetError(error, type);
        return;
    }

    if (!(response.data instanceof ArrayBuffer)) {
        console.error(`Invalid data for ${type} asset: ${typeof response.data}`);
        return;
    }

    return response.data;
}

const embedPayload = async (buffer: ArrayBuffer, type: BepInExReleaseType) => {
    console.log(`Embedding payload in ${type} archive...`);

    const zip = await JSZip.loadAsync(buffer); // read the contents of the archive

    // embed payload
    for (const path of await getFileNames(PAYLOAD_DIR)) {
        zip.file(relative(PAYLOAD_DIR, path), await fs.readFile(path));
    }

    return zip;
}

const writeZipToDisk = async (path: string, archive: JSZip, type: BepInExReleaseType) => {
    console.log(`Writing ${type} archive to disk...`);
    const data = await archive.generateInternalStream({ type: 'uint8array' }).accumulate();
    await fs.writeFile(resolve(path), data);
}

const handleAsset = async (release: Release, type: BepInExReleaseType) => {
    const asset = getAsset(release, type);

    if (asset) {
        const buffer = await downloadAsset(asset, type);
        if (buffer) {
            const x64Archive = await embedPayload(buffer, type);
            await fs.ensureDir(ASSETS_DIR);
            await writeZipToDisk(join(ASSETS_DIR, asset.name), x64Archive, type);
        }
    }
}

const octokit = new Octokit();
let latestRelease: Release;
try {
    latestRelease = (await octokit.rest.repos.getLatestRelease(BEPINEX_REPO)).data;
} catch (error) {
    // an error occured while attempting to get the latest release
    if (error instanceof RequestError) {
        const message = error.status === 404
            ? 'No releases were found'
            : 'Could not retrieve releases';

        console.error(`${message} for repo: /${BEPINEX_REPO.owner}/${BEPINEX_REPO.repo}`);
        console.error(`${error.status} ${error.message}`);
    } else {
        console.error(`Could not retrieve releases for repo: /${BEPINEX_REPO.owner}/${BEPINEX_REPO.repo}`);
        console.error(error);
    }
    exit(1);
}

if (!latestRelease) {
    exit(1);
}

const previousMetadata = await getMetadata();
const metadata = createMetadata(latestRelease);

if (metadata.version && satisfies(metadata.version, new SemVerRange(`<= ${previousMetadata.version}`), { loose: true, includePrerelease: true })) {
    // new release is the same or older than our latest, ignore it
    console.log('No new releases since last check.');
    exit(1);
}

// we have a new (or unknown) release, let's handle it
await Promise.all([handleAsset(latestRelease, 'x64'), handleAsset(latestRelease, 'unix')]);
await writeMetadataToDisk(metadata);
