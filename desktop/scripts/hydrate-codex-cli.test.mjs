import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.dirname(scriptsRoot);
const require = createRequire(import.meta.url);
const {
  ensureCachedReleaseAsset,
  findReleaseAsset,
} = require(path.join(desktopRoot, ".cache", "scripts", "github-release-assets.js"));

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

test("GitHub release asset helper finds named assets", () => {
  const release = {
    assets: [
      { downloadUrl: "https://example.test/a.zip", name: "a.zip", size: 1 },
      { downloadUrl: "https://example.test/b.zip", name: "b.zip", size: 1 },
    ],
    name: "release",
    tagName: "v1",
    url: "https://example.test/releases/v1",
  };

  assert.equal(findReleaseAsset(release, "b.zip", "demo").name, "b.zip");
  assert.throws(() => findReleaseAsset(release, "missing.zip", "demo"), /Missing demo release asset/);
});

test("GitHub release asset helper verifies digest and cached size", async () => {
  const bytes = Buffer.from("asset payload");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "codex-gh-asset-"));
  const cachePath = path.join(directory, "asset.zip");
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;
  globalThis.fetch = async () => {
    fetchCount += 1;
    return new Response(bytes);
  };

  try {
    const asset = {
      digest: "sha256:" + sha256(bytes),
      downloadUrl: "https://github.com/example/repo/releases/download/v1/asset.zip",
      name: "asset.zip",
      size: bytes.length,
    };
    const acquired = await ensureCachedReleaseAsset({
      asset,
      cachePath,
      checksum: { kind: "digest" },
      force: false,
    });

    assert.equal(fetchCount, 1);
    assert.equal(acquired.sha256, sha256(bytes));
    assert.equal(acquired.checksumSource, "release digest");
    assert.equal(fs.readFileSync(cachePath, "utf8"), "asset payload");

    await ensureCachedReleaseAsset({
      asset,
      cachePath,
      checksum: { kind: "digest" },
      force: false,
    });
    assert.equal(fetchCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("CLI hydrator uses shared GitHub and bundled plugin payload modules", () => {
  const source = fs.readFileSync(path.join(desktopRoot, "scripts", "hydrate-codex-cli.ts"), "utf8");

  assert.match(source, /ensureCachedReleaseAsset/);
  assert.match(source, /ensureExtractedZip/);
  assert.match(source, /findReleaseAsset\(release, assetName, "ripgrep"\)/);
  assert.match(source, /findReleaseAsset\(release, assetName, "Tectonic"\)/);
  assert.match(source, /installTectonicWindowsPayload\(resourcesRoot, tectonicPath\)/);
  assert.match(source, /readPeMachine\(tectonicPath\)/);
  assert.doesNotMatch(source, /execFileSync\(\s*"gh"/);
});
