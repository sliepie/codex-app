import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import http from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

const desktopRoot = fileURLToPath(new URL("..", import.meta.url));
const scriptPath = fileURLToPath(new URL("../.cache/scripts/resolve-primary-runtime-source.js", import.meta.url));
const typescriptScriptPath = fileURLToPath(new URL("resolve-primary-runtime-source.ts", import.meta.url));
const require = createRequire(import.meta.url);
const {
  primaryRuntimeBuildRecipeFingerprint,
  primaryRuntimeSourceManifestFingerprint,
} = require("../.cache/scripts/primary-runtime-build-recipe.js");

const repository = "sliepie/codex-app";
const releaseTag = "codex-primary-runtime-win32-arm64";
const refreshEpoch = "100";
const sourceArchiveSha256 = "1".repeat(64);
const sourceManifest = {
  archiveName: "source-runtime.tar.xz",
  archiveSha256: sourceArchiveSha256,
  archiveSizeBytes: 1234,
  archiveUrl: "https://source.test/source-runtime.tar.xz",
  bundleVersion: "fixture-1",
  format: "tar.xz",
  nodeVersion: "24.0.0",
  pythonVersion: "3.13.0",
  targetArch: "x64",
  targetPlatform: "win32",
};
const sourceManifestFingerprint = primaryRuntimeSourceManifestFingerprint(sourceManifest);
const buildRecipeFingerprint = primaryRuntimeBuildRecipeFingerprint(desktopRoot, { repository, releaseTag });
const workflowPath = path.resolve(desktopRoot, "..", ".github", "workflows", "primary-runtime-windows-arm64.yml");

function currentPublishedManifest(overrides = {}) {
  return (origin) => ({
    archiveName: "runtime.tar.xz",
    archiveSha256: "a".repeat(64),
    archiveSizeBytes: 4321,
    archiveUrl: origin + "/published/runtime.tar.xz",
    buildRecipeFingerprint,
    refreshEpoch,
    sourceArchiveSha256,
    sourceManifestFingerprint,
    targetArch: "arm64",
    targetPlatform: "win32",
    ...overrides,
  });
}

function startServer(publishedManifest, archiveAvailable) {
  const requests = [];
  let origin;
  const server = http.createServer((request, response) => {
    requests.push({ method: request.method, url: request.url });
    if (request.url === "/source/LATEST.json") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify(sourceManifest));
      return;
    }
    if (request.url === "/published/LATEST.json" && publishedManifest != null) {
      const value = typeof publishedManifest === "function" ? publishedManifest(origin) : publishedManifest;
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify(value));
      return;
    }
    if (request.method === "HEAD" && request.url === "/published/runtime.tar.xz") {
      response.writeHead(archiveAvailable ? 200 : 404);
      response.end();
      return;
    }

    response.writeHead(404);
    response.end();
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      origin = `http://127.0.0.1:${address.port}`;
      resolve({
        close: () => new Promise((closeResolve) => server.close(closeResolve)),
        origin,
        requests,
      });
    });
  });
}

function parseOutputs(value) {
  return Object.fromEntries(
    value.trim().split("\n").map((line) => {
      const separatorIndex = line.indexOf("=");
      return [line.slice(0, separatorIndex), line.slice(separatorIndex + 1)];
    }),
  );
}

async function runResolver({
  archiveAvailable = true,
  eventName = "schedule",
  publishedManifest,
  refresh = refreshEpoch,
  scriptArgs = [scriptPath],
} = {}) {
  const server = await startServer(publishedManifest, archiveAvailable);
  const directory = await mkdtemp(path.join(tmpdir(), "primary-runtime-resolver-"));
  const outputPath = path.join(directory, "github-output.txt");

  try {
    await new Promise((resolve, reject) => {
      execFile(
        process.execPath,
        scriptArgs,
        {
          env: {
            ...process.env,
            GITHUB_EVENT_NAME: eventName,
            GITHUB_OUTPUT: outputPath,
            GITHUB_REPOSITORY: repository,
            PRIMARY_RUNTIME_PUBLISHED_MANIFEST_URL: server.origin + "/published/LATEST.json",
            PRIMARY_RUNTIME_REFRESH_EPOCH: refresh,
            PRIMARY_RUNTIME_SOURCE_MANIFEST_URL: server.origin + "/source/LATEST.json",
            RELEASE_TAG: releaseTag,
          },
        },
        (error, stdout, stderr) => {
          if (error != null) {
            error.message += `\nstdout:\n${stdout}\nstderr:\n${stderr}`;
            reject(error);
            return;
          }
          resolve();
        },
      );
    });

    return {
      outputs: parseOutputs(await readFile(outputPath, "utf8")),
      requests: server.requests,
    };
  } finally {
    await server.close();
    await rm(directory, { recursive: true, force: true });
  }
}

test("scheduled run skips current provenance when the published archive exists", async () => {
  const { outputs, requests } = await runResolver({ publishedManifest: currentPublishedManifest() });

  assert.equal(outputs.should_publish, "false");
  assert.equal(outputs.source_archive_sha256, sourceArchiveSha256);
  assert.equal(outputs.source_manifest_fingerprint, sourceManifestFingerprint);
  assert.equal(outputs.build_recipe_fingerprint, buildRecipeFingerprint);
  assert.equal(outputs.refresh_epoch, refreshEpoch);
  assert.deepEqual(requests.map((request) => request.method), ["GET", "GET", "HEAD"]);
});

test("scheduled run rebuilds when the published source changed", async () => {
  const { outputs } = await runResolver({
    publishedManifest: currentPublishedManifest({ sourceArchiveSha256: "2".repeat(64) }),
  });
  assert.equal(outputs.should_publish, "true");
});

test("scheduled run rebuilds when the build recipe changed", async () => {
  const { outputs } = await runResolver({
    publishedManifest: currentPublishedManifest({ buildRecipeFingerprint: "2".repeat(64) }),
  });
  assert.equal(outputs.should_publish, "true");
});

test("scheduled run rebuilds once per weekly refresh epoch", async () => {
  const { outputs, requests } = await runResolver({
    publishedManifest: currentPublishedManifest({ refreshEpoch: "99" }),
  });

  assert.equal(outputs.should_publish, "true");
  assert.equal(outputs.refresh_epoch, refreshEpoch);
  assert.doesNotMatch(requests.map((request) => request.method).join(","), /HEAD/);
});

test("scheduled run rebuilds when the published manifest is missing", async () => {
  const { outputs } = await runResolver();
  assert.equal(outputs.should_publish, "true");
});

test("scheduled run rebuilds a published manifest with the wrong target", async () => {
  const { outputs, requests } = await runResolver({
    publishedManifest: currentPublishedManifest({ targetArch: "x64" }),
  });

  assert.equal(outputs.should_publish, "true");
  assert.doesNotMatch(requests.map((request) => request.method).join(","), /HEAD/);
});

test("scheduled run rebuilds when the published archive is missing", async () => {
  const { outputs, requests } = await runResolver({
    archiveAvailable: false,
    publishedManifest: currentPublishedManifest(),
  });

  assert.equal(outputs.should_publish, "true");
  assert.equal(requests.at(-1)?.method, "HEAD");
});

test("non-scheduled runs force validation without consulting the published manifest", async () => {
  const { outputs, requests } = await runResolver({
    eventName: "workflow_dispatch",
    publishedManifest: currentPublishedManifest(),
  });

  assert.equal(outputs.should_publish, "true");
  assert.deepEqual(requests.map((request) => request.url), ["/source/LATEST.json"]);
});

test("resolver runs directly from TypeScript before dependency install", async () => {
  const { outputs } = await runResolver({
    eventName: "push",
    scriptArgs: [
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      "--experimental-strip-types",
      typescriptScriptPath,
    ],
  });

  assert.equal(outputs.should_publish, "true");
  assert.equal(outputs.source_archive_sha256, sourceArchiveSha256);
});

test("repository, release tag, and source metadata participate in cache provenance", () => {
  assert.notEqual(
    primaryRuntimeBuildRecipeFingerprint(desktopRoot, { repository: "example/fork", releaseTag }),
    buildRecipeFingerprint,
  );
  assert.notEqual(
    primaryRuntimeBuildRecipeFingerprint(desktopRoot, { repository, releaseTag: "different-tag" }),
    buildRecipeFingerprint,
  );
  assert.notEqual(
    primaryRuntimeSourceManifestFingerprint({ ...sourceManifest, bundleVersion: "fixture-2" }),
    sourceManifestFingerprint,
  );
});

test("workflow uses one shared cache/build pipeline with an isolated publish job", async () => {
  const workflow = await readFile(workflowPath, "utf8");

  assert.equal(workflow.match(/actions\/cache\/restore@/g)?.length, 1);
  assert.equal(workflow.match(/actions\/cache\/save@/g)?.length, 1);
  assert.equal(workflow.match(/npm run build:primary-runtime:win:arm64:compiled/g)?.length, 1);
  assert.match(workflow, /needs: prepare-primary-runtime/);
  assert.match(workflow, /actions\/download-artifact@/);
  assert.match(workflow, /source_manifest_fingerprint/);
  assert.match(workflow, /refresh_epoch/);
  assert.match(workflow, /github\.run_id/);
  assert.match(workflow, /restore-keys:/);
});
