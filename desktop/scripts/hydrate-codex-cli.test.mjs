import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.dirname(scriptsRoot);
const require = createRequire(import.meta.url);
const {
  ensureExtractedZip,
  ensureCachedReleaseAsset,
  findReleaseAsset,
} = require(path.join(desktopRoot, ".cache", "scripts", "github-release-assets.js"));

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipWithSingleStoredFile(fileName, body) {
  const name = Buffer.from(fileName);
  const bytes = Buffer.from(body);
  const crc = crc32(bytes);
  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0, 6);
  localHeader.writeUInt16LE(0, 8);
  localHeader.writeUInt32LE(0, 10);
  localHeader.writeUInt32LE(crc, 14);
  localHeader.writeUInt32LE(bytes.length, 18);
  localHeader.writeUInt32LE(bytes.length, 22);
  localHeader.writeUInt16LE(name.length, 26);
  localHeader.writeUInt16LE(0, 28);

  const centralDirectory = Buffer.alloc(46);
  centralDirectory.writeUInt32LE(0x02014b50, 0);
  centralDirectory.writeUInt16LE(20, 4);
  centralDirectory.writeUInt16LE(20, 6);
  centralDirectory.writeUInt16LE(0, 8);
  centralDirectory.writeUInt16LE(0, 10);
  centralDirectory.writeUInt32LE(0, 12);
  centralDirectory.writeUInt32LE(crc, 16);
  centralDirectory.writeUInt32LE(bytes.length, 20);
  centralDirectory.writeUInt32LE(bytes.length, 24);
  centralDirectory.writeUInt16LE(name.length, 28);
  centralDirectory.writeUInt16LE(0, 30);
  centralDirectory.writeUInt16LE(0, 32);
  centralDirectory.writeUInt16LE(0, 34);
  centralDirectory.writeUInt16LE(0, 36);
  centralDirectory.writeUInt32LE(0, 38);
  centralDirectory.writeUInt32LE(0, 42);

  const centralOffset = localHeader.length + name.length + bytes.length;
  const centralSize = centralDirectory.length + name.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralOffset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([localHeader, name, bytes, centralDirectory, name, end]);
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
  let fetchCount = 0;
  const server = http.createServer((_, response) => {
    fetchCount += 1;
    response.writeHead(200, {
      "Content-Length": bytes.length,
      "Content-Type": "application/octet-stream",
    });
    response.end(bytes);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const asset = {
      digest: "sha256:" + sha256(bytes),
      downloadUrl: `http://127.0.0.1:${address.port}/asset.zip`,
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
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("GitHub release asset helper rejects failed downloads without caching them", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "codex-gh-asset-fail-"));
  const cachePath = path.join(directory, "asset.zip");
  const server = http.createServer((_, response) => {
    response.writeHead(404, {
      "Content-Type": "text/plain",
    });
    response.end("missing");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    await assert.rejects(
      () =>
        ensureCachedReleaseAsset({
          asset: {
            digest: "sha256:" + sha256(Buffer.from("missing")),
            downloadUrl: "http://127.0.0.1:" + address.port + "/asset.zip",
            name: "asset.zip",
            size: 7,
          },
          cachePath,
          checksum: { kind: "digest" },
          force: false,
        }),
      /Failed to download .*404/,
    );
    assert.equal(fs.existsSync(cachePath), false);
    assert.equal(fs.existsSync(cachePath + ".download"), false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("GitHub release asset helper re-extracts zips when the cached archive changes", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "codex-gh-extract-"));
  const archivePath = path.join(directory, "asset.zip");
  const extractRoot = path.join(directory, "extract");
  try {
    fs.writeFileSync(archivePath, zipWithSingleStoredFile("payload.txt", "one"));
    await ensureExtractedZip({ archivePath, extractRoot, force: false });
    assert.equal(fs.readFileSync(path.join(extractRoot, "payload.txt"), "utf8"), "one");

    fs.writeFileSync(archivePath, zipWithSingleStoredFile("payload.txt", "two"));
    await ensureExtractedZip({ archivePath, extractRoot, force: false });
    assert.equal(fs.readFileSync(path.join(extractRoot, "payload.txt"), "utf8"), "two");
  } finally {
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
