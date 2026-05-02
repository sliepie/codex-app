import { execFileSync } from "node:child_process";
import { createWriteStream } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import extract from "extract-zip";

type Options = {
  version?: string;
  appcastUrl: string;
  cacheRoot: string;
  force: boolean;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const desktopRoot = path.resolve(__dirname, "..");

function readOption(argv: string[], ...names: string[]): string | undefined {
  for (const name of names) {
    const index = argv.indexOf(name);
    if (index !== -1) {
      const value = argv[index + 1];
      if (!value || value.startsWith("-")) {
        throw new Error(`Missing value for ${name}`);
      }
      return value;
    }
  }
  return undefined;
}

function hasFlag(argv: string[], ...names: string[]): boolean {
  return names.some((name) => argv.includes(name));
}

function parseOptions(argv: string[]): Options {
  const cacheRoot =
    readOption(argv, "--cache-root", "-CacheRoot") ??
    path.join(desktopRoot, ".cache", "codex-app");

  return {
    version: readOption(argv, "--version", "-Version"),
    appcastUrl:
      readOption(argv, "--appcast-url", "-AppcastUrl") ??
      "https://persistent.oaistatic.com/codex-app-prod/appcast.xml",
    cacheRoot,
    force: hasFlag(argv, "--force", "-Force"),
  };
}

function firstMatch(text: string, pattern: RegExp, message: string): string {
  const match = text.match(pattern);
  if (!match?.[1]) {
    throw new Error(message);
  }
  return match[1].trim();
}

function findReleaseItem(appcast: string, version?: string): string {
  const items = [...appcast.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map(
    (match) => match[0],
  );
  if (items.length === 0) {
    throw new Error("No Codex app release was found in the appcast.");
  }
  if (!version) {
    return items.find((item) => /<enclosure\b/i.test(item)) ?? items[0];
  }

  const item = items.find((candidate) =>
    candidate.includes(`<sparkle:shortVersionString>${version}</sparkle:shortVersionString>`),
  );
  if (!item) {
    throw new Error(`Codex app version ${version} was not found in the appcast.`);
  }
  return item;
}

function findAppAsar(root: string): string | undefined {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      const match = findAppAsar(entryPath);
      if (match) {
        return match;
      }
      continue;
    }

    const normalized = entryPath.replaceAll(path.sep, "/");
    if (normalized.endsWith("Codex.app/Contents/Resources/app.asar")) {
      return entryPath;
    }
  }
  return undefined;
}

async function downloadFile(url: string, outputPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  await pipeline(Readable.fromWeb(response.body), createWriteStream(outputPath));
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  if (!options.appcastUrl.trim()) {
    throw new Error("Missing Codex appcast URL.");
  }

  fs.mkdirSync(options.cacheRoot, { recursive: true });

  const appcastResponse = await fetch(options.appcastUrl);
  if (!appcastResponse.ok) {
    throw new Error(
      `Failed to fetch Codex appcast: ${appcastResponse.status} ${appcastResponse.statusText}`,
    );
  }

  const item = findReleaseItem(await appcastResponse.text(), options.version);
  const selectedVersion = firstMatch(
    item,
    /<sparkle:shortVersionString>([^<]+)<\/sparkle:shortVersionString>/i,
    "The selected Codex app release does not have a version.",
  );
  const selectedBuildNumber =
    item.match(/<sparkle:version>([^<]+)<\/sparkle:version>/i)?.[1]?.trim() ?? "";
  const downloadUrl = firstMatch(
    item,
    /<enclosure\b[^>]*\burl="([^"]+)"/i,
    `Codex app version ${selectedVersion} does not have a full download URL.`,
  );

  const zipPath = path.join(options.cacheRoot, path.basename(new URL(downloadUrl).pathname));
  const extractRoot = path.join(options.cacheRoot, `extract-${selectedVersion}`);
  const recoveredRoot = path.join(desktopRoot, "recovered", "app-asar-extracted");
  const releaseInfoPath = path.join(options.cacheRoot, "latest-release.json");

  if (options.force) {
    fs.rmSync(zipPath, { force: true });
    fs.rmSync(extractRoot, { recursive: true, force: true });
  }

  if (!fs.existsSync(zipPath)) {
    await downloadFile(downloadUrl, zipPath);
  }

  if (!fs.existsSync(extractRoot)) {
    fs.mkdirSync(extractRoot, { recursive: true });
    await extract(zipPath, { dir: extractRoot });
  }

  const appAsar = findAppAsar(extractRoot);
  if (!appAsar) {
    throw new Error("Could not find Codex.app Contents/Resources/app.asar in the downloaded ZIP.");
  }

  execFileSync(
    process.execPath,
    [path.join(__dirname, "refresh-recovered-from-dmg.mjs"), "--app-asar", appAsar, "--output", recoveredRoot],
    { stdio: "inherit" },
  );

  fs.writeFileSync(
    releaseInfoPath,
    `${JSON.stringify(
      {
        version: selectedVersion,
        buildNumber: selectedBuildNumber,
        downloadUrl,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(`Hydrated Codex app ${selectedVersion} from ${downloadUrl}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
