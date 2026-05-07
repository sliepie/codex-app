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

function commitShaShort() {
  return firstMatch(
    process.env.GITHUB_SHA ?? "",
    /^([0-9a-f]{7})/i,
    "GITHUB_SHA must start with at least seven hexadecimal characters.",
  ).toLowerCase();
}

function findRepoReleaseTagForAppVersion({ appVersion, releases }) {
  for (const release of releases) {
    const tagName = release.tag_name ?? "";
    if (tagName.match(new RegExp(`^codex-app-${escapeRegExp(appVersion)}\\.([0-9]+|[0-9a-f]{7,40})$`, "i"))) {
      return tagName;
    }
  }

  return "";
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
const repoAppReleaseTag = findRepoReleaseTagForAppVersion({
  appVersion,
  releases,
});
const releaseVersion = `${appVersion}.0`;
const releaseTag = `codex-app-${appVersion}.${commitShaShort()}`;
const hydrationCacheKey = `windows-arm64-hydrated-v3-app-${appVersion}-build-${buildNumber}-cli-${cliTag}`;

githubOutput("codex_app_version", appVersion);
githubOutput("codex_app_build", buildNumber);
githubOutput("codex_cli_tag", cliTag);
githubOutput("release_version", releaseVersion);
githubOutput("release_tag", releaseTag);
githubOutput("repo_app_release_tag", repoAppReleaseTag);
githubOutput("hydration_cache_key", hydrationCacheKey);

console.log(
  JSON.stringify(
    {
      codexAppVersion: appVersion,
      codexAppBuild: buildNumber,
      codexCliTag: cliTag,
      releaseVersion,
      releaseTag,
      repoAppReleaseTag,
    },
    null,
    2,
  ),
);
