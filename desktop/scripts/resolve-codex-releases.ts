import crypto from "node:crypto";
import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { codexAppcastUrlForFeed, type CodexAppcastFeed } from "./codex-appcast-feeds.ts";
import {
  windowsArm64HydratedCacheInputPaths,
  windowsArm64HydratedCacheKeyVersion,
  windowsArm64NativeModuleCacheInputPaths,
  windowsArm64NativeModulesCacheKeyVersion,
} from "./windows-arm64-package-plan.ts";

function scriptDirectory(): string {
  return typeof __dirname === "string" ? __dirname : path.dirname(path.resolve(process.argv[1] ?? "."));
}

function resolveDesktopRoot(): string {
  const directory = scriptDirectory();
  return path.basename(directory) === "scripts" && path.basename(path.dirname(directory)) === ".cache"
    ? path.resolve(directory, "..", "..")
    : path.resolve(directory, "..");
}

const desktopRoot = resolveDesktopRoot();

const codexCliRepository = process.env.CODEX_CLI_REPOSITORY ?? "openai/codex";
const githubApiUrl = process.env.GITHUB_API_URL ?? "https://api.github.com";
const appVersionPattern = /^\d+\.\d+\.\d+$/;
const buildNumberPattern = /^\d+$/;
const releaseTagPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const maxMsixVersionSegment = 65535;

type GithubRelease = {
  body?: string | null;
  tag_name?: string | null;
  target_commitish?: string | null;
};

type ReleaseInputs = {
  appBuildNumber: string;
  appVersion: string;
  codexCliTag: string;
};

type AppcastRelease = {
  buildNumber: string;
  feedName: CodexAppcastFeed;
  version: string;
};

type ResolveRepoReleaseRevisionOptions = ReleaseInputs & {
  appVersion: string;
  currentSha?: string;
  releases: GithubRelease[];
};

function fail(message: string): never {
  throw new Error(message);
}

function firstMatch(text: string, pattern: RegExp, message: string): string {
  const match = text.match(pattern);
  if (!match?.[1]) {
    fail(message);
  }
  return match[1].trim();
}

function assertMatches(label: string, value: string, pattern: RegExp): string {
  if (!pattern.test(value)) {
    fail(`${label} has an unexpected format: ${JSON.stringify(value)}`);
  }

  return value;
}

function parsePositiveInteger(label: string, value: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    fail(`${label} has an unexpected numeric value: ${JSON.stringify(value)}`);
  }

  return parsed;
}

function parseMsixVersionSegment(label: string, value: number | string): number {
  const parsed = typeof value === "number" ? value : parsePositiveInteger(label, value);
  if (parsed > maxMsixVersionSegment) {
    fail(`${label} must be between 0 and ${maxMsixVersionSegment} for MSIX package versions: ${JSON.stringify(value)}`);
  }

  return parsed;
}

function msixPackageVersionForRelease(
  appVersion: string,
  appBuildNumber: string,
  repoReleaseRevision: number,
): string {
  const [appMajor = "", appMinor = ""] = appVersion.split(".");

  return [
    parseMsixVersionSegment("Codex app major version", appMajor),
    parseMsixVersionSegment("Codex app minor version", appMinor),
    parseMsixVersionSegment("Codex app build number", appBuildNumber),
    parseMsixVersionSegment("repo release revision", repoReleaseRevision),
  ].join(".");
}

function githubOutput(name: string, value: number | string): void {
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
  }
}

function hashCacheInputs(paths: string[]): string {
  const hash = crypto.createHash("sha256");
  for (const inputPath of paths) {
    hash.update(inputPath);
    hash.update("\0");
    hash.update(readFileSync(path.resolve(desktopRoot, inputPath)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function repositoryApiUrl(repository: string, path: string): URL {
  const parts = repository.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    fail(`Invalid GitHub repository value: ${repository}`);
  }

  return new URL(
    `/repos/${encodeURIComponent(parts[0])}/${encodeURIComponent(parts[1])}${path}`,
    githubApiUrl.endsWith("/") ? githubApiUrl : `${githubApiUrl}/`,
  );
}

function releaseRevisionFromTag(tagName: string, appVersion: string): number | undefined {
  const numericMatch = tagName.match(new RegExp(`^codex-app-${escapeRegExp(appVersion)}\\.(0|[1-9]\\d*)$`, "i"));
  if (numericMatch) {
    return Number(numericMatch[1]);
  }

  if (tagName.match(new RegExp(`^codex-app-${escapeRegExp(appVersion)}(?:\\.[0-9a-f]{7,40})?$`, "i"))) {
    return 0;
  }

  return undefined;
}

function releaseMetadataLine(label: string, value: string): string {
  return `${label}: ${value}`;
}

function releaseTracksInputs(
  release: GithubRelease,
  { appBuildNumber, appVersion, codexCliTag }: ReleaseInputs,
): boolean {
  const body = release.body ?? "";
  return (
    body.includes(releaseMetadataLine("Codex app", `${appVersion} build ${appBuildNumber}`)) &&
    body.includes(releaseMetadataLine("Codex CLI", codexCliTag))
  );
}

function resolveRepoReleaseRevision({
  appVersion,
  appBuildNumber,
  currentSha,
  releases,
  codexCliTag,
}: ResolveRepoReleaseRevisionOptions): { currentCommitReleaseTag: string; repoReleaseRevision: number } {
  let latestRevision = -1;
  let currentCommitRevision: number | undefined;
  let currentCommitReleaseTag = "";

  for (const release of releases) {
    const tagName = release.tag_name ?? "";
    const revision = releaseRevisionFromTag(tagName, appVersion);
    if (revision === undefined) {
      continue;
    }

    latestRevision = Math.max(latestRevision, revision);
    if (
      currentSha &&
      release.target_commitish?.toLowerCase() === currentSha.toLowerCase() &&
      releaseTracksInputs(release, {
        appBuildNumber,
        appVersion,
        codexCliTag,
      })
    ) {
      if (currentCommitRevision === undefined || revision > currentCommitRevision) {
        currentCommitRevision = revision;
        currentCommitReleaseTag = tagName;
      }
    }
  }

  return {
    currentCommitReleaseTag,
    repoReleaseRevision: currentCommitRevision ?? latestRevision + 1,
  };
}

function releaseApiUrl(repository: string, page: number): URL {
  const url = repositoryApiUrl(repository, "/releases");
  url.searchParams.set("per_page", "100");
  url.searchParams.set("page", String(page));
  return url;
}

function githubHeaders({
  includeToken = true,
}: {
  includeToken?: boolean;
} = {}): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  if (includeToken && token) {
    headers.Authorization = "Bearer " + token;
  }

  return headers;
}

function withoutAuthorization(headers: HeadersInit): HeadersInit {
  if (headers instanceof Headers) {
    const retryHeaders = new Headers(headers);
    retryHeaders.delete("Authorization");
    return retryHeaders;
  }
  if (Array.isArray(headers)) {
    return headers.filter(([name]) => name.toLowerCase() !== "authorization");
  }

  const retryHeaders = { ...headers };
  delete retryHeaders.Authorization;
  return retryHeaders;
}

function hasAuthorization(headers: HeadersInit | undefined): boolean {
  if (!headers) {
    return false;
  }
  if (headers instanceof Headers) {
    return headers.has("Authorization");
  }
  if (Array.isArray(headers)) {
    return headers.some(([name]) => name.toLowerCase() === "authorization");
  }

  return headers.Authorization !== undefined;
}

async function fetchPublicGithubUrl(url: string | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(url, init);
  const headers = init?.headers;
  if (!shouldRetryPublicGithubWithoutAuthorization(response.status, headers)) {
    return response;
  }

  return fetch(url, {
    ...init,
    headers: withoutAuthorization(headers as HeadersInit),
  });
}

function shouldRetryPublicGithubWithoutAuthorization(
  statusCode: number,
  headers: HeadersInit | undefined,
): boolean {
  return (statusCode === 401 || statusCode === 404) && hasAuthorization(headers);
}

async function fetchExistingReleases(): Promise<GithubRelease[]> {
  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository) {
    return [];
  }

  const releases: GithubRelease[] = [];
  for (let page = 1; ; page += 1) {
    const response = await fetch(releaseApiUrl(repository, page), { headers: githubHeaders() });
    if (!response.ok) {
      fail("Failed to fetch GitHub releases: " + response.status + " " + response.statusText);
    }

    const pageReleases = (await response.json()) as GithubRelease[];
    releases.push(...pageReleases);
    if (pageReleases.length < 100) {
      return releases;
    }
  }
}

async function fetchLatestReleaseTag(repository: string, label: string): Promise<string> {
  const response = await fetchPublicGithubUrl(repositoryApiUrl(repository, "/releases/latest"), {
    headers: githubHeaders(),
  });
  if (!response.ok) {
    fail(`Failed to fetch ${label} release: ${response.status} ${response.statusText}`);
  }

  const release = (await response.json()) as GithubRelease;
  const tagName = release.tag_name ?? "";
  if (!tagName) {
    fail(`The latest ${label} release does not have a tag.`);
  }

  return tagName;
}

async function fetchAppcastRelease(feedName: CodexAppcastFeed): Promise<AppcastRelease> {
  const feedUrl = codexAppcastUrlForFeed(feedName);
  const response = await fetch(feedUrl);
  if (!response.ok) {
    fail(`Failed to fetch ${feedName} Codex appcast: ${response.status} ${response.statusText}`);
  }

  const appcast = await response.text();
  const item = firstMatch(
    appcast,
    /(<item\b[\s\S]*?<\/item>)/i,
    `No Codex app release was found in the ${feedName} appcast.`,
  );
  const version = assertMatches(
    `${feedName} Codex app version`,
    firstMatch(
      item,
      /<sparkle:shortVersionString>([^<]+)<\/sparkle:shortVersionString>/i,
      `The selected ${feedName} Codex app release does not have a version.`,
    ),
    appVersionPattern,
  );
  const buildNumber = assertMatches(
    `${feedName} Codex app build number`,
    firstMatch(
      item,
      /<sparkle:version>([^<]+)<\/sparkle:version>/i,
      `The selected ${feedName} Codex app release does not have a build number.`,
    ),
    buildNumberPattern,
  );

  return { buildNumber, feedName, version };
}

async function main(): Promise<void> {
  const selectedAppcastRelease = await fetchAppcastRelease("prod");
  const appVersion = selectedAppcastRelease.version;
  const buildNumber = selectedAppcastRelease.buildNumber;
  const cliTag = assertMatches(
    "Codex CLI tag",
    await fetchLatestReleaseTag(codexCliRepository, "Codex CLI"),
    releaseTagPattern,
  );
  const releases = await fetchExistingReleases();
  const { currentCommitReleaseTag, repoReleaseRevision } = resolveRepoReleaseRevision({
    appVersion,
    appBuildNumber: buildNumber,
    currentSha: process.env.GITHUB_SHA,
    releases,
    codexCliTag: cliTag,
  });
  const releaseVersion = `${appVersion}.${repoReleaseRevision}`;
  const msixPackageVersion = msixPackageVersionForRelease(
    appVersion,
    buildNumber,
    repoReleaseRevision,
  );
  const releaseTag = currentCommitReleaseTag || `codex-app-${releaseVersion}`;
  const hydrationCacheInputHash = hashCacheInputs([...windowsArm64HydratedCacheInputPaths]);
  const hydrationCacheKey = `windows-arm64-hydrated-${windowsArm64HydratedCacheKeyVersion}-app-${appVersion}-build-${buildNumber}-cli-${cliTag}-inputs-${hydrationCacheInputHash}`;
  const nativeModulesCacheInputHash = hashCacheInputs([...windowsArm64NativeModuleCacheInputPaths]);
  const nativeModulesCacheKey = `windows-arm64-native-modules-${windowsArm64NativeModulesCacheKeyVersion}-app-${appVersion}-build-${buildNumber}-cli-${cliTag}-inputs-${nativeModulesCacheInputHash}`;

  githubOutput("codex_app_version", appVersion);
  githubOutput("codex_app_build", buildNumber);
  githubOutput("codex_appcast_feed", selectedAppcastRelease.feedName);
  githubOutput("codex_cli_tag", cliTag);
  githubOutput("repo_release_revision", repoReleaseRevision);
  githubOutput("release_version", releaseVersion);
  githubOutput("msix_package_version", msixPackageVersion);
  githubOutput("release_tag", releaseTag);
  githubOutput("current_commit_release_tag", currentCommitReleaseTag);
  githubOutput("hydration_cache_key", hydrationCacheKey);
  githubOutput("native_modules_cache_key", nativeModulesCacheKey);

  console.log(
    JSON.stringify(
      {
        codexAppVersion: appVersion,
        codexAppBuild: buildNumber,
        codexAppcastFeed: selectedAppcastRelease.feedName,
        codexCliTag: cliTag,
        repoReleaseRevision,
        releaseVersion,
        msixPackageVersion,
        releaseTag,
        currentCommitReleaseTag,
        nativeModulesCacheKey,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
