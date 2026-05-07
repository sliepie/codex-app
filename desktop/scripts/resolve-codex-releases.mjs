import { appendFileSync } from "node:fs";

const appcastUrl =
  process.env.CODEX_APPCAST_URL ??
  "https://persistent.oaistatic.com/codex-app-prod/appcast.xml";
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

function envFlag(name) {
  return ["1", "true", "yes"].includes((process.env[name] ?? "").toLowerCase());
}

function releaseRevisionFromTag(tagName, appVersion) {
  const match = tagName.match(new RegExp(`^codex-app-${escapeRegExp(appVersion)}(?:\\.(0|[1-9]\\d*))?$`));
  if (!match) {
    return undefined;
  }

  return match[1] === undefined ? 0 : Number(match[1]);
}

function resolveRepoReleaseRevision({ appVersion, currentSha, forceNewRevision, releases }) {
  let latestRevision = -1;
  let currentCommitRevision;

  for (const release of releases) {
    const revision = releaseRevisionFromTag(release.tag_name ?? "", appVersion);
    if (revision === undefined) {
      continue;
    }

    latestRevision = Math.max(latestRevision, revision);
    if (
      !forceNewRevision &&
      currentSha &&
      release.target_commitish?.toLowerCase() === currentSha.toLowerCase()
    ) {
      currentCommitRevision = Math.max(currentCommitRevision ?? revision, revision);
    }
  }

  return currentCommitRevision ?? latestRevision + 1;
}

function releaseApiUrl(repository) {
  const [owner, repo] = repository.split("/");
  if (!owner || !repo) {
    fail(`Invalid GITHUB_REPOSITORY value: ${repository}`);
  }

  const url = new URL(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases`,
    githubApiUrl.endsWith("/") ? githubApiUrl : `${githubApiUrl}/`,
  );
  url.searchParams.set("per_page", "100");
  return url;
}

async function fetchExistingReleases() {
  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository) {
    return [];
  }

  const headers = {
    Accept: "application/vnd.github+json",
  };
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(releaseApiUrl(repository), { headers });
  if (!response.ok) {
    fail(`Failed to fetch GitHub releases: ${response.status} ${response.statusText}`);
  }

  return await response.json();
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
const cliTag = "matched-to-app";
const releases = await fetchExistingReleases();
const forceNewRepoRelease = envFlag("CODEX_FORCE_NEW_REPO_RELEASE");
const repoReleaseRevision = resolveRepoReleaseRevision({
  appVersion,
  currentSha: process.env.GITHUB_SHA,
  forceNewRevision: forceNewRepoRelease,
  releases,
});
const releaseVersion = `${appVersion}.${repoReleaseRevision}`;
const releaseTag = `codex-app-${releaseVersion}`;
const buildMarkerKey = `windows-arm64-built-app-${releaseVersion}-build-${buildNumber}`;
const hydrationCacheKey = `windows-arm64-hydrated-v3-app-${appVersion}-build-${buildNumber}-cli-${cliTag}`;

githubOutput("codex_app_version", appVersion);
githubOutput("codex_app_build", buildNumber);
githubOutput("codex_cli_tag", cliTag);
githubOutput("repo_release_revision", repoReleaseRevision);
githubOutput("release_version", releaseVersion);
githubOutput("release_tag", releaseTag);
githubOutput("build_marker_key", buildMarkerKey);
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
      forceNewRepoRelease,
    },
    null,
    2,
  ),
);
