import type { ForgeConfig } from '@electron-forge/shared-types';

import { MakerZIP } from '@electron-forge/maker-zip';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

import {
  closeRecoveredWebviewDevServer,
  ensureRecoveredWebviewDevServer,
} from './dev/recovered-webview-dev-server';

const config: ForgeConfig = {
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
  hooks: {
    preStart: async () => {
      await ensureRecoveredWebviewDevServer();
    },
    postStart: async (_forgeConfig, appProcess) => {
      appProcess.once('exit', () => {
        void closeRecoveredWebviewDevServer();
      });
    },
  },
  makers: [
    new MakerZIP({}, ['win32']),
  ],
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

export default config;
