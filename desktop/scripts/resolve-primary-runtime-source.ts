import * as fs from "fs";

const publicWindowsX64ManifestUrl =
  "https://persistent.oaistatic.com/codex-primary-runtime/latest/win32-x64/LATEST.json";

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
  setOutput("should_publish", "true");
  console.log("Windows ARM64 primary runtime publishing is enabled from the public OAI x64 runtime with public ARM64 native substitutions where available.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
