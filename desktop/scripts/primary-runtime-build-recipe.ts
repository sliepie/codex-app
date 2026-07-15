import { createHash } from "crypto";
import * as fs from "fs";
import * as path from "path";

export const defaultPrimaryRuntimeSourceManifestUrl =
  "https://persistent.oaistatic.com/codex-primary-runtime/latest/win32-x64/LATEST.json";
export const defaultPrimaryRuntimeRepository = "sliepie/codex-app";
export const defaultPrimaryRuntimeReleaseTag = "codex-primary-runtime-win32-arm64";

const refreshIntervalMilliseconds = 7 * 24 * 60 * 60 * 1000;

const recipeInputPaths = [
  "scripts/build-primary-runtime-win-arm64.ts",
  "scripts/primary-runtime-build-recipe.ts",
] as const;

export type PrimaryRuntimeBuildRecipeOptions = {
  arm64NodeArchiveUrl?: string;
  arm64PythonArchiveUrl?: string;
  releaseTag?: string;
  repository?: string;
};

export type PrimaryRuntimeSourceManifestMetadata = {
  archiveName?: string;
  archiveSha256?: string;
  archiveSizeBytes?: number;
  archiveUrl?: string;
  bundleFormatVersion?: unknown;
  bundleVersion?: string;
  format?: string;
  generatedDependencies?: unknown;
  nodeVersion?: string;
  pythonVersion?: string;
  runtimeRootDirectoryName?: string;
  targetArch?: string;
  targetPlatform?: string;
};

function normalizedText(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (value != null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
        .map(([name, entryValue]) => [name, stableValue(entryValue)]),
    );
  }
  return value;
}

export function primaryRuntimeRefreshEpoch(now = Date.now()): string {
  return Math.floor(now / refreshIntervalMilliseconds).toString(10);
}

export function primaryRuntimeSourceManifestFingerprint(
  manifest: PrimaryRuntimeSourceManifestMetadata,
): string {
  const metadata = {
    archiveName: manifest.archiveName,
    archiveSha256: manifest.archiveSha256?.toLowerCase(),
    archiveSizeBytes: manifest.archiveSizeBytes,
    archiveUrl: manifest.archiveUrl,
    bundleFormatVersion: manifest.bundleFormatVersion,
    bundleVersion: manifest.bundleVersion,
    format: manifest.format,
    generatedDependencies: manifest.generatedDependencies,
    nodeVersion: manifest.nodeVersion,
    pythonVersion: manifest.pythonVersion,
    runtimeRootDirectoryName: manifest.runtimeRootDirectoryName,
    targetArch: manifest.targetArch,
    targetPlatform: manifest.targetPlatform,
  };
  return createHash("sha256").update(JSON.stringify(stableValue(metadata))).digest("hex");
}

export function primaryRuntimeBuildRecipeFingerprint(
  desktopRoot: string,
  options: PrimaryRuntimeBuildRecipeOptions = {},
): string {
  const hash = createHash("sha256");
  hash.update("primary-runtime-win32-arm64-recipe-v1\0");

  for (const relativePath of recipeInputPaths) {
    hash.update(relativePath);
    hash.update("\0");
    hash.update(normalizedText(fs.readFileSync(path.join(desktopRoot, relativePath), "utf8")));
    hash.update("\0");
  }

  for (const [name, value] of [
    ["arm64NodeArchiveUrl", options.arm64NodeArchiveUrl ?? ""],
    ["arm64PythonArchiveUrl", options.arm64PythonArchiveUrl ?? ""],
    ["repository", options.repository ?? defaultPrimaryRuntimeRepository],
    ["releaseTag", options.releaseTag ?? defaultPrimaryRuntimeReleaseTag],
  ] as const) {
    hash.update(name);
    hash.update("\0");
    hash.update(value);
    hash.update("\0");
  }

  return hash.digest("hex");
}
