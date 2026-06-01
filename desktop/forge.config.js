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
const recoveredAppRoot = path.join(__dirname, 'recovered', 'app-asar-extracted');
const recoveredNodeModulesRoot = path.join(
  recoveredAppRoot,
  'node_modules',
);
const targetRuntimeArch = 'arm64';
const targetRuntimePlatform = 'win32';
const codexWindowsPackageIdentity = 'Sliepie.Codex.SelfSigned';
const requiredInstalledRuntimePackageNames = new Set(['tslib']);

function listPackageRoots(nodeModulesRoot) {
  if (!fs.existsSync(nodeModulesRoot)) {
    return [];
  }

  const isPackageRoot = (packageRoot) =>
    fs.existsSync(path.join(packageRoot, 'package.json'));
  const packageRoots = [];
  for (const entry of fs.readdirSync(nodeModulesRoot, { withFileTypes: true })) {
    const entryPath = path.join(nodeModulesRoot, entry.name);
    if (!entry.isDirectory()) {
      continue;
    }

    if (entry.name.startsWith('@')) {
      for (const scopedEntry of fs.readdirSync(entryPath, { withFileTypes: true })) {
        const scopedEntryPath = path.join(entryPath, scopedEntry.name);
        if (scopedEntry.isDirectory() && isPackageRoot(scopedEntryPath)) {
          packageRoots.push(scopedEntryPath);
        }
      }
      continue;
    }

    if (isPackageRoot(entryPath)) {
      packageRoots.push(entryPath);
    }
  }

  return packageRoots;
}

function readPackageJson(packageRoot) {
  return JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
}

function recoveredOriginalMain(upstreamPackageJson) {
  const upstreamMain =
    typeof upstreamPackageJson.main === 'string' && upstreamPackageJson.main.trim()
      ? upstreamPackageJson.main.trim().replace(/\\/g, '/')
      : '.vite/build/bootstrap.js';
  const normalizedMain = path.posix.normalize(upstreamMain.replace(/^\.\//, ''));
  if (
    path.posix.isAbsolute(normalizedMain) ||
    normalizedMain === '..' ||
    normalizedMain.startsWith('../') ||
    /^[A-Za-z]:/.test(normalizedMain)
  ) {
    throw new Error('Recovered Codex main must stay inside recovered/app-asar-extracted: ' + upstreamMain);
  }
  return path.posix.join('recovered/app-asar-extracted', normalizedMain);
}

function readRecoveredPackageJson() {
  const packageJsonPath = path.join(recoveredAppRoot, 'package.json');
  return fs.existsSync(packageJsonPath) ? readPackageJson(recoveredAppRoot) : null;
}

const configuredRecoveredOriginalMain = recoveredOriginalMain(readRecoveredPackageJson() ?? {});
const requiredCodexPlusPlusPackageFiles = [
  'codex-plusplus/loader.cjs',
  'codex-plusplus/windows-menu-bar-preload.cjs',
  'codex-plusplus/runtime/main.js',
  'codex-plusplus/runtime/preload.js',
  'codex-plusplus/LICENSE',
  'codex-plusplus/release.json',
];

function packageListAllowsTarget(value, target) {
  if (!value) {
    return true;
  }

  const entries = Array.isArray(value) ? value : [value];
  if (entries.includes(`!${target}`)) {
    return false;
  }

  const allowedEntries = entries.filter((entry) => !entry.startsWith('!'));
  return allowedEntries.length === 0 || allowedEntries.includes(target);
}

function supportsTargetRuntime(packageJson) {
  return (
    packageListAllowsTarget(packageJson.os, targetRuntimePlatform) &&
    packageListAllowsTarget(packageJson.cpu, targetRuntimeArch)
  );
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
      .map((packageRoot) => ({ packageRoot, packageJson: readPackageJson(packageRoot) }))
      .filter(
        ({ packageRoot, packageJson }) =>
          hasNativePayload(packageRoot) && supportsTargetRuntime(packageJson),
      )
      .map(({ packageJson }) => packageJson.name),
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

function collectInstalledRuntimePackagePaths(packageNames, requiredPackageNames = new Set()) {
  const packagePaths = new Set();
  const seenPackageRoots = new Set();
  const pendingPackages = [...packageNames].map((packageName) => ({
    packageName,
    fromDirectory: __dirname,
    optional: !requiredPackageNames.has(packageName),
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
      pendingPackages.push({ packageName, fromDirectory: packageRoot, optional: true });
    }
    for (const packageName of Object.keys(packageJson.optionalDependencies ?? {})) {
      pendingPackages.push({ packageName, fromDirectory: packageRoot, optional: true });
    }
  }

  return packagePaths;
}

const nativePackageNames = findNativePackageNames(recoveredNodeModulesRoot);
const installedNativePackageNames = new Set(
  [...nativePackageNames].filter((packageName) => findInstalledPackageRoot(packageName, __dirname)),
);
const recoveredNativePackagePaths = new Set(
  [...installedNativePackageNames].map((packageName) =>
    packagerPathForPackage(recoveredNodeModulesRoot, packageName),
  ),
);
const installedRuntimePackagePaths = collectInstalledRuntimePackagePaths(
  new Set([...nativePackageNames, ...requiredInstalledRuntimePackageNames]),
  requiredInstalledRuntimePackageNames,
);

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
  if (file === '/' + configuredRecoveredOriginalMain) {
    return true;
  }

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
    '/codex-plusplus',
    '/package.json',
  ].some((allowedPath) => matchesPath(file, allowedPath)) ||
    isRecoveredNodeModule(file) ||
    isInstalledRuntimeNodeModule(file);
}

function syncPackagedPackageJson(buildPath) {
  const packageJsonPath = path.join(buildPath, 'package.json');
  const packageJson = readPackageJson(buildPath);
  const upstreamPackageJson = readPackageJson(path.join(__dirname, 'recovered', 'app-asar-extracted'));

  for (const key of [
    'name',
    'productName',
    'author',
    'description',
    'codexBuildFlavor',
    'codexBuildNumber',
    'codexSparkleFeedUrl',
    'codexSparklePublicKey',
  ]) {
    if (upstreamPackageJson[key] != null) {
      packageJson[key] = upstreamPackageJson[key];
    }
  }

  packageJson.version = releaseInfo?.version ?? upstreamPackageJson.version ?? packageJson.version;
  packageJson.codexBuildNumber =
    releaseInfo?.buildNumber ?? upstreamPackageJson.codexBuildNumber ?? packageJson.codexBuildNumber;
  packageJson.codexWindowsPackageIdentity = codexWindowsPackageIdentity;
  packageJson.__codexpp = {
    ...(packageJson.__codexpp && typeof packageJson.__codexpp === 'object'
      ? packageJson.__codexpp
      : {}),
    originalMain: recoveredOriginalMain(upstreamPackageJson),
  };
  packageJson.main = 'codex-plusplus/loader.cjs';

  fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
}

function assertRequiredPackageFile(buildPath, relativePath) {
  const fullPath = path.join(buildPath, ...relativePath.split('/'));
  if (!fs.existsSync(fullPath)) {
    throw new Error('Missing required packaged file: ' + relativePath);
  }
}

function assertCodexPlusPlusPackageInputs(buildPath) {
  for (const relativePath of requiredCodexPlusPlusPackageFiles) {
    assertRequiredPackageFile(buildPath, relativePath);
  }

  const packageJson = readPackageJson(buildPath);
  const originalMain = packageJson.__codexpp?.originalMain;
  if (typeof originalMain !== 'string' || !originalMain.trim()) {
    throw new Error('Missing packaged Codex++ originalMain metadata.');
  }
  const normalizedOriginalMain = originalMain.trim().replace(/\\/g, '/').replace(/^\.\//, '');
  if (!isPackageFile('/' + normalizedOriginalMain)) {
    throw new Error('Packaged original main is not allowed by Forge ignore rules: ' + normalizedOriginalMain);
  }
  assertRequiredPackageFile(buildPath, normalizedOriginalMain);
}

const config = {
  packagerConfig: {
    asar: true,
    appVersion: releaseInfo?.version,
    buildVersion: releaseInfo?.buildNumber,
    download: process.env.electron_config_cache
      ? { cacheRoot: process.env.electron_config_cache }
      : undefined,
    icon: path.join(__dirname, 'assets', 'windows', 'icon.ico'),
    prune: false,
    extraResource: [
      'assets/windows/icon.ico',
      'resources/codex.exe',
      'resources/codex-windows-sandbox-setup.exe',
      'resources/codex-command-runner.exe',
      'resources/native',
      'resources/node_repl.exe',
      'resources/node.exe',
      'resources/plugins',
      'resources/rg.exe',
    ],
    afterCopy: [
      (buildPath, _electronVersion, _platform, _arch, callback) => {
        try {
          syncPackagedPackageJson(buildPath);
          assertCodexPlusPlusPackageInputs(buildPath);
          callback();
        } catch (error) {
          callback(error);
        }
      },
    ],
    ignore: (file) => {
      if (!file) {
        return false;
      }
      const normalizedFile = file.replace(/\\/g, '/');

      if (path.extname(normalizedFile).toLowerCase() === '.pdb') {
        return true;
      }

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
