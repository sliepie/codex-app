import crypto from "node:crypto";
import fs from "node:fs";
import extract from "extract-zip";

export type ReleaseAsset = {
  digest?: string | null;
  downloadUrl: string;
  name: string;
  size: number;
};

export type ReleaseInfo = {
  tagName: string;
  name: string;
  url: string;
  assets: ReleaseAsset[];
};

type GithubReleaseAsset = {
  browser_download_url?: string | null;
  digest?: string | null;
  name?: string | null;
  size?: number | null;
};

type GithubRelease = {
  assets?: GithubReleaseAsset[] | null;
  html_url?: string | null;
  name?: string | null;
  tag_name?: string | null;
};

export type AcquiredReleaseAsset = {
  asset: ReleaseAsset;
  checksumSource: string;
  path: string;
  sha256: string;
  size: number;
};

export type ChecksumStrategy =
  | { kind: "digest" }
  | { kind: "sidecar-or-digest"; release: ReleaseInfo; sidecarAssetName: string };

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "sliepie-codex-app-windows-build",
  };
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = "Bearer " + token;
  }

  return headers;
}

function headersForUrl(url: string): Record<string, string> | undefined {
  const hostname = new URL(url).hostname.toLowerCase();
  return hostname === "api.github.com" || hostname === "github.com"
    ? githubHeaders()
    : undefined;
}

export async function downloadFile(url: string, outputPath: string): Promise<void> {
  const response = await fetch(url, { headers: headersForUrl(url) });
  if (!response.ok || !response.body) {
    throw new Error("Failed to download " + url + ": " + response.status + " " + response.statusText);
  }

  fs.writeFileSync(outputPath, Buffer.from(await response.arrayBuffer()));
}

export async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { headers: headersForUrl(url) });
  if (!response.ok) {
    throw new Error("Failed to fetch " + url + ": " + response.status + " " + response.statusText);
  }

  return response.text();
}

export function sha256(filePath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

export function verifySha256(filePath: string, expectedSha: string, label: string): void {
  if (sha256(filePath).toLowerCase() !== expectedSha.toLowerCase()) {
    throw new Error("Checksum mismatch for " + label);
  }
}

export function parseSha256(text: string, label: string): string {
  const match = text.match(/\b[a-fA-F0-9]{64}\b/);
  if (!match?.[0]) {
    throw new Error("Missing SHA-256 checksum for " + label);
  }

  return match[0];
}

function parseAssetDigest(digest: string | null | undefined, label: string): string {
  const match = digest?.match(/^sha256:([a-fA-F0-9]{64})$/);
  if (!match?.[1]) {
    throw new Error("Missing SHA-256 digest for " + label);
  }

  return match[1];
}

function repositoryApiUrl(repository: string, releasePath: string): URL {
  const parts = repository.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error("Invalid GitHub repository value: " + repository);
  }

  return new URL(
    "https://api.github.com/repos/" +
      encodeURIComponent(parts[0]) +
      "/" +
      encodeURIComponent(parts[1]) +
      releasePath,
  );
}

function normalizeReleaseInfo(release: GithubRelease, repository: string): ReleaseInfo {
  if (!release.tag_name) {
    throw new Error("GitHub release for " + repository + " did not include a tag name.");
  }

  return {
    tagName: release.tag_name,
    name: release.name ?? "",
    url: release.html_url ?? "https://github.com/" + repository + "/releases/tag/" + release.tag_name,
    assets: (release.assets ?? []).map((asset) => {
      if (!asset.name || !asset.browser_download_url) {
        throw new Error("GitHub release " + release.tag_name + " has an asset without a name or download URL.");
      }

      return {
        digest: asset.digest,
        downloadUrl: asset.browser_download_url,
        name: asset.name,
        size: asset.size ?? 0,
      };
    }),
  };
}

export async function fetchGitHubRelease(repository: string, tagName?: string): Promise<ReleaseInfo> {
  const releasePath = tagName
    ? "/releases/tags/" + encodeURIComponent(tagName)
    : "/releases/latest";
  const response = await fetch(repositoryApiUrl(repository, releasePath), {
    headers: githubHeaders(),
  });
  if (!response.ok) {
    throw new Error("Failed to fetch GitHub release for " + repository + ": " + response.status + " " + response.statusText);
  }

  return normalizeReleaseInfo((await response.json()) as GithubRelease, repository);
}

export function findReleaseAsset(release: ReleaseInfo, assetName: string, label: string): ReleaseAsset {
  const asset = release.assets.find((candidate) => candidate.name === assetName);
  if (!asset) {
    throw new Error("Missing " + label + " release asset: " + assetName);
  }
  return asset;
}

async function expectedShaForStrategy(asset: ReleaseAsset, strategy: ChecksumStrategy): Promise<{
  checksumSource: string;
  expectedSha: string;
}> {
  if (strategy.kind === "sidecar-or-digest") {
    const checksumAsset = strategy.release.assets.find((candidate) => candidate.name === strategy.sidecarAssetName);
    if (checksumAsset) {
      return {
        checksumSource: checksumAsset.name,
        expectedSha: parseSha256(await fetchText(checksumAsset.downloadUrl), asset.name),
      };
    }
  }

  return {
    checksumSource: "release digest",
    expectedSha: parseAssetDigest(asset.digest, asset.name),
  };
}

export async function ensureCachedReleaseAsset({
  asset,
  cachePath,
  checksum,
  force,
}: {
  asset: ReleaseAsset;
  cachePath: string;
  checksum: ChecksumStrategy;
  force: boolean;
}): Promise<AcquiredReleaseAsset> {
  if (force) {
    fs.rmSync(cachePath, { force: true });
  }
  if (!fs.existsSync(cachePath)) {
    await downloadFile(asset.downloadUrl, cachePath);
  }

  const stat = fs.statSync(cachePath);
  if (asset.size > 0 && stat.size !== asset.size) {
    throw new Error(
      "Downloaded " + asset.name + " size mismatch: expected " + asset.size + ", got " + stat.size + ".",
    );
  }

  const { checksumSource, expectedSha } = await expectedShaForStrategy(asset, checksum);
  verifySha256(cachePath, expectedSha, asset.name);
  return {
    asset,
    checksumSource,
    path: cachePath,
    sha256: sha256(cachePath),
    size: stat.size,
  };
}

export async function ensureExtractedZip({
  archivePath,
  extractRoot,
  force,
}: {
  archivePath: string;
  extractRoot: string;
  force: boolean;
}): Promise<void> {
  if (force) {
    fs.rmSync(extractRoot, { recursive: true, force: true });
  }
  if (!fs.existsSync(extractRoot)) {
    fs.mkdirSync(extractRoot, { recursive: true });
    await extract(archivePath, { dir: extractRoot });
  }
}
