import crypto from "node:crypto";
import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";

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

const defaultProdAppcastUrl = "https://persistent.oaistatic.com/codex-app-prod/appcast.xml";
const defaultBetaAppcastUrl = "https://persistent.oaistatic.com/codex-app-beta/appcast.xml";
const prodAppcastUrl =
  process.env.CODEX_APPCAST_URL ??
  defaultProdAppcastUrl;
const betaAppcastUrl = betaAppcastUrlFromProdUrl(prodAppcastUrl);
const codexCliRepository = process.env.CODEX_CLI_REPOSITORY ?? "openai/codex";
const codexPlusPlusRepository = process.env.CODEX_PLUS_PLUS_REPOSITORY ?? "b-nnett/codex-plusplus";
const githubApiUrl = process.env.GITHUB_API_URL ?? "https://api.github.com";
const appVersionPattern = /^\d+\.\d+\.\d+$/;
const buildNumberPattern = /^\d+$/;
const releaseTagPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const shaPattern = /^[0-9a-f]{40}$/i;

type GithubRelease = {
  body?: string | null;
  tag_name?: string | null;
  target_commitish?: string | null;
};

type GithubGitRef = {
  object?: {
    sha?: string | null;
    type?: string | null;
    url?: string | null;
  } | null;
};

type GithubGitTag = {
  object?: {
    sha?: string | null;
    type?: string | null;
  } | null;
};

type ReleaseInputs = {
  appBuildNumber: string;
  appVersion: string;
  codexCliTag: string;
  codexPlusPlusSha: string;
  codexPlusPlusTag: string;
};

type AppcastFeedName = "prod" | "beta";

type AppcastRelease = {
  buildNumber: string;
  feedName: AppcastFeedName;
  feedUrl: string;
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

function betaAppcastUrlFromProdUrl(prodUrl: string): string {
  try {
    const betaUrl = new URL(prodUrl);
    if (betaUrl.pathname.includes("/codex-app-prod/")) {
      // The beta appcast is the official sibling of the prod appcast.
      betaUrl.pathname = betaUrl.pathname.replace("/codex-app-prod/", "/codex-app-beta/");
      return betaUrl.toString();
    }
  } catch {
    return defaultBetaAppcastUrl;
  }

  return defaultBetaAppcastUrl;
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
  { appBuildNumber, appVersion, codexCliTag, codexPlusPlusSha, codexPlusPlusTag }: ReleaseInputs,
): boolean {
  const body = release.body ?? "";
  return (
    body.includes(releaseMetadataLine("Codex app", `${appVersion} build ${appBuildNumber}`)) &&
    body.includes(releaseMetadataLine("Codex CLI", codexCliTag)) &&
    body.includes(releaseMetadataLine("Codex++", codexPlusPlusTag)) &&
    body.includes(releaseMetadataLine("Codex++ commit", codexPlusPlusSha))
  );
}

function resolveRepoReleaseRevision({
  appVersion,
  appBuildNumber,
  currentSha,
  releases,
  codexCliTag,
  codexPlusPlusSha,
  codexPlusPlusTag,
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
        codexPlusPlusSha,
        codexPlusPlusTag,
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

function releaseApiUrl(repository: string): URL {
  const url = repositoryApiUrl(repository, "/releases");
  url.searchParams.set("per_page", "100");
  return url;
}

function githubHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function fetchExistingReleases(): Promise<GithubRelease[]> {
  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository) {
    return [];
  }

  const response = await fetch(releaseApiUrl(repository), { headers: githubHeaders() });
  if (!response.ok) {
    fail(`Failed to fetch GitHub releases: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as GithubRelease[];
}

async function fetchLatestReleaseTag(repository: string, label: string): Promise<string> {
  const response = await fetch(repositoryApiUrl(repository, "/releases/latest"), {
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

async function fetchAppcastRelease(feedName: AppcastFeedName, feedUrl: string): Promise<AppcastRelease> {
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

  return { buildNumber, feedName, feedUrl, version };
}

function chooseLatestAppcastRelease(prod: AppcastRelease, beta: AppcastRelease): AppcastRelease {
  const prodBuild = parsePositiveInteger("prod Codex app build number", prod.buildNumber);
  const betaBuild = parsePositiveInteger("beta Codex app build number", beta.buildNumber);
  if (betaBuild > prodBuild) {
    return beta;
  }

  return prod;
}

async function fetchGitTagCommitSha(repository: string, tagName: string, label: string): Promise<string> {
  const response = await fetch(repositoryApiUrl(repository, `/git/ref/tags/${encodeURIComponent(tagName)}`), {
    headers: githubHeaders(),
  });
  if (!response.ok) {
    fail(`Failed to resolve ${label} tag ${tagName}: ${response.status} ${response.statusText}`);
  }

  const ref = (await response.json()) as GithubGitRef;
  const object = ref.object;
  const sha = object?.sha ?? "";
  if (!sha) {
    fail(`${label} tag ${tagName} did not include an object SHA.`);
  }

  if (object?.type !== "tag") {
    return sha;
  }

  const tagResponse = await fetch(object.url ?? repositoryApiUrl(repository, `/git/tags/${sha}`), {
    headers: githubHeaders(),
  });
  if (!tagResponse.ok) {
    fail(`Failed to dereference ${label} tag ${tagName}: ${tagResponse.status} ${tagResponse.statusText}`);
  }

  const tag = (await tagResponse.json()) as GithubGitTag;
  const commitSha = tag.object?.sha ?? "";
  if (!commitSha || tag.object?.type !== "commit") {
    fail(`${label} tag ${tagName} does not point to a commit.`);
  }

  return commitSha;
}

async function main(): Promise<void> {
  const selectedAppcastRelease = chooseLatestAppcastRelease(
    await fetchAppcastRelease("prod", prodAppcastUrl),
    await fetchAppcastRelease("beta", betaAppcastUrl),
  );
  const appVersion = selectedAppcastRelease.version;
  const buildNumber = selectedAppcastRelease.buildNumber;
  const cliTag = assertMatches(
    "Codex CLI tag",
    await fetchLatestReleaseTag(codexCliRepository, "Codex CLI"),
    releaseTagPattern,
  );
  const codexPlusPlusTag = assertMatches(
    "Codex++ tag",
    await fetchLatestReleaseTag(codexPlusPlusRepository, "Codex++"),
    releaseTagPattern,
  );
  const codexPlusPlusSha = assertMatches(
    "Codex++ commit SHA",
    await fetchGitTagCommitSha(
      codexPlusPlusRepository,
      codexPlusPlusTag,
      "Codex++",
    ),
    shaPattern,
  ).toLowerCase();
  const releases = await fetchExistingReleases();
  const { currentCommitReleaseTag, repoReleaseRevision } = resolveRepoReleaseRevision({
    appVersion,
    appBuildNumber: buildNumber,
    currentSha: process.env.GITHUB_SHA,
    releases,
    codexCliTag: cliTag,
    codexPlusPlusSha,
    codexPlusPlusTag,
  });
  const releaseVersion = `${appVersion}.${repoReleaseRevision}`;
  const releaseTag = `codex-app-${releaseVersion}`;
  const hydrationCacheKey = `windows-arm64-hydrated-v5-app-${appVersion}-build-${buildNumber}-cli-${cliTag}-codex-plusplus-${codexPlusPlusTag}-${codexPlusPlusSha}`;
  const nativeModulesCacheInputHash = hashCacheInputs([
    "package-lock.json",
    "scripts/hydrate-codex-app.ts",
    "scripts/patch-better-sqlite3-electron.ts",
  ]);
  const nativeModulesCacheKey = `windows-arm64-native-modules-v1-app-${appVersion}-build-${buildNumber}-cli-${cliTag}-codex-plusplus-${codexPlusPlusTag}-${codexPlusPlusSha}-inputs-${nativeModulesCacheInputHash}`;

  githubOutput("codex_app_version", appVersion);
  githubOutput("codex_app_build", buildNumber);
  githubOutput("codex_appcast_feed", selectedAppcastRelease.feedName);
  githubOutput("codex_appcast_url", selectedAppcastRelease.feedUrl);
  githubOutput("codex_cli_tag", cliTag);
  githubOutput("codex_plus_plus_tag", codexPlusPlusTag);
  githubOutput("codex_plus_plus_sha", codexPlusPlusSha);
  githubOutput("repo_release_revision", repoReleaseRevision);
  githubOutput("release_version", releaseVersion);
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
        codexAppcastUrl: selectedAppcastRelease.feedUrl,
        codexCliTag: cliTag,
        codexPlusPlusTag,
        codexPlusPlusSha,
        repoReleaseRevision,
        releaseVersion,
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
