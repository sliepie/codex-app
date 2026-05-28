import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http, { type IncomingMessage } from "node:http";
import https from "node:https";

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

type HttpResponse = {
  body: Buffer;
  statusCode: number;
  statusMessage: string;
};

export type AcquiredReleaseAsset = {
  asset: ReleaseAsset;
  checksumSource: string;
  path: string;
  sha256: string;
  size: number;
};

type ExtractedZipMarker = {
  archiveSha256: string;
  archiveSize: number;
};

export type ChecksumStrategy =
  | { kind: "digest" }
  | { kind: "sidecar-or-digest"; release: ReleaseInfo; sidecarAssetName: string };

function githubHeaders({
  includeToken = true,
}: {
  includeToken?: boolean;
} = {}): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "sliepie-codex-app-windows-build",
  };
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  if (includeToken && token) {
    headers.Authorization = "Bearer " + token;
  }

  return headers;
}

function isPublicGithubUrl(url: string): boolean {
  const hostname = new URL(url).hostname.toLowerCase();
  return hostname === "api.github.com" || hostname === "github.com";
}

function headersForUrl(url: string): Record<string, string> | undefined {
  return isPublicGithubUrl(url) ? githubHeaders() : undefined;
}

function withoutAuthorization(headers: Record<string, string>): Record<string, string> {
  const retryHeaders = { ...headers };
  delete retryHeaders.Authorization;
  return retryHeaders;
}

export async function downloadFile(url: string, outputPath: string): Promise<void> {
  const temporaryOutputPath = outputPath + ".download";
  fs.rmSync(temporaryOutputPath, { force: true });
  try {
    await downloadUrlToFile(url, temporaryOutputPath, headersForUrl(url) ?? {}, 0);
    fs.renameSync(temporaryOutputPath, outputPath);
  } catch (error) {
    fs.rmSync(temporaryOutputPath, { force: true });
    throw error;
  }
}

export async function fetchText(url: string): Promise<string> {
  const response = await readUrl(url, headersForUrl(url) ?? {}, 0);
  assertSuccessResponse(url, response);
  return response.body.toString("utf8");
}

async function readUrl(
  url: string | URL,
  headers: Record<string, string>,
  redirectCount: number,
): Promise<HttpResponse> {
  return requestUrl(url, headers, redirectCount, async (response) => readResponseBody(response));
}

async function downloadUrlToFile(
  url: string | URL,
  outputPath: string,
  headers: Record<string, string>,
  redirectCount: number,
): Promise<void> {
  await requestUrl(url, headers, redirectCount, async (response) => {
    const statusCode = response.statusCode ?? 0;
    if (!isSuccessStatus(statusCode)) {
      const failure = await readResponseBody(response);
      throw new Error("Failed to download " + url.toString() + ": " + failure.statusCode + " " + failure.statusMessage);
    }
    await writeResponseToFile(response, outputPath);
    return {
      body: Buffer.alloc(0),
      statusCode: response.statusCode ?? 0,
      statusMessage: response.statusMessage ?? "",
    };
  });
}

async function requestUrl<T>(
  url: string | URL,
  headers: Record<string, string>,
  redirectCount: number,
  readBody: (response: IncomingMessage) => Promise<T>,
): Promise<T> {
  if (redirectCount > 5) {
    throw new Error("Too many redirects while fetching " + url.toString());
  }

  const parsedUrl = new URL(url);
  const client = parsedUrl.protocol === "http:" ? http : https;
  return await new Promise<T>((resolve, reject) => {
    const request = client.get(parsedUrl, { headers }, async (response) => {
      try {
        const statusCode = response.statusCode ?? 0;
        const locationHeader = response.headers.location;
        const location = Array.isArray(locationHeader) ? locationHeader[0] : locationHeader;
        if (statusCode >= 300 && statusCode < 400 && location) {
          response.resume();
          const nextUrl = new URL(location, parsedUrl);
          const nextHeaders =
            nextUrl.origin === parsedUrl.origin ? headers : withoutAuthorization(headers);
          resolve(await requestUrl(nextUrl, nextHeaders, redirectCount + 1, readBody));
          return;
        }

        if (statusCode === 401 && isPublicGithubUrl(parsedUrl.href) && headers.Authorization) {
          response.resume();
          resolve(await requestUrl(parsedUrl, withoutAuthorization(headers), redirectCount, readBody));
          return;
        }

        resolve(await readBody(response));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function readResponseBody(response: IncomingMessage): Promise<HttpResponse> {
  return new Promise<HttpResponse>((resolve, reject) => {
    const chunks: Buffer[] = [];
    response.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    response.on("end", () => {
      resolve({
        body: Buffer.concat(chunks),
        statusCode: response.statusCode ?? 0,
        statusMessage: response.statusMessage ?? "",
      });
    });
    response.on("error", reject);
  });
}

function writeResponseToFile(response: IncomingMessage, outputPath: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const file = fs.openSync(outputPath, "w");
    let fileClosed = false;
    let writeError: unknown;
    const closeFile = () => {
      if (!fileClosed) {
        fs.closeSync(file);
        fileClosed = true;
      }
    };
    response.on("data", (chunk) => {
      try {
        fs.writeSync(file, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      } catch (error) {
        writeError = error;
        response.destroy(error instanceof Error ? error : new Error(String(error)));
      }
    });
    response.on("end", () => {
      closeFile();
      if (writeError) {
        reject(writeError);
        return;
      }
      resolve();
    });
    response.on("error", (error) => {
      closeFile();
      reject(writeError ?? error);
    });
  });
}

function assertSuccessResponse(url: string, response: HttpResponse): void {
  if (!isSuccessStatus(response.statusCode)) {
    throw new Error("Failed to fetch " + url + ": " + response.statusCode + " " + response.statusMessage);
  }
}

function isSuccessStatus(statusCode: number): boolean {
  return statusCode >= 200 && statusCode < 300;
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
  const url = repositoryApiUrl(repository, releasePath);
  const response = await readUrl(url, githubHeaders(), 0);
  if (!isSuccessStatus(response.statusCode)) {
    throw new Error("Failed to fetch GitHub release for " + repository + ": " + response.statusCode + " " + response.statusMessage);
  }

  return normalizeReleaseInfo(JSON.parse(response.body.toString("utf8")) as GithubRelease, repository);
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

function extractedZipMarkerForArchive(archivePath: string): ExtractedZipMarker {
  return {
    archiveSha256: sha256(archivePath),
    archiveSize: fs.statSync(archivePath).size,
  };
}

function readExtractedZipMarker(markerPath: string): ExtractedZipMarker | undefined {
  try {
    const marker = JSON.parse(fs.readFileSync(markerPath, "utf8")) as Partial<ExtractedZipMarker>;
    if (
      typeof marker.archiveSha256 === "string" &&
      /^[a-fA-F0-9]{64}$/.test(marker.archiveSha256) &&
      typeof marker.archiveSize === "number"
    ) {
      return {
        archiveSha256: marker.archiveSha256.toLowerCase(),
        archiveSize: marker.archiveSize,
      };
    }
  } catch {
    return undefined;
  }

  return undefined;
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
  const completeMarkerPath = extractRoot + ".complete";
  if (force) {
    fs.rmSync(extractRoot, { recursive: true, force: true });
    fs.rmSync(completeMarkerPath, { force: true });
  }
  const expectedMarker = extractedZipMarkerForArchive(archivePath);
  const currentMarker = readExtractedZipMarker(completeMarkerPath);
  if (
    fs.existsSync(extractRoot) &&
    currentMarker?.archiveSha256 === expectedMarker.archiveSha256 &&
    currentMarker.archiveSize === expectedMarker.archiveSize
  ) {
    return;
  }

  fs.rmSync(extractRoot, { recursive: true, force: true });
  fs.rmSync(completeMarkerPath, { force: true });
  const temporaryExtractRoot = extractRoot + ".tmp-" + process.pid + "-" + Date.now();
  fs.rmSync(temporaryExtractRoot, { recursive: true, force: true });
  try {
    fs.mkdirSync(temporaryExtractRoot, { recursive: true });
    execFileSync("tar", ["-xf", archivePath, "-C", temporaryExtractRoot], { stdio: "inherit" });
    fs.renameSync(temporaryExtractRoot, extractRoot);
    fs.writeFileSync(completeMarkerPath, JSON.stringify(expectedMarker, null, 2) + "\n");
  } catch (error) {
    fs.rmSync(temporaryExtractRoot, { recursive: true, force: true });
    fs.rmSync(completeMarkerPath, { force: true });
    throw error;
  }
}
