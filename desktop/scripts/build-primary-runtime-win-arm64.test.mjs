import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

const scriptPath = fileURLToPath(new URL("../.cache/scripts/build-primary-runtime-win-arm64.js", import.meta.url));

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, options, (error, stdout, stderr) => {
      if (error != null) {
        error.message += `\nstdout:\n${stdout}\nstderr:\n${stderr}`;
        reject(error);
        return;
      }
      resolve({ stderr, stdout });
    });
  });
}

test("builds a Windows ARM64 runtime from a tar.gz source manifest", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "primary-runtime-tar-gz-"));
  const payloadRoot = path.join(directory, "payload");
  const runtimeRoot = path.join(payloadRoot, "codex-primary-runtime");
  const sourceArchivePath = path.join(directory, "source-runtime.tar.gz");
  const sourceManifestPath = path.join(directory, "LATEST.json");
  const outputRoot = path.join(directory, "output");

  try {
    await mkdir(runtimeRoot, { recursive: true });
    await writeFile(path.join(runtimeRoot, "runtime.json"), JSON.stringify({ targetArch: "x64", targetPlatform: "win32" }));
    await run("tar", ["-czf", sourceArchivePath, "-C", payloadRoot, "codex-primary-runtime"]);
    await writeFile(
      sourceManifestPath,
      JSON.stringify({
        archiveName: path.basename(sourceArchivePath),
        archiveUrl: sourceArchivePath,
        bundleVersion: "fixture-1",
        format: "tar.gz",
        targetArch: "x64",
        targetPlatform: "win32",
      }),
    );

    await run(process.execPath, [
      scriptPath,
      "--output-root",
      outputRoot,
      "--repository",
      "sliepie/codex-app",
      "--release-tag",
      "codex-primary-runtime-win32-arm64",
      "--source-manifest-url",
      sourceManifestPath,
    ]);

    const releaseManifest = JSON.parse(await readFile(path.join(outputRoot, "LATEST.json"), "utf8"));
    assert.equal(releaseManifest.archiveName, "codex-primary-runtime-win32-arm64-fixture-1.tar.xz");
    assert.equal(releaseManifest.format, "tar.xz");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
