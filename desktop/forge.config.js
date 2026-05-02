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

function getReleaseVersion() {
  if (typeof releaseInfo?.version !== 'string' || releaseInfo.version.trim() === '') {
    throw new Error(`Missing hydrated Codex app release info: ${releaseInfoPath}`);
  }

  return releaseInfo.version;
}

const runtimeNodeModules = new Set([
  'base64-js',
  'better-sqlite3',
  'bindings',
  'bl',
  'buffer',
  'decompress-response',
  'deep-extend',
  'detect-libc',
  'end-of-stream',
  'expand-template',
  'file-uri-to-path',
  'fs-constants',
  'github-from-package',
  'ieee754',
  'inherits',
  'minimist',
  'mimic-response',
  'mkdirp-classic',
  'napi-build-utils',
  'node-abi',
  'node-addon-api',
  'node-pty',
  'once',
  'prebuild-install',
  'pump',
  'rc',
  'readable-stream',
  'safe-buffer',
  'semver',
  'simple-concat',
  'simple-get',
  'string_decoder',
  'strip-json-comments',
  'tar-fs',
  'tar-stream',
  'tslib',
  'tunnel-agent',
  'util-deprecate',
  'wrappy',
]);

function isRuntimeNodeModule(file) {
  const match = file.match(/^\/node_modules\/((?:@[^/]+\/)?[^/]+)/);
  return match ? runtimeNodeModules.has(match[1]) : file === '/node_modules';
}

const config = {
  packagerConfig: {
    asar: true,
    appVersion: releaseInfo?.version,
    buildVersion: releaseInfo?.buildNumber,
    extraResource: [
      'resources/codex.exe',
      'resources/codex-windows-sandbox-setup.exe',
      'resources/codex-command-runner.exe',
    ],
    ignore: (file) => {
      if (!file) {
        return false;
      }

      if (file.startsWith('/recovered/app-asar-extracted/node_modules')) {
        return true;
      }

      if (file.startsWith('/node_modules/node-pty/prebuilds')) {
        return true;
      }

      return ![
        '/recovered',
        '/recovered/app-asar-extracted/.vite',
        '/recovered/app-asar-extracted/webview',
        '/recovered/app-asar-extracted/skills',
        '/recovered/app-asar-extracted/package.json',
        '/package.json',
        '/node_modules/node-pty',
        '/node_modules/better-sqlite3',
      ].some((allowedPath) => file.startsWith(allowedPath)) || isRuntimeNodeModule(file);
    },
    protocols: [
      {
        name: 'Codex',
        schemes: ['codex'],
      },
    ],
  },
  rebuildConfig: {
    onlyModules: ['better-sqlite3'],
    ignoreModules: ['node-pty'],
  },
  makers: [new MakerZIP({}, ['win32'])],
  hooks: {
    postMake: async (_forgeConfig, makeResults) => {
      const releaseVersion = getReleaseVersion();

      return makeResults.map((result) => ({
        ...result,
        artifacts: result.artifacts.map((artifact) => {
          if (path.extname(artifact) !== '.zip') {
            return artifact;
          }

          const destination = path.join(
            path.dirname(artifact),
            `codex-app-windows-arm64-v${releaseVersion}.zip`,
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
