import * as fs from "fs";
import * as path from "path";
import {
  defaultPrimaryRuntimeReleaseTag,
  defaultPrimaryRuntimeRepository,
  defaultPrimaryRuntimeSourceManifestUrl,
  primaryRuntimeBuildRecipeFingerprint,
  primaryRuntimeRefreshEpoch,
  primaryRuntimeSourceManifestFingerprint,
  type PrimaryRuntimeSourceManifestMetadata,
} from "./primary-runtime-build-recipe.ts";

type PrimaryRuntimeManifest = PrimaryRuntimeSourceManifestMetadata & {
  buildRecipeFingerprint?: string;
  refreshEpoch?: string;
  sourceArchiveSha256?: string;
  sourceManifestFingerprint?: string;
};

function resolveDesktopRoot(): string {
  const scriptDirectory = path.dirname(path.resolve(process.argv[1] ?? ""));
  if (path.basename(scriptDirectory) === "scripts" && path.basename(path.dirname(scriptDirectory)) === ".cache") {
    return path.dirname(path.dirname(scriptDirectory));
  }
  return path.dirname(scriptDirectory);
}

function optionalEnv(name: string, fallback = ""): string {
  const value = process.env[name];
  return value == null || value.trim() === "" ? fallback : value;
}

function setOutput(name: string, value: string): void {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath == null || outputPath.trim() === "") {
    return;
  }
  fs.appendFileSync(outputPath, name + "=" + value + "\n", "utf8");
}

function normalizedSha256(value: string | undefined, label: string): string {
  if (value == null || !/^[a-f0-9]{64}$/i.test(value)) {
    throw new Error(label + " must be a 64-character SHA-256 value.");
  }
  return value.toLowerCase();
}

function resolveRefreshEpoch(): string {
  const value = optionalEnv("PRIMARY_RUNTIME_REFRESH_EPOCH", primaryRuntimeRefreshEpoch());
  if (!/^\d+$/.test(value)) {
    throw new Error("PRIMARY_RUNTIME_REFRESH_EPOCH must be a non-negative integer.");
  }
  return value;
}

function publishedManifestProblem(manifest: PrimaryRuntimeManifest): string | undefined {
  if (manifest.targetPlatform !== "win32" || manifest.targetArch !== "arm64") {
    return `target is ${manifest.targetPlatform}-${manifest.targetArch}, expected win32-arm64`;
  }
  if (manifest.archiveName == null || path.basename(manifest.archiveName) !== manifest.archiveName) {
    return "archiveName is missing or invalid";
  }
  if (manifest.archiveSha256 == null || !/^[a-f0-9]{64}$/i.test(manifest.archiveSha256)) {
    return "archiveSha256 is missing or invalid";
  }
  if (!Number.isSafeInteger(manifest.archiveSizeBytes) || (manifest.archiveSizeBytes ?? 0) <= 0) {
    return "archiveSizeBytes is missing or invalid";
  }
  if (manifest.archiveUrl == null || !/^https?:\/\//i.test(manifest.archiveUrl)) {
    return "archiveUrl is missing or invalid";
  }
  return undefined;
}

async function publishedArchiveExists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": "codex-primary-runtime-builder" },
    });
    if (!response.ok) {
      console.log(`Published Windows ARM64 primary runtime archive is unavailable: ${response.status} ${response.statusText}.`);
    }
    return response.ok;
  } catch (error: unknown) {
    console.log(
      "Published Windows ARM64 primary runtime archive check failed: " +
        (error instanceof Error ? error.message : String(error)),
    );
    return false;
  }
}

async function fetchManifest(
  url: string,
  label: string,
  allowMissing = false,
): Promise<PrimaryRuntimeManifest | undefined> {
  const response = await fetch(url, {
    headers: { "User-Agent": "codex-primary-runtime-builder" },
  });

  if (allowMissing && response.status === 404) {
    return undefined;
  }
  if (!response.ok) {
    throw new Error("Failed to read " + label + " " + url + ": " + response.status + " " + response.statusText);
  }

  return await response.json() as PrimaryRuntimeManifest;
}

async function main(): Promise<void> {
  const repository = optionalEnv("GITHUB_REPOSITORY", defaultPrimaryRuntimeRepository);
  const releaseTag = optionalEnv("RELEASE_TAG", defaultPrimaryRuntimeReleaseTag);
  const sourceManifestUrl = optionalEnv(
    "PRIMARY_RUNTIME_SOURCE_MANIFEST_URL",
    defaultPrimaryRuntimeSourceManifestUrl,
  );
  const publishedManifestUrl = optionalEnv(
    "PRIMARY_RUNTIME_PUBLISHED_MANIFEST_URL",
    `https://github.com/${repository}/releases/download/${releaseTag}/LATEST.json`,
  );
  const arm64NodeArchiveUrl = optionalEnv("PRIMARY_RUNTIME_ARM64_NODE_ARCHIVE_URL") || undefined;
  const arm64PythonArchiveUrl = optionalEnv("PRIMARY_RUNTIME_ARM64_PYTHON_ARCHIVE_URL") || undefined;

  const sourceManifest = await fetchManifest(sourceManifestUrl, "public OAI x64 primary runtime manifest");
  const sourceArchiveSha256 = normalizedSha256(
    sourceManifest?.archiveSha256,
    "Source primary runtime archiveSha256",
  );
  const sourceManifestFingerprint = primaryRuntimeSourceManifestFingerprint(sourceManifest ?? {});
  const buildRecipeFingerprint = primaryRuntimeBuildRecipeFingerprint(resolveDesktopRoot(), {
    arm64NodeArchiveUrl,
    arm64PythonArchiveUrl,
    repository,
    releaseTag,
  });
  const refreshEpoch = resolveRefreshEpoch();

  setOutput("source_archive_sha256", sourceArchiveSha256);
  setOutput("source_manifest_fingerprint", sourceManifestFingerprint);
  setOutput("build_recipe_fingerprint", buildRecipeFingerprint);
  setOutput("refresh_epoch", refreshEpoch);

  const isForcedValidation = process.env.GITHUB_EVENT_NAME !== "schedule";
  if (isForcedValidation) {
    setOutput("should_publish", "true");
    console.log("Windows ARM64 primary runtime validation is forced for " + optionalEnv("GITHUB_EVENT_NAME", "local") + ".");
    return;
  }

  const publishedManifest = await fetchManifest(
    publishedManifestUrl,
    "published Windows ARM64 primary runtime manifest",
    true,
  );
  const manifestProblem = publishedManifest == null ? "manifest is missing" : publishedManifestProblem(publishedManifest);
  const isCurrent =
    manifestProblem == null &&
    publishedManifest?.sourceArchiveSha256?.toLowerCase() === sourceArchiveSha256 &&
    publishedManifest?.sourceManifestFingerprint === sourceManifestFingerprint &&
    publishedManifest?.buildRecipeFingerprint === buildRecipeFingerprint &&
    publishedManifest?.refreshEpoch === refreshEpoch;
  const archiveExists = isCurrent && publishedManifest?.archiveUrl != null
    ? await publishedArchiveExists(publishedManifest.archiveUrl)
    : false;
  const shouldPublish = !isCurrent || !archiveExists;

  setOutput("should_publish", shouldPublish ? "true" : "false");
  if (!shouldPublish) {
    console.log("Published Windows ARM64 primary runtime already matches the current source and build recipe.");
  } else {
    console.log(
      "Windows ARM64 primary runtime must be built because its published artifact, refresh epoch, source, or build recipe is missing or changed" +
        (manifestProblem == null ? "." : ` (${manifestProblem}).`),
    );
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
