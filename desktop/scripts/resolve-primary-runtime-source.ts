import * as fs from "fs";

const publicWindowsX64ManifestUrl =
  "https://persistent.oaistatic.com/codex-primary-runtime/latest/win32-x64/LATEST.json";

function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  if (value == null || value.trim() === "") {
    return undefined;
  }
  return value.trim();
}

function setOutput(name: string, value: string): void {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath == null || outputPath.trim() === "") {
    return;
  }
  fs.appendFileSync(outputPath, name + "=" + value + "\n", "utf8");
}

async function assertReadableUrl(url: string, label: string): Promise<void> {
  const response = await fetch(url, {
    method: "HEAD",
    headers: { "User-Agent": "codex-primary-runtime-builder" },
  });

  if (!response.ok) {
    throw new Error("Failed to read " + label + " " + url + ": " + response.status + " " + response.statusText);
  }
}

async function main(): Promise<void> {
  await assertReadableUrl(publicWindowsX64ManifestUrl, "public OAI x64 primary runtime manifest");

  const nodeArchiveUrl = optionalEnv("PRIMARY_RUNTIME_ARM64_NODE_ARCHIVE_URL");
  const pythonArchiveUrl = optionalEnv("PRIMARY_RUNTIME_ARM64_PYTHON_ARCHIVE_URL");
  if (nodeArchiveUrl == null || pythonArchiveUrl == null) {
    setOutput("should_publish", "false");
    console.log("Skipping Windows ARM64 primary runtime publishing because complete ARM64 node/python replacement archives are not configured.");
    return;
  }

  await assertReadableUrl(nodeArchiveUrl, "Windows ARM64 node replacement archive");
  await assertReadableUrl(pythonArchiveUrl, "Windows ARM64 python replacement archive");
  setOutput("should_publish", "true");
  console.log("Windows ARM64 primary runtime publishing is enabled from the public OAI x64 runtime and configured ARM64 replacements.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
