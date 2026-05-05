const { AutoUnpackNativesPlugin } = require('@electron-forge/plugin-auto-unpack-natives');
const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { MakerZIP } = require('@electron-forge/maker-zip');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const fs = require('node:fs');
const path = require('node:path');

const releaseInfoPath = path.join(__dirname, '.cache', 'codex-app', 'latest-release.json');
const releaseInfo = fs.existsSync(releaseInfoPath)
  ? JSON.parse(fs.readFileSync(releaseInfoPath, 'utf8'))
  : null;
const recoveredNodeModulesRoot = path.join(
  __dirname,
  'recovered',
  'app-asar-extracted',
  'node_modules',
);

function listPackageRoots(nodeModulesRoot) {
  if (!fs.existsSync(nodeModulesRoot)) {
    return [];
  }

  const packageRoots = [];
  for (const entry of fs.readdirSync(nodeModulesRoot, { withFileTypes: true })) {
    const entryPath = path.join(nodeModulesRoot, entry.name);
    if (!entry.isDirectory()) {
      continue;
    }

    if (entry.name.startsWith('@')) {
      for (const scopedEntry of fs.readdirSync(entryPath, { withFileTypes: true })) {
        if (scopedEntry.isDirectory()) {
          packageRoots.push(path.join(entryPath, scopedEntry.name));
        }
      }
      continue;
    }

    packageRoots.push(entryPath);
  }

  return packageRoots;
}

function readPackageJson(packageRoot) {
  return JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
}

function hasNativePayload(packageRoot) {
  if (
    fs.existsSync(path.join(packageRoot, 'binding.gyp')) ||
    fs.existsSync(path.join(packageRoot, 'prebuilds'))
  ) {
    return true;
  }

  for (const entry of fs.readdirSync(packageRoot, { withFileTypes: true })) {
    const entryPath = path.join(packageRoot, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      if (hasNativePayload(entryPath)) {
        return true;
      }
      continue;
    }

    if (
      entry.isFile() &&
      ['.node', '.dll', '.dylib', '.so', '.exe'].includes(path.extname(entry.name))
    ) {
      return true;
    }
  }

  return false;
}

function findNativePackageNames(nodeModulesRoot) {
  return new Set(
    listPackageRoots(nodeModulesRoot)
      .filter((packageRoot) => hasNativePayload(packageRoot))
      .map((packageRoot) => readPackageJson(packageRoot).name),
  );
}

function packagerPathForPackage(nodeModulesRoot, packageName) {
  const packageRoot = path.join(nodeModulesRoot, ...packageName.split('/'));
  const relativePath = path.relative(__dirname, packageRoot).replace(/\\/g, '/');
  return `/${relativePath}`;
}

function findInstalledPackageRoot(packageName, fromDirectory) {
  let currentDirectory = fromDirectory;
  while (currentDirectory.startsWith(__dirname)) {
    const candidate = path.join(currentDirectory, 'node_modules', ...packageName.split('/'));
    if (fs.existsSync(path.join(candidate, 'package.json'))) {
      return candidate;
    }

    const parentDirectory = path.dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      break;
    }
    currentDirectory = parentDirectory;
  }

  return null;
}

function collectInstalledRuntimePackagePaths(packageNames) {
  const packagePaths = new Set();
  const seenPackageRoots = new Set();
  const pendingPackages = [...packageNames].map((packageName) => ({
    packageName,
    fromDirectory: __dirname,
    optional: false,
  }));

  while (pendingPackages.length > 0) {
    const nextPackage = pendingPackages.pop();
    const packageRoot = findInstalledPackageRoot(nextPackage.packageName, nextPackage.fromDirectory);
    if (!packageRoot) {
      if (nextPackage.optional) {
        continue;
      }
      throw new Error(`Missing installed runtime Node module: ${nextPackage.packageName}`);
    }
    if (seenPackageRoots.has(packageRoot)) {
      continue;
    }

    seenPackageRoots.add(packageRoot);
    packagePaths.add(`/${path.relative(__dirname, packageRoot).replace(/\\/g, '/')}`);

    const packageJson = readPackageJson(packageRoot);
    for (const packageName of Object.keys(packageJson.dependencies ?? {})) {
      pendingPackages.push({ packageName, fromDirectory: packageRoot, optional: false });
    }
    for (const packageName of Object.keys(packageJson.optionalDependencies ?? {})) {
      pendingPackages.push({ packageName, fromDirectory: packageRoot, optional: true });
    }
  }

  return packagePaths;
}

const nativePackageNames = findNativePackageNames(recoveredNodeModulesRoot);
const recoveredNativePackagePaths = new Set(
  [...nativePackageNames].map((packageName) =>
    packagerPathForPackage(recoveredNodeModulesRoot, packageName),
  ),
);
const installedRuntimePackagePaths = collectInstalledRuntimePackagePaths(nativePackageNames);

function matchesPath(file, targetPath) {
  return file === targetPath || file.startsWith(`${targetPath}/`);
}

function isRecoveredNativeNodeModule(file) {
  for (const packagePath of recoveredNativePackagePaths) {
    if (matchesPath(file, packagePath)) {
      return true;
    }
  }

  return false;
}

function isRecoveredNodeModule(file) {
  return (
    matchesPath(file, '/recovered/app-asar-extracted/node_modules') &&
    !isRecoveredNativeNodeModule(file)
  );
}

function isInstalledRuntimeNodeModule(file) {
  if (file === '/node_modules') {
    return true;
  }

  for (const packagePath of installedRuntimePackagePaths) {
    if (matchesPath(file, packagePath)) {
      return true;
    }
  }

  return false;
}

function isForeignPrebuild(file) {
  const match = file.match(/^\/node_modules\/(?:@[^/]+\/)?[^/]+\/prebuilds\/([^/]+)/);
  return Boolean(match && match[1] !== 'win32-arm64');
}

function isPackageFile(file) {
  if (
    [
      '/recovered',
      '/recovered/app-asar-extracted',
      '/recovered/app-asar-extracted/node_modules',
    ].includes(file)
  ) {
    return true;
  }

  return [
    '/recovered/app-asar-extracted/.vite',
    '/recovered/app-asar-extracted/native-menu-locales',
    '/recovered/app-asar-extracted/webview',
    '/recovered/app-asar-extracted/skills',
    '/recovered/app-asar-extracted/package.json',
    '/package.json',
  ].some((allowedPath) => file.startsWith(allowedPath)) ||
    isRecoveredNodeModule(file) ||
    isInstalledRuntimeNodeModule(file);
}

const config = {
  packagerConfig: {
    asar: true,
    appVersion: releaseInfo?.version,
    buildVersion: releaseInfo?.buildNumber,
    icon: path.join(__dirname, 'assets', 'windows', 'icon.ico'),
    prune: false,
    extraResource: [
      'assets/windows/icon.ico',
      'resources/codex.exe',
      'resources/codex-windows-sandbox-setup.exe',
      'resources/codex-command-runner.exe',
      'resources/node_repl.exe',
      'resources/node.exe',
      'resources/rg.exe',
    ],
    ignore: (file) => {
      if (!file) {
        return false;
      }
      const normalizedFile = file.replace(/\\/g, '/');

      if (isRecoveredNativeNodeModule(normalizedFile) || isForeignPrebuild(normalizedFile)) {
        return true;
      }

      return !isPackageFile(normalizedFile);
    },
    protocols: [
      {
        name: 'Codex',
        schemes: ['codex'],
      },
    ],
  },
  makers: [new MakerZIP({}, ['win32'])],
  hooks: {
    postMake: async (_forgeConfig, makeResults) => {
      return makeResults.map((result) => ({
        ...result,
        artifacts: result.artifacts.map((artifact) => {
          if (path.extname(artifact) !== '.zip') {
            return artifact;
          }

          const destination = path.join(
            path.dirname(artifact),
            'codex-app-windows-arm64.zip',
          );
          if (fs.existsSync(destination)) {
            fs.rmSync(destination, { force: true });
          }

          fs.renameSync(artifact, destination);
          return destination;
        }),
      }));
    },
  },
  plugins: [
    new AutoUnpackNativesPlugin({}),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

module.exports = config;
