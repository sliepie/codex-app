import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import extract from "extract-zip";

type GithubReleaseAsset = {
  browser_download_url?: string | null;
  digest?: string | null;
  name?: string | null;
};

type GithubRelease = {
  assets?: GithubReleaseAsset[] | null;
  tag_name?: string | null;
};

type Options = {
  outputPath: string;
  repository: string;
  version: string;
};

function resolveDesktopRoot(): string {
  return path.basename(__dirname) === "scripts" && path.basename(path.dirname(__dirname)) === ".cache"
    ? path.resolve(__dirname, "..", "..")
    : path.resolve(__dirname, "..");
}

const desktopRoot = resolveDesktopRoot();
const userAgent = "codex-app-windows-arm64-build";

function readOption(argv: string[], ...names: string[]): string | undefined {
  for (const name of names) {
    const index = argv.indexOf(name);
    if (index !== -1) {
      const value = argv[index + 1];
      if (!value || value.startsWith("-")) {
        throw new Error("Missing value for " + name);
      }
      return value;
    }
  }
  return undefined;
}

function parseOptions(argv: string[]): Options {
  return {
    repository: readOption(argv, "--repository", "-Repository") ?? "tectonic-typesetting/tectonic",
    version: readOption(argv, "--version", "-Version") ?? "0.16.9",
    outputPath:
      readOption(argv, "--output", "-OutputPath") ??
      path.join(desktopRoot, ".cache", "tectonic", "windows-x64", "tectonic.exe"),
  };
}

async function wait(delayMs: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function withRetry<T>(description: string, action: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      if (attempt === 3) {
        break;
      }
      const delaySeconds = 5 * attempt;
      console.log(description + " failed on attempt " + attempt + "; retrying in " + delaySeconds + " seconds.");
      await wait(delaySeconds * 1000);
    }
  }
  throw lastError;
}

async function fetchJson<T>(url: string): Promise<T> {
  return withRetry("Fetch " + url, async () => {
    const response = await fetch(url, {
      headers: {
        accept: "application/vnd.github+json",
        "user-agent": userAgent,
      },
    });
    if (!response.ok) {
      throw new Error("Failed to fetch " + url + ": " + response.status + " " + response.statusText);
    }
    return (await response.json()) as T;
  });
}

async function downloadFile(url: string, outputPath: string): Promise<void> {
  await withRetry("Download " + url, async () => {
    const response = await fetch(url, {
      headers: {
        "user-agent": userAgent,
      },
    });
    if (!response.ok) {
      throw new Error("Failed to download " + url + ": " + response.status + " " + response.statusText);
    }
    fs.writeFileSync(outputPath, Buffer.from(await response.arrayBuffer()));
  });
}

function getSha256(filePath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function getPeMachine(filePath: string): number {
  const bytes = fs.readFileSync(filePath);
  if (bytes.length < 0x40 || bytes[0] !== 0x4d || bytes[1] !== 0x5a) {
    throw new Error("Expected a PE executable: " + filePath);
  }

  const peOffset = bytes.readInt32LE(0x3c);
  if (peOffset < 0 || peOffset + 6 > bytes.length) {
    throw new Error("Invalid PE header offset in " + filePath + ".");
  }

  return bytes.readUInt16LE(peOffset + 4);
}

function requireString(value: string | null | undefined, label: string): string {
  if (!value?.trim()) {
    throw new Error("Missing " + label + ".");
  }
  return value;
}

function findFile(root: string, fileName: string): string | undefined {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      const match = findFile(entryPath, fileName);
      if (match) {
        return match;
      }
      continue;
    }
    if (entry.isFile() && entry.name === fileName) {
      return entryPath;
    }
  }
  return undefined;
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const assetName = "tectonic-" + options.version + "-x86_64-pc-windows-msvc.zip";
  const tagName = "tectonic@" + options.version;
  const releaseUrl =
    "https://api.github.com/repos/" + options.repository + "/releases/tags/" + encodeURIComponent(tagName);
  const release = await fetchJson<GithubRelease>(releaseUrl);
  const asset = release.assets?.find((candidate) => candidate.name === assetName);
  if (!asset) {
    throw new Error("Could not find " + assetName + " in " + releaseUrl + ".");
  }

  const outputDirectory = path.dirname(options.outputPath);
  const downloadDirectory = path.join(desktopRoot, ".cache", "tectonic", "downloads");
  const extractRoot = path.join(desktopRoot, ".cache", "tectonic", "extract-" + options.version);
  const zipPath = path.join(downloadDirectory, assetName);
  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.mkdirSync(downloadDirectory, { recursive: true });

  if (!fs.existsSync(zipPath)) {
    await downloadFile(requireString(asset.browser_download_url, "asset download URL"), zipPath);
  }

  const zipHash = getSha256(zipPath);
  const expectedDigest = asset.digest?.match(/^sha256:(.+)$/i)?.[1]?.toLowerCase();
  if (expectedDigest && zipHash !== expectedDigest) {
    fs.rmSync(zipPath, { force: true });
    throw new Error("Downloaded " + assetName + " SHA-256 mismatch: expected " + expectedDigest + ", got " + zipHash + ".");
  }

  fs.rmSync(extractRoot, { recursive: true, force: true });
  fs.mkdirSync(extractRoot, { recursive: true });
  await extract(zipPath, { dir: extractRoot });

  const tectonicPath = findFile(extractRoot, "tectonic.exe");
  if (!tectonicPath) {
    throw new Error("Could not find tectonic.exe in " + assetName + ".");
  }
  if (getPeMachine(tectonicPath) !== 0x8664) {
    throw new Error("Expected x64 tectonic.exe from " + assetName + ".");
  }

  fs.copyFileSync(tectonicPath, options.outputPath);
  const exeHash = getSha256(options.outputPath);
  const metadata = {
    repository: options.repository,
    tagName: release.tag_name ?? tagName,
    assetName: requireString(asset.name, "asset name"),
    assetDigest: asset.digest,
    sourceUrl: requireString(asset.browser_download_url, "asset download URL"),
    architecture: "x64",
    sha256: exeHash,
  };
  const metadataPath = path.join(outputDirectory, path.basename(options.outputPath, path.extname(options.outputPath)) + ".json");
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2) + "\n", "utf8");

  console.log("Downloaded " + assetName + " to " + options.outputPath + ".");
  console.log("SHA-256: " + exeHash);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
