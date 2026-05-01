const { AutoUnpackNativesPlugin } = require('@electron-forge/plugin-auto-unpack-natives');
const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

const config = {
  packagerConfig: {
    asar: true,
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
        '/node_modules',
        '/node_modules/node-pty',
        '/node_modules/better-sqlite3',
      ].some((allowedPath) => file.startsWith(allowedPath));
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
