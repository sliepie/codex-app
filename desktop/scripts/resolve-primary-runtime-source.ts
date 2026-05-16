import * as fs from "fs";

const publicWindowsArm64ManifestUrl =
  "https://persistent.oaistatic.com/codex-primary-runtime/latest/win32-arm64/LATEST.json";

function enabledEnv(name: string): boolean {
  const value = process.env[name];
  if (value == null) {
    return false;
  }
  return ["1", "true", "yes"].includes(value.trim().toLowerCase());
}

function setOutput(name: string, value: string): void {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath == null || outputPath.trim() === "") {
    return;
  }
  fs.appendFileSync(outputPath, name + "=" + value + "\n", "utf8");
}

async function checkReadableUrl(url: string): Promise<{ ok: boolean; status: number; statusText: string }> {
  const response = await fetch(url, {
    method: "HEAD",
    headers: { "User-Agent": "codex-primary-runtime-builder" },
  });

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
  };
}

async function main(): Promise<void> {
  const manifest = await checkReadableUrl(publicWindowsArm64ManifestUrl);
  if (!manifest.ok) {
    const message =
      "official OAI Windows ARM64 primary runtime manifest is unavailable: " +
      publicWindowsArm64ManifestUrl +
      " returned " +
      manifest.status +
      " " +
      manifest.statusText;
    if (enabledEnv("PRIMARY_RUNTIME_REQUIRE_OFFICIAL_ARM64_RUNTIME")) {
      throw new Error("Cannot publish Windows ARM64 primary runtime because the " + message + ".");
    }
    setOutput("should_publish", "false");
    console.log("Skipping Windows ARM64 primary runtime publishing because the " + message + ".");
    return;
  }

  setOutput("should_publish", "true");
  console.log("Windows ARM64 primary runtime publishing is enabled from the official OAI Windows ARM64 primary runtime manifest.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
