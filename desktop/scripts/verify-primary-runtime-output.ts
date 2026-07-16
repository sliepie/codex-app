import { createHash } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { pipeline } from "stream/promises";

type PrimaryRuntimeManifest = {
  archiveName?: string;
  archiveSha256?: string;
  archiveSizeBytes?: number;
  buildRecipeFingerprint?: string;
  refreshEpoch?: string;
  sourceArchiveSha256?: string;
  sourceManifestFingerprint?: string;
  targetArch?: string;
  targetPlatform?: string;
};

function resolveDesktopRoot(): string {
  if (path.basename(__dirname) === "scripts" && path.basename(path.dirname(__dirname)) === ".cache") {
    return path.dirname(path.dirname(__dirname));
  }
  return path.dirname(__dirname);
}

function readOption(argv: readonly string[], names: readonly string[]): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    for (const name of names) {
      if (arg === name) {
        return argv[index + 1];
      }
      if (arg.startsWith(`${name}=`)) {
        return arg.slice(name.length + 1);
      }
    }
  }
  return undefined;
}

function requiredSha256(value: string | undefined, label: string): string {
  if (value == null || !/^[a-f0-9]{64}$/i.test(value)) {
    throw new Error(label + " must be a 64-character SHA-256 value.");
  }
  return value.toLowerCase();
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  await pipeline(fs.createReadStream(filePath), hash);
  return hash.digest("hex");
}

async function main(): Promise<void> {
  const outputRoot = path.resolve(
    readOption(process.argv.slice(2), ["-OutputRoot", "--output-root"]) ??
      path.join(resolveDesktopRoot(), "out", "primary-runtime", "win32-arm64"),
  );
  const manifestPath = path.join(outputRoot, "LATEST.json");
  const manifest = JSON.parse(await fs.promises.readFile(manifestPath, "utf8")) as PrimaryRuntimeManifest;

  if (manifest.targetPlatform !== "win32" || manifest.targetArch !== "arm64") {
    throw new Error(
      `Primary runtime target mismatch. Expected win32-arm64, got ${manifest.targetPlatform}-${manifest.targetArch}.`,
    );
  }
  if (manifest.archiveName == null || path.basename(manifest.archiveName) !== manifest.archiveName) {
    throw new Error("Primary runtime archiveName must be a file name in the output directory.");
  }

  const archivePath = path.join(outputRoot, manifest.archiveName);
  const archive = await fs.promises.stat(archivePath);
  if (!archive.isFile()) {
    throw new Error(`Primary runtime archive is not a file: ${archivePath}`);
  }
  if (!Number.isSafeInteger(manifest.archiveSizeBytes) || manifest.archiveSizeBytes !== archive.size) {
    throw new Error(
      `Primary runtime archive size mismatch. Expected ${manifest.archiveSizeBytes}, got ${archive.size}.`,
    );
  }

  const expectedArchiveSha256 = requiredSha256(manifest.archiveSha256, "Primary runtime archiveSha256");
  const actualArchiveSha256 = await sha256File(archivePath);
  if (actualArchiveSha256 !== expectedArchiveSha256) {
    throw new Error(
      `Primary runtime archive hash mismatch. Expected ${expectedArchiveSha256}, got ${actualArchiveSha256}.`,
    );
  }

  const sourceArchiveSha256 = requiredSha256(
    manifest.sourceArchiveSha256,
    "Primary runtime sourceArchiveSha256",
  );
  const buildRecipeFingerprint = requiredSha256(
    manifest.buildRecipeFingerprint,
    "Primary runtime buildRecipeFingerprint",
  );
  const sourceManifestFingerprint = requiredSha256(
    manifest.sourceManifestFingerprint,
    "Primary runtime sourceManifestFingerprint",
  );
  if (manifest.refreshEpoch == null || !/^\d+$/.test(manifest.refreshEpoch)) {
    throw new Error("Primary runtime refreshEpoch must be a non-negative integer.");
  }
  const expectedSourceArchiveSha256 = process.env.PRIMARY_RUNTIME_EXPECTED_SOURCE_ARCHIVE_SHA256;
  const expectedSourceManifestFingerprint = process.env.PRIMARY_RUNTIME_EXPECTED_SOURCE_MANIFEST_FINGERPRINT;
  const expectedBuildRecipeFingerprint = process.env.PRIMARY_RUNTIME_EXPECTED_BUILD_RECIPE_FINGERPRINT;
  const expectedRefreshEpoch = process.env.PRIMARY_RUNTIME_REFRESH_EPOCH;
  if (
    expectedSourceArchiveSha256 != null &&
    sourceArchiveSha256 !== requiredSha256(expectedSourceArchiveSha256, "Expected source archive SHA-256")
  ) {
    throw new Error("Primary runtime sourceArchiveSha256 does not match the resolved source.");
  }
  if (
    expectedSourceManifestFingerprint != null &&
    sourceManifestFingerprint !== requiredSha256(expectedSourceManifestFingerprint, "Expected source manifest fingerprint")
  ) {
    throw new Error("Primary runtime sourceManifestFingerprint does not match the resolved source manifest.");
  }
  if (
    expectedBuildRecipeFingerprint != null &&
    buildRecipeFingerprint !== requiredSha256(expectedBuildRecipeFingerprint, "Expected build recipe fingerprint")
  ) {
    throw new Error("Primary runtime buildRecipeFingerprint does not match the resolved build recipe.");
  }
  if (expectedRefreshEpoch != null && manifest.refreshEpoch !== expectedRefreshEpoch) {
    throw new Error("Primary runtime refreshEpoch does not match the resolved refresh epoch.");
  }

  console.log(`Verified Windows ARM64 primary runtime output: ${manifest.archiveName} (${archive.size} bytes).`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
