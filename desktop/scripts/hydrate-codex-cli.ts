import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

type ReleaseAsset = {
  name: string;
  url: string;
  size: number;
};

type ReleaseInfo = {
  tagName: string;
  name: string;
  url: string;
  assets: ReleaseAsset[];
};

type RequiredAsset = {
  assetName: string;
  outputName: string;
};

type Options = {
  codexRepo: string;
  cacheRoot: string;
  force: boolean;
};

const desktopRoot = process.cwd();

const requiredAssets: RequiredAsset[] = [
  {
    assetName: "codex-aarch64-pc-windows-msvc.exe",
    outputName: "codex.exe",
  },
  {
    assetName: "codex-windows-sandbox-setup-aarch64-pc-windows-msvc.exe",
    outputName: "codex-windows-sandbox-setup.exe",
  },
  {
    assetName: "codex-command-runner-aarch64-pc-windows-msvc.exe",
    outputName: "codex-command-runner.exe",
  },
];

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
  return {
    codexRepo: readOption(argv, "--codex-repo", "-CodexRepo") ?? "openai/codex",
    cacheRoot:
      readOption(argv, "--cache-root", "-CacheRoot") ??
      path.join(desktopRoot, ".cache", "codex-cli"),
    force: hasFlag(argv, "--force", "-Force"),
  };
}

async function downloadFile(url: string, outputPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  fs.writeFileSync(outputPath, Buffer.from(await response.arrayBuffer()));
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  if (!options.codexRepo.trim()) {
    throw new Error("Missing Codex GitHub repository.");
  }

  const resourcesRoot = path.join(desktopRoot, "resources");
  fs.mkdirSync(options.cacheRoot, { recursive: true });
  fs.mkdirSync(resourcesRoot, { recursive: true });

  const releaseJson = execFileSync(
    "gh",
    ["release", "view", "--repo", options.codexRepo, "--json", "tagName,name,url,assets"],
    { encoding: "utf8" },
  );
  const release = JSON.parse(releaseJson) as ReleaseInfo;
  const assetsByName = new Map(release.assets.map((asset) => [asset.name, asset]));

  const hydratedAssets = [];
  for (const requiredAsset of requiredAssets) {
    const asset = assetsByName.get(requiredAsset.assetName);
    if (!asset?.url) {
      throw new Error(`Missing Codex release asset: ${requiredAsset.assetName}`);
    }

    const downloadPath = path.join(options.cacheRoot, requiredAsset.assetName);
    const outputPath = path.join(resourcesRoot, requiredAsset.outputName);

    if (options.force) {
      fs.rmSync(downloadPath, { force: true });
    }
    if (!fs.existsSync(downloadPath)) {
      await downloadFile(asset.url, downloadPath);
    }

    fs.copyFileSync(downloadPath, outputPath);
    hydratedAssets.push({
      assetName: requiredAsset.assetName,
      outputName: requiredAsset.outputName,
      downloadUrl: asset.url,
      size: asset.size,
    });
  }

  fs.writeFileSync(
    path.join(options.cacheRoot, "latest-release.json"),
    `${JSON.stringify(
      {
        tagName: release.tagName,
        name: release.name,
        htmlUrl: release.url,
        assets: hydratedAssets,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(`Hydrated Codex CLI ${release.tagName} into ${resourcesRoot}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
