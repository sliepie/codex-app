import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import asar from "@electron/asar";

type CliOptions = {
  appAsarPath: string | null;
  dmgPath: string | null;
  keepTemp: boolean;
  outputRoot: string;
};

type PackageJson = {
  buildNumber?: string;
  codexBuildNumber?: string;
  devDependencies?: {
    electron?: string;
  };
  main?: string;
  version?: string;
};

const desktopRoot = process.cwd();
const repoRoot = path.resolve(desktopRoot, '..');
const defaultRecoveredRoot = path.join(desktopRoot, 'recovered', 'app-asar-extracted');

function parseArgValue(argv: string[], name: string): string | null {
  const index = argv.findIndex((arg) => arg === name);
  if (index === -1) {
    return null;
  }

  const value = argv[index + 1];
  if (!value) {
    throw new Error(`Missing value for ${name}`);
  }

  return value;
}

function parseCli(argv: string[]): CliOptions {
  const defaultAppAsarPath = path.join(
    repoRoot,
    'codex-dmg',
    'Codex.app',
    'Contents',
    'Resources',
    'app.asar',
  );
  const defaultDmgPath = fs.existsSync(path.join(repoRoot, 'Codex_new.dmg'))
    ? path.join(repoRoot, 'Codex_new.dmg')
    : path.join(repoRoot, 'Codex.dmg');
  const explicitDmgPath = parseArgValue(argv, '--dmg');
  const explicitAppAsarPath = parseArgValue(argv, '--app-asar');
  const outputRoot = parseArgValue(argv, '--output') ?? defaultRecoveredRoot;
  const keepTemp = argv.includes('--keep-temp');
  const appAsarPath =
    explicitAppAsarPath ??
    (!explicitDmgPath && fs.existsSync(defaultAppAsarPath) ? defaultAppAsarPath : null);
  const dmgPath = appAsarPath ? null : explicitDmgPath ?? defaultDmgPath;

  return {
    dmgPath: dmgPath ? path.resolve(process.cwd(), dmgPath) : null,
    appAsarPath: appAsarPath ? path.resolve(process.cwd(), appAsarPath) : null,
    outputRoot: path.resolve(process.cwd(), outputRoot),
    keepTemp,
  };
}

function sha256(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

async function extractDmgToTemp(dmgPath: string, tempRoot: string): Promise<void> {
  childProcess.execFileSync('7z', ['x', '-y', dmgPath, `-o${tempRoot}`], {
    cwd: repoRoot,
    stdio: 'pipe',
  });
}

function assertExists(targetPath: string, label: string): void {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`${label} is missing: ${targetPath}`);
  }
}

function findAppResourcesRoot(extractRoot: string): string {
  const matches: string[] = [];

  function walk(currentPath: string): void {
    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath);
        continue;
      }

      if (
        entry.name === 'app.asar' &&
        currentPath.endsWith(path.join('Contents', 'Resources'))
      ) {
        matches.push(currentPath);
      }
    }
  }

  walk(extractRoot);

  if (matches.length === 0) {
    throw new Error(`Could not locate Contents/Resources/app.asar under ${extractRoot}`);
  }

  return matches.sort((left, right) => left.localeCompare(right))[0];
}

function syncExactDirectory(sourceRoot: string, destinationRoot: string): void {
  fs.rmSync(destinationRoot, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(destinationRoot), { recursive: true });
  fs.cpSync(sourceRoot, destinationRoot, {
    recursive: true,
    preserveTimestamps: true,
  });
}

async function main(): Promise<void> {
  const { dmgPath, appAsarPath, outputRoot, keepTemp } = parseCli(process.argv.slice(2));
  if (!dmgPath && !appAsarPath) {
    throw new Error('Expected either --dmg or --app-asar');
  }
  if (dmgPath) {
    assertExists(dmgPath, 'Codex DMG');
  }
  if (appAsarPath) {
    assertExists(appAsarPath, 'Codex app.asar');
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-dmg-refresh-'));

  try {
    let resolvedAppAsarPath = appAsarPath;
    if (!resolvedAppAsarPath) {
      if (!dmgPath) {
        throw new Error('Expected a Codex DMG path when --app-asar is not provided');
      }
      await extractDmgToTemp(dmgPath, tempRoot);
      const appResourcesRoot = findAppResourcesRoot(tempRoot);
      resolvedAppAsarPath = path.join(appResourcesRoot, 'app.asar');
    }

    const extractedAppRoot = path.join(tempRoot, 'app.asar.extracted');
    asar.extractAll(resolvedAppAsarPath, extractedAppRoot);

    const upstreamPackage = JSON.parse(
      fs.readFileSync(path.join(extractedAppRoot, 'package.json'), 'utf8'),
    ) as PackageJson;

    syncExactDirectory(extractedAppRoot, outputRoot);

    const summary = {
      sourceType: dmgPath ? 'dmg' : 'app-asar',
      dmgPath,
      dmgSha256: dmgPath ? sha256(dmgPath) : null,
      appAsarPath: resolvedAppAsarPath,
      appAsarSha256: sha256(resolvedAppAsarPath),
      outputRoot,
      version: upstreamPackage.version,
      buildNumber: upstreamPackage.buildNumber ?? upstreamPackage.codexBuildNumber ?? null,
      electronVersion: upstreamPackage.devDependencies?.electron ?? null,
      main: upstreamPackage.main ?? null,
      tempRoot: keepTemp ? tempRoot : null,
    };

    const manifestPath = path.join(path.dirname(outputRoot), 'refresh-manifest.json');
    fs.writeFileSync(manifestPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
    process.stdout.write(`${JSON.stringify({ ...summary, manifestPath }, null, 2)}\n`);

    if (!keepTemp) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  } catch (error) {
    if (!keepTemp) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }

    throw error;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
