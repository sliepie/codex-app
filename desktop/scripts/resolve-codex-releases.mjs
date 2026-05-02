import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";

const appcastUrl =
  process.env.CODEX_APPCAST_URL ??
  "https://persistent.oaistatic.com/codex-app-prod/appcast.xml";
const codexCliRepo = process.env.CODEX_CLI_REPO ?? "openai/codex";

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

const cliReleaseJson = execFileSync(
  "gh",
  ["release", "view", "--repo", codexCliRepo, "--json", "tagName"],
  { encoding: "utf8" },
);
const cliRelease = JSON.parse(cliReleaseJson);
if (!cliRelease.tagName) {
  fail("The selected Codex CLI release does not have a tag name.");
}

const cliTag = cliRelease.tagName;
const releaseTag = `codex-app-${appVersion}`;
const buildMarkerKey = `windows-arm64-built-app-${appVersion}-build-${buildNumber}`;
const hydrationCacheKey = `windows-arm64-hydrated-app-${appVersion}-build-${buildNumber}-cli-${cliTag}`;

githubOutput("codex_app_version", appVersion);
githubOutput("codex_app_build", buildNumber);
githubOutput("codex_cli_tag", cliTag);
githubOutput("release_tag", releaseTag);
githubOutput("build_marker_key", buildMarkerKey);
githubOutput("hydration_cache_key", hydrationCacheKey);

console.log(
  JSON.stringify(
    {
      codexAppVersion: appVersion,
      codexAppBuild: buildNumber,
      codexCliTag: cliTag,
      releaseTag,
    },
    null,
    2,
  ),
);
