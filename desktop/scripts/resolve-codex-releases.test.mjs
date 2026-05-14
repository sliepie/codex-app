import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import test from "node:test";
import assert from "node:assert/strict";

const scriptPath = fileURLToPath(new URL("./resolve-codex-releases.mjs", import.meta.url));

const appcast = `<?xml version="1.0" encoding="utf-8"?>
<rss>
  <channel>
    <item>
      <sparkle:shortVersionString>26.429.61741</sparkle:shortVersionString>
      <sparkle:version>2429</sparkle:version>
    </item>
  </channel>
</rss>`;

function releaseInputsBody({
  codexCliTag = "rust-v0.129.0",
  codexPlusPlusTag = "v0.1.7",
} = {}) {
  return [
    "Codex CLI: " + codexCliTag,
    "Codex++: " + codexPlusPlusTag,
  ].join("\\n");
}

function startServer(releases) {
  const server = http.createServer((request, response) => {
    if (request.url === "/appcast.xml") {
      response.writeHead(200, { "Content-Type": "application/xml" });
      response.end(appcast);
      return;
    }

    if (request.url?.startsWith("/repos/sliepie/codex-app/releases")) {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify(releases));
      return;
    }

    if (request.url === "/repos/openai/codex/releases/latest") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ tag_name: "rust-v0.129.0" }));
      return;
    }

    if (request.url === "/repos/b-nnett/codex-plusplus/releases/latest") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ tag_name: "v0.1.7" }));
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

async function runResolver({ releases, sha = "abcdef1234567890" }) {
  const server = await startServer(releases);
  const directory = await mkdtemp(path.join(tmpdir(), "codex-release-resolver-"));
  const outputPath = path.join(directory, "github-output.txt");

  try {
    await new Promise((resolve, reject) => {
      execFile(
        process.execPath,
        [scriptPath],
        {
          env: {
            ...process.env,
            CODEX_APPCAST_URL: `${server.origin}/appcast.xml`,
            GH_TOKEN: "test-token",
            GITHUB_API_URL: server.origin,
            GITHUB_OUTPUT: outputPath,
            GITHUB_REPOSITORY: "sliepie/codex-app",
            GITHUB_SHA: sha,
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
        .map((line) => line.split("=")),
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
  assert.equal(output.repo_release_revision, "0");
  assert.equal(output.release_tag, "codex-app-26.429.61741.0");
  assert.equal(output.current_commit_release_tag, "");
  assert.equal(
    output.hydration_cache_key,
    "windows-arm64-hydrated-v5-app-26.429.61741-build-2429-cli-rust-v0.129.0-codex-plusplus-v0.1.7",
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
  assert.equal(output.release_tag, "codex-app-26.429.61741.0");
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

test("treats legacy three-part release tags as repo revision zero", async () => {
  const output = await runResolver({
    releases: [{ tag_name: "codex-app-26.429.61741", target_commitish: "old-sha" }],
  });

  assert.equal(output.release_version, "26.429.61741.1");
  assert.equal(output.repo_release_revision, "1");
  assert.equal(output.release_tag, "codex-app-26.429.61741.1");
  assert.equal(output.current_commit_release_tag, "");
});
