import { appendFileSync } from "node:fs";

const appcastUrl =
  process.env.CODEX_APPCAST_URL ??
  "https://persistent.oaistatic.com/codex-app-prod/appcast.xml";
const codexCliRepository = process.env.CODEX_CLI_REPOSITORY ?? "openai/codex";
const githubApiUrl = process.env.GITHUB_API_URL ?? "https://api.github.com";

function fail(message) {
  throw new Error(message);
}

function firstMatch(text, pattern, message) {
  const match = text.match(pattern);
  if (!match?.[1]) {
    fail(message);
  }
  return match[1].trim();
}

function githubOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function repositoryApiUrl(repository, path) {
  const [owner, repo] = repository.split("/");
  if (!owner || !repo) {
    fail(`Invalid GitHub repository value: ${repository}`);
  }

  return new URL(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}${path}`,
    githubApiUrl.endsWith("/") ? githubApiUrl : `${githubApiUrl}/`,
  );
}

function releaseRevisionFromTag(tagName, appVersion) {
  const numericMatch = tagName.match(new RegExp(`^codex-app-${escapeRegExp(appVersion)}\\.(0|[1-9]\\d*)$`, "i"));
  if (numericMatch) {
    return Number(numericMatch[1]);
  }

  if (tagName.match(new RegExp(`^codex-app-${escapeRegExp(appVersion)}(?:\\.[0-9a-f]{7,40})?$`, "i"))) {
    return 0;
  }

  return undefined;
}

function resolveRepoReleaseRevision({ appVersion, currentSha, releases }) {
  let latestRevision = -1;
  let currentCommitRevision;
  let currentCommitReleaseTag = "";

  for (const release of releases) {
    const tagName = release.tag_name ?? "";
    const revision = releaseRevisionFromTag(tagName, appVersion);
    if (revision === undefined) {
      continue;
    }

    latestRevision = Math.max(latestRevision, revision);
    if (currentSha && release.target_commitish?.toLowerCase() === currentSha.toLowerCase()) {
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

function releaseApiUrl(repository) {
  const url = repositoryApiUrl(repository, "/releases");
  url.searchParams.set("per_page", "100");
  return url;
}

function githubHeaders() {
  const headers = {
    Accept: "application/vnd.github+json",
  };
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function fetchExistingReleases() {
  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository) {
    return [];
  }

  const response = await fetch(releaseApiUrl(repository), { headers: githubHeaders() });
  if (!response.ok) {
    fail(`Failed to fetch GitHub releases: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

async function fetchLatestCodexCliTag() {
  const response = await fetch(repositoryApiUrl(codexCliRepository, "/releases/latest"), {
    headers: githubHeaders(),
  });
  if (!response.ok) {
    fail(`Failed to fetch Codex CLI release: ${response.status} ${response.statusText}`);
  }

  const release = await response.json();
  const tagName = release.tag_name ?? "";
  if (!tagName) {
    fail("The latest Codex CLI release does not have a tag.");
  }

  return tagName;
}

const response = await fetch(appcastUrl);
if (!response.ok) {
  fail(`Failed to fetch Codex appcast: ${response.status} ${response.statusText}`);
}

const appcast = await response.text();
const item = firstMatch(
  appcast,
  /(<item\b[\s\S]*?<\/item>)/i,
  "No Codex app release was found in the appcast.",
);
const appVersion = firstMatch(
  item,
  /<sparkle:shortVersionString>([^<]+)<\/sparkle:shortVersionString>/i,
  "The selected Codex app release does not have a version.",
);
const buildNumber =
  item.match(/<sparkle:version>([^<]+)<\/sparkle:version>/i)?.[1]?.trim() ?? "";
const cliTag = await fetchLatestCodexCliTag();
const releases = await fetchExistingReleases();
const { currentCommitReleaseTag, repoReleaseRevision } = resolveRepoReleaseRevision({
  appVersion,
  currentSha: process.env.GITHUB_SHA,
  releases,
});
const releaseVersion = `${appVersion}.${repoReleaseRevision}`;
const releaseTag = `codex-app-${releaseVersion}`;
const hydrationCacheKey = `windows-arm64-hydrated-v3-app-${appVersion}-build-${buildNumber}-cli-${cliTag}`;

githubOutput("codex_app_version", appVersion);
githubOutput("codex_app_build", buildNumber);
githubOutput("codex_cli_tag", cliTag);
githubOutput("repo_release_revision", repoReleaseRevision);
githubOutput("release_version", releaseVersion);
githubOutput("release_tag", releaseTag);
githubOutput("current_commit_release_tag", currentCommitReleaseTag);
githubOutput("hydration_cache_key", hydrationCacheKey);

console.log(
  JSON.stringify(
    {
      codexAppVersion: appVersion,
      codexAppBuild: buildNumber,
      codexCliTag: cliTag,
      repoReleaseRevision,
      releaseVersion,
      releaseTag,
      currentCommitReleaseTag,
    },
    null,
    2,
  ),
);
