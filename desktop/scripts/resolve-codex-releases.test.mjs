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
  assert.equal(output.release_tag, "codex-app-26.429.61741.abcdef1");
  assert.equal(output.codex_cli_tag, "rust-v0.129.0");
  assert.equal(output.repo_app_release_tag, "");
});

test("finds an existing numeric repo release for the same Codex app version", async () => {
  const output = await runResolver({
    releases: [{ tag_name: "codex-app-26.429.61741.0", target_commitish: "old-sha" }],
  });

  assert.equal(output.release_version, "26.429.61741.0");
  assert.equal(output.release_tag, "codex-app-26.429.61741.abcdef1");
  assert.equal(output.repo_app_release_tag, "codex-app-26.429.61741.0");
});

test("finds an existing commit-suffixed repo release for the same Codex app version", async () => {
  const output = await runResolver({
    releases: [{ tag_name: "codex-app-26.429.61741.abcdef1", target_commitish: "abcdef1234567890" }],
  });

  assert.equal(output.release_version, "26.429.61741.0");
  assert.equal(output.release_tag, "codex-app-26.429.61741.abcdef1");
  assert.equal(output.repo_app_release_tag, "codex-app-26.429.61741.abcdef1");
});

test("ignores legacy three-part release tags", async () => {
  const output = await runResolver({
    releases: [{ tag_name: "codex-app-26.429.61741", target_commitish: "old-sha" }],
  });

  assert.equal(output.release_version, "26.429.61741.0");
  assert.equal(output.release_tag, "codex-app-26.429.61741.abcdef1");
  assert.equal(output.repo_app_release_tag, "");
});
