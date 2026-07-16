import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

const scriptPath = fileURLToPath(new URL("../.cache/scripts/verify-primary-runtime-output.js", import.meta.url));
const sourceArchiveSha256 = "1".repeat(64);
const sourceManifestFingerprint = "3".repeat(64);
const buildRecipeFingerprint = "2".repeat(64);
const refreshEpoch = "42";

function runVerifier(outputRoot) {
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      [scriptPath, "--output-root", outputRoot],
      {
        env: {
          ...process.env,
          PRIMARY_RUNTIME_EXPECTED_SOURCE_ARCHIVE_SHA256: sourceArchiveSha256,
          PRIMARY_RUNTIME_EXPECTED_SOURCE_MANIFEST_FINGERPRINT: sourceManifestFingerprint,
          PRIMARY_RUNTIME_EXPECTED_BUILD_RECIPE_FINGERPRINT: buildRecipeFingerprint,
          PRIMARY_RUNTIME_REFRESH_EPOCH: refreshEpoch,
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
}

async function createOutput() {
  const outputRoot = await mkdtemp(path.join(tmpdir(), "primary-runtime-output-"));
  const archiveName = "runtime.tar.xz";
  const archive = Buffer.from("primary runtime fixture", "utf8");
  await writeFile(path.join(outputRoot, archiveName), archive);
  await writeFile(
    path.join(outputRoot, "LATEST.json"),
    JSON.stringify({
      archiveName,
      archiveSha256: createHash("sha256").update(archive).digest("hex"),
      archiveSizeBytes: archive.length,
      buildRecipeFingerprint,
      refreshEpoch,
      sourceArchiveSha256,
      sourceManifestFingerprint,
      targetArch: "arm64",
      targetPlatform: "win32",
    }),
  );
  return { archiveName, outputRoot };
}

test("accepts a complete output matching the resolved source and recipe", async () => {
  const fixture = await createOutput();
  try {
    await runVerifier(fixture.outputRoot);
  } finally {
    await rm(fixture.outputRoot, { recursive: true, force: true });
  }
});

test("rejects a cached archive whose contents were changed", async () => {
  const fixture = await createOutput();
  try {
    await writeFile(path.join(fixture.outputRoot, fixture.archiveName), "tampered runtime fixture");
    await assert.rejects(() => runVerifier(fixture.outputRoot), /archive (size|hash) mismatch/i);
  } finally {
    await rm(fixture.outputRoot, { recursive: true, force: true });
  }
});
