import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import http from "node:http";
import test from "node:test";
import assert from "node:assert/strict";

const desktopRoot = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(import.meta.url);
const {
  windowsArm64HydratedCacheInputPaths,
  windowsArm64HydratedCacheKeyVersion,
  windowsArm64NativeModuleCacheInputPaths,
  windowsArm64NativeModulesCacheKeyVersion,
} = require("../.cache/scripts/windows-arm64-package-plan.js");
const scriptPath = fileURLToPath(new URL("../.cache/scripts/resolve-codex-releases.js", import.meta.url));
const typescriptScriptPath = fileURLToPath(new URL("resolve-codex-releases.ts", import.meta.url));
const officialProdAppcastUrl = "https://persistent.oaistatic.com/codex-app-prod/appcast.xml";
const officialBetaAppcastUrl = "https://persistent.oaistatic.com/codex-app-beta/appcast.xml";

const appcast = `<?xml version="1.0" encoding="utf-8"?>
<rss>
  <channel>
    <item>
      <sparkle:shortVersionString>26.429.61741</sparkle:shortVersionString>
      <sparkle:version>2429</sparkle:version>
    </item>
  </channel>
</rss>`;

function appcastFor(version, buildNumber) {
  return `<?xml version="1.0" encoding="utf-8"?>
<rss>
  <channel>
    <item>
      <sparkle:shortVersionString>${version}</sparkle:shortVersionString>
      <sparkle:version>${buildNumber}</sparkle:version>
    </item>
  </channel>
</rss>`;
}

function releaseInputsBody({
  appBuildNumber = "2429",
  appVersion = "26.429.61741",
  codexCliTag = "rust-v0.129.0",
  codexPlusPlusSha = "7c3e1f6d2b4a9c8e7f6d5c4b3a29181716151413",
  codexPlusPlusTag = "v0.1.7",
} = {}) {
  return [
    "Codex app: " + appVersion + " build " + appBuildNumber,
    "Codex CLI: " + codexCliTag,
    "Codex++: " + codexPlusPlusTag,
    "Codex++ commit: " + codexPlusPlusSha,
  ].join("\\n");
}

function startServer(
  releases,
  {
    appcastSource = appcast,
    betaAppcastSource = appcast,
    betaAppcastStatus = 200,
    codexCliTag = "rust-v0.129.0",
    codexPlusPlusObjectType = "commit",
    codexPlusPlusRepo = "b-nnett/codex-plusplus",
    rejectAuthorizedCodexPlusPlusRequests = false,
    releasePages = [releases],
    codexPlusPlusSha = "7c3e1f6d2b4a9c8e7f6d5c4b3a29181716151413",
    codexPlusPlusTag = "v0.1.7",
  } = {},
) {
  const server = http.createServer((request, response) => {
    const requestPath = request.url?.split("?")[0];
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    if (requestPath === "/codex-app-prod/appcast.xml") {
      response.writeHead(200, { "Content-Type": "application/xml" });
      response.end(appcastSource);
      return;
    }

    if (requestPath === "/codex-app-beta/appcast.xml") {
      response.writeHead(betaAppcastStatus, { "Content-Type": "application/xml" });
      response.end(betaAppcastSource);
      return;
    }

    if (requestUrl.pathname === "/repos/sliepie/codex-app/releases") {
      const page = Number.parseInt(requestUrl.searchParams.get("page") ?? "1", 10);
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify(releasePages[page - 1] ?? []));
      return;
    }

    if (request.url === "/repos/openai/codex/releases/latest") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ tag_name: codexCliTag }));
      return;
    }

    if (
      rejectAuthorizedCodexPlusPlusRequests &&
      requestPath?.startsWith("/repos/" + codexPlusPlusRepo + "/") &&
      request.headers.authorization
    ) {
      response.writeHead(401, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ message: "Bad credentials" }));
      return;
    }

    if (request.url === `/repos/${codexPlusPlusRepo}/releases/latest`) {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ tag_name: codexPlusPlusTag }));
      return;
    }

    if (request.url === `/repos/${codexPlusPlusRepo}/git/ref/tags/${codexPlusPlusTag}`) {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          object: {
            sha: codexPlusPlusSha,
            type: codexPlusPlusObjectType,
          },
        }),
      );
      return;
    }

    response.writeHead(404);
    response.end();
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        origin: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((closeResolve) => server.close(closeResolve)),
      });
    });
  });
}

async function hashCacheInputs(paths) {
  const hash = crypto.createHash("sha256");
  for (const inputPath of paths) {
    hash.update(inputPath);
    hash.update("\0");
    hash.update(await readFile(path.resolve(desktopRoot, inputPath)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

async function expectedHydrationCacheKey({
  appBuildNumber = "2429",
  appVersion = "26.429.61741",
  codexCliTag = "rust-v0.129.0",
  codexPlusPlusSha = "7c3e1f6d2b4a9c8e7f6d5c4b3a29181716151413",
  codexPlusPlusTag = "v0.1.7",
} = {}) {
  return (
    `windows-arm64-hydrated-${windowsArm64HydratedCacheKeyVersion}-app-${appVersion}-build-${appBuildNumber}-cli-${codexCliTag}-codex-plusplus-${codexPlusPlusTag}-${codexPlusPlusSha}-inputs-` +
    await hashCacheInputs([...windowsArm64HydratedCacheInputPaths])
  );
}

async function expectedNativeModulesCacheKey({
  appBuildNumber = "2429",
  appVersion = "26.429.61741",
  codexCliTag = "rust-v0.129.0",
  codexPlusPlusSha = "7c3e1f6d2b4a9c8e7f6d5c4b3a29181716151413",
  codexPlusPlusTag = "v0.1.7",
} = {}) {
  return (
    `windows-arm64-native-modules-${windowsArm64NativeModulesCacheKeyVersion}-app-${appVersion}-build-${appBuildNumber}-cli-${codexCliTag}-codex-plusplus-${codexPlusPlusTag}-${codexPlusPlusSha}-inputs-` +
    await hashCacheInputs([...windowsArm64NativeModuleCacheInputPaths])
  );
}

async function runResolver({
  releases,
  appcastSource,
  betaAppcastSource,
  betaAppcastStatus,
  codexCliTag,
  codexPlusPlusObjectType,
  codexPlusPlusRepo = "b-nnett/codex-plusplus",
  rejectAuthorizedCodexPlusPlusRequests,
  releasePages,
  codexPlusPlusSha,
  codexPlusPlusTag,
  sha = "abcdef1234567890",
  scriptArgs = [scriptPath],
}) {
  const server = await startServer(releases, {
    appcastSource,
    betaAppcastSource,
    betaAppcastStatus,
    codexCliTag,
    codexPlusPlusObjectType,
    codexPlusPlusRepo,
    rejectAuthorizedCodexPlusPlusRequests,
    releasePages,
    codexPlusPlusSha,
    codexPlusPlusTag,
  });
  const directory = await mkdtemp(path.join(tmpdir(), "codex-release-resolver-"));
  const outputPath = path.join(directory, "github-output.txt");
  const fetchShimPath = path.join(directory, "mock-appcast-fetch.mjs");
  await writeFile(
    fetchShimPath,
    `const originalFetch = globalThis.fetch;\n` +
      `const origin = process.env.CODEX_APPCAST_TEST_ORIGIN;\n` +
      `globalThis.fetch = (input, init) => {\n` +
      `  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;\n` +
      `  if (url === ${JSON.stringify(officialProdAppcastUrl)}) return originalFetch(origin + "/codex-app-prod/appcast.xml", init);\n` +
      `  if (url === ${JSON.stringify(officialBetaAppcastUrl)}) return originalFetch(origin + "/codex-app-beta/appcast.xml", init);\n` +
      `  return originalFetch(input, init);\n` +
      `};\n`,
    "utf8",
  );

  try {
    await new Promise((resolve, reject) => {
      execFile(
        process.execPath,
        scriptArgs,
        {
          env: {
            ...process.env,
            CODEX_APPCAST_TEST_ORIGIN: server.origin,
            CODEX_PLUS_PLUS_REPOSITORY: codexPlusPlusRepo,
            GH_TOKEN: "test-token",
            GITHUB_API_URL: server.origin,
            GITHUB_OUTPUT: outputPath,
            GITHUB_REPOSITORY: "sliepie/codex-app",
            GITHUB_SHA: sha,
            NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --import ${pathToFileURL(fetchShimPath).href}`.trim(),
          },
        },
        (error, stdout, stderr) => {
          if (error) {
            error.message += `\nstdout:\n${stdout}\nstderr:\n${stderr}`;
            reject(error);
            return;
          }
          resolve();
        },
      );
    });

    const output = await readFile(outputPath, "utf8");
    return Object.fromEntries(
      output
        .trim()
        .split("\n")
        .map((line) => {
          const separatorIndex = line.indexOf("=");
          return [line.slice(0, separatorIndex), line.slice(separatorIndex + 1)];
        }),
    );
  } finally {
    await server.close();
    await rm(directory, { recursive: true, force: true });
  }
}

test("starts new Codex app releases at repo revision zero", async () => {
  const output = await runResolver({ releases: [] });

  assert.equal(output.release_version, "26.429.61741.0");
  assert.equal(output.codex_cli_tag, "rust-v0.129.0");
  assert.equal(output.codex_plus_plus_tag, "v0.1.7");
  assert.equal(output.codex_plus_plus_sha, "7c3e1f6d2b4a9c8e7f6d5c4b3a29181716151413");
  assert.equal(output.repo_release_revision, "0");
  assert.equal(output.release_tag, "codex-app-26.429.61741.0");
  assert.equal(output.current_commit_release_tag, "");
  assert.equal(output.codex_appcast_feed, "prod");
  assert.equal(output.codex_appcast_url, undefined);
  assert.equal(
    output.hydration_cache_key,
    await expectedHydrationCacheKey(),
  );
  assert.equal(
    output.native_modules_cache_key,
    await expectedNativeModulesCacheKey(),
  );
});

test("selects the beta appcast when it has a higher Sparkle build", async () => {
  const output = await runResolver({
    releases: [],
    appcastSource: appcastFor("26.513.31313", "2867"),
    betaAppcastSource: appcastFor("26.513.40821", "2903"),
  });

  assert.equal(output.codex_app_version, "26.513.40821");
  assert.equal(output.codex_app_build, "2903");
  assert.equal(output.codex_appcast_feed, "beta");
  assert.equal(output.codex_appcast_url, undefined);
  assert.equal(
    output.hydration_cache_key,
    await expectedHydrationCacheKey({ appBuildNumber: "2903", appVersion: "26.513.40821" }),
  );
  assert.doesNotMatch(output.hydration_cache_key, /beta|prod/);
});

test("keeps prod when prod and beta have the same Sparkle build", async () => {
  const output = await runResolver({
    releases: [],
    appcastSource: appcastFor("26.513.31313", "2903"),
    betaAppcastSource: appcastFor("26.513.40821", "2903"),
  });

  assert.equal(output.codex_app_version, "26.513.31313");
  assert.equal(output.codex_app_build, "2903");
  assert.equal(output.codex_appcast_feed, "prod");
  assert.equal(output.codex_appcast_url, undefined);
});

test("uses prod when the beta appcast is unavailable", async () => {
  const output = await runResolver({
    releases: [],
    appcastSource: appcastFor("26.513.31313", "2867"),
    betaAppcastSource: "unavailable",
    betaAppcastStatus: 404,
  });

  assert.equal(output.codex_app_version, "26.513.31313");
  assert.equal(output.codex_app_build, "2867");
  assert.equal(output.codex_appcast_feed, "prod");
  assert.equal(output.codex_appcast_url, undefined);
});

test("runs release resolver directly from TypeScript before dependency install", async () => {
  const output = await runResolver({
    releases: [],
    scriptArgs: [
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      "--experimental-strip-types",
      typescriptScriptPath,
    ],
  });

  assert.equal(output.codex_app_version, "26.429.61741");
  assert.equal(output.codex_app_build, "2429");
  assert.equal(output.release_tag, "codex-app-26.429.61741.0");
});

test("resolves Codex++ releases from the configured repository", async () => {
  const output = await runResolver({
    releases: [],
    codexPlusPlusRepo: "sliepie/codex-plusplus",
    codexPlusPlusSha: "1111111111111111111111111111111111111111",
    codexPlusPlusTag: "v0.2.0",
  });

  assert.equal(output.codex_plus_plus_tag, "v0.2.0");
  assert.equal(output.codex_plus_plus_sha, "1111111111111111111111111111111111111111");
  assert.match(
    output.hydration_cache_key,
    /codex-plusplus-v0\.2\.0-1111111111111111111111111111111111111111/,
  );
});

test("retries public upstream Codex++ lookups without a repo-scoped token after 401", async () => {
  const output = await runResolver({
    releases: [],
    rejectAuthorizedCodexPlusPlusRequests: true,
  });

  assert.equal(output.codex_plus_plus_tag, "v0.1.7");
  assert.equal(output.codex_plus_plus_sha, "7c3e1f6d2b4a9c8e7f6d5c4b3a29181716151413");
});

test("rejects Codex++ tags that do not resolve to commits", async () => {
  await assert.rejects(
    () => runResolver({
      releases: [],
      codexPlusPlusObjectType: "tree",
    }),
    /Codex\+\+ tag v0\.1\.7 points to a tree object, expected a commit or annotated tag/,
  );
});

test("increments the repo revision when the same Codex app version has a prior numeric release", async () => {
  const output = await runResolver({
    releases: [{ tag_name: "codex-app-26.429.61741.0", target_commitish: "old-sha" }],
  });

  assert.equal(output.release_version, "26.429.61741.1");
  assert.equal(output.repo_release_revision, "1");
  assert.equal(output.release_tag, "codex-app-26.429.61741.1");
  assert.equal(output.current_commit_release_tag, "");
});

test("paginates existing repository releases before choosing a new revision", async () => {
  const firstPage = Array.from({ length: 100 }, (_, index) => ({
    tag_name: "codex-app-26.429.61741." + index,
    target_commitish: "old-sha",
  }));
  const output = await runResolver({
    releases: firstPage,
    releasePages: [
      firstPage,
      [{ tag_name: "codex-app-26.429.61741.100", target_commitish: "old-sha" }],
    ],
  });

  assert.equal(output.release_version, "26.429.61741.101");
  assert.equal(output.repo_release_revision, "101");
  assert.equal(output.release_tag, "codex-app-26.429.61741.101");
});

test("increments the repo revision when the same Codex app version has a prior commit-suffixed release", async () => {
  const output = await runResolver({
    releases: [{ tag_name: "codex-app-26.429.61741.30431e4", target_commitish: "old-sha" }],
  });

  assert.equal(output.release_version, "26.429.61741.1");
  assert.equal(output.repo_release_revision, "1");
  assert.equal(output.release_tag, "codex-app-26.429.61741.1");
  assert.equal(output.current_commit_release_tag, "");
});

test("keeps the repo revision when rerunning a commit that already has a numeric release", async () => {
  const output = await runResolver({
    releases: [{
      tag_name: "codex-app-26.429.61741.1",
      target_commitish: "abcdef1234567890",
      body: releaseInputsBody(),
    }],
  });

  assert.equal(output.release_version, "26.429.61741.1");
  assert.equal(output.repo_release_revision, "1");
  assert.equal(output.release_tag, "codex-app-26.429.61741.1");
  assert.equal(output.current_commit_release_tag, "codex-app-26.429.61741.1");
});

test("keeps the repo revision when rerunning a commit that already has a commit-suffixed release", async () => {
  const output = await runResolver({
    releases: [{
      tag_name: "codex-app-26.429.61741.abcdef1",
      target_commitish: "abcdef1234567890",
      body: releaseInputsBody(),
    }],
  });

  assert.equal(output.release_version, "26.429.61741.0");
  assert.equal(output.repo_release_revision, "0");
  assert.equal(output.release_tag, "codex-app-26.429.61741.abcdef1");
  assert.equal(output.current_commit_release_tag, "codex-app-26.429.61741.abcdef1");
});

test("starts a new repo revision when the current commit release has stale Codex++ input", async () => {
  const output = await runResolver({
    releases: [{
      tag_name: "codex-app-26.429.61741.1",
      target_commitish: "abcdef1234567890",
      body: releaseInputsBody({ codexPlusPlusTag: "v0.1.6" }),
    }],
  });

  assert.equal(output.release_version, "26.429.61741.2");
  assert.equal(output.repo_release_revision, "2");
  assert.equal(output.release_tag, "codex-app-26.429.61741.2");
  assert.equal(output.current_commit_release_tag, "");
});

test("starts a new repo revision when the current commit release has stale Codex CLI input", async () => {
  const output = await runResolver({
    releases: [{
      tag_name: "codex-app-26.429.61741.1",
      target_commitish: "abcdef1234567890",
      body: releaseInputsBody({ codexCliTag: "rust-v0.128.0" }),
    }],
  });

  assert.equal(output.release_version, "26.429.61741.2");
  assert.equal(output.repo_release_revision, "2");
  assert.equal(output.release_tag, "codex-app-26.429.61741.2");
  assert.equal(output.current_commit_release_tag, "");
});

test("starts a new repo revision when the current commit release has stale Codex app build input", async () => {
  const output = await runResolver({
    releases: [{
      tag_name: "codex-app-26.429.61741.1",
      target_commitish: "abcdef1234567890",
      body: releaseInputsBody({ appBuildNumber: "2428" }),
    }],
  });

  assert.equal(output.release_version, "26.429.61741.2");
  assert.equal(output.repo_release_revision, "2");
  assert.equal(output.release_tag, "codex-app-26.429.61741.2");
  assert.equal(output.current_commit_release_tag, "");
});

test("starts a new repo revision when the current commit release has stale Codex++ commit input", async () => {
  const output = await runResolver({
    releases: [{
      tag_name: "codex-app-26.429.61741.1",
      target_commitish: "abcdef1234567890",
      body: releaseInputsBody({ codexPlusPlusSha: "1111111111111111111111111111111111111111" }),
    }],
  });

  assert.equal(output.release_version, "26.429.61741.2");
  assert.equal(output.repo_release_revision, "2");
  assert.equal(output.release_tag, "codex-app-26.429.61741.2");
  assert.equal(output.current_commit_release_tag, "");
});

test("treats legacy three-part release tags as repo revision zero", async () => {
  const output = await runResolver({
    releases: [{ tag_name: "codex-app-26.429.61741", target_commitish: "old-sha" }],
  });

  assert.equal(output.release_version, "26.429.61741.1");
  assert.equal(output.repo_release_revision, "1");
  assert.equal(output.release_tag, "codex-app-26.429.61741.1");
  assert.equal(output.current_commit_release_tag, "");
});

test("rejects unsafe upstream release metadata before writing workflow outputs", async () => {
  await assert.rejects(
    () => runResolver({
      releases: [],
      codexCliTag: "rust-v0.129.0$(Invoke-Expression)",
    }),
    /Codex CLI tag has an unexpected format/,
  );
});
