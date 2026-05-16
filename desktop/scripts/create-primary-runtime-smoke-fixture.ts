import { createHash } from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { pipeline } from "stream/promises";
import { spawnSync } from "child_process";

const runtimeRootDirectoryName = "codex-primary-runtime";

async function cleanDirectory(directory: string): Promise<void> {
  await fs.promises.rm(directory, { recursive: true, force: true });
  await fs.promises.mkdir(directory, { recursive: true });
}

function run(command: string, args: readonly string[], description: string): void {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error != null) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`Failed to ${description}.`);
  }
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  await pipeline(fs.createReadStream(filePath), hash);
  return hash.digest("hex");
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

async function main(): Promise<void> {
  const fixtureRoot = path.join(process.env.RUNNER_TEMP ?? os.tmpdir(), "primary-runtime-fixture");
  const payloadRoot = path.join(fixtureRoot, "payload");
  const runtimeRoot = path.join(payloadRoot, runtimeRootDirectoryName);
  await cleanDirectory(fixtureRoot);
  await fs.promises.mkdir(runtimeRoot, { recursive: true });

  await writeJson(path.join(runtimeRoot, "runtime.json"), {
    bundleVersion: "ci",
    targetPlatform: "win32",
    targetArch: "arm64",
  });

  const archivePath = path.join(fixtureRoot, "codex-primary-runtime-win32-arm64-ci.tar.xz");
  run("tar", ["-c", "-J", "-f", archivePath, "-C", payloadRoot, runtimeRootDirectoryName], `create ${archivePath}`);

  const archive = await fs.promises.stat(archivePath);
  const manifestPath = path.join(fixtureRoot, "primary-runtime-LATEST.json");
  await writeJson(manifestPath, {
    archiveName: path.basename(archivePath),
    archiveSha256: await sha256File(archivePath),
    archiveSizeBytes: archive.size,
    archiveUrl: archivePath,
    bundleFormatVersion: 1,
    bundleVersion: "ci",
    format: "tar.xz",
    latestManifestFileName: "LATEST.json",
    runtimeRootDirectoryName,
    targetArch: "arm64",
    targetPlatform: "win32",
  });

  if (process.env.GITHUB_OUTPUT != null && process.env.GITHUB_OUTPUT.trim() !== "") {
    await fs.promises.appendFile(process.env.GITHUB_OUTPUT, `manifest_path=${manifestPath}${os.EOL}`, "utf8");
  }
  console.log(manifestPath);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
