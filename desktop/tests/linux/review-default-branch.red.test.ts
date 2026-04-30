import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { readRecoveredAsset } from './recovered-bundle.helpers';

const desktopRoot = path.resolve(__dirname, '..', '..');
const recoveredWorkerPath = path.join(
  desktopRoot,
  'recovered',
  'app-asar-extracted',
  '.vite',
  'build',
  'worker.js',
);
const recoveredWebAssetRoot = path.join(
  desktopRoot,
  'recovered',
  'app-asar-extracted',
  'webview',
  'assets',
);

function readRecoveredWorkerBundle(): string {
  if (!fs.existsSync(recoveredWorkerPath)) {
    throw new Error(`Missing recovered worker bundle: ${recoveredWorkerPath}`);
  }

  return fs.readFileSync(recoveredWorkerPath, 'utf8');
}

describe('Review base branch regression gate (RED)', () => {
  test('default branch resolution still falls back to main or master in the worker bundle', () => {
    const workerSource = readRecoveredWorkerBundle();

    expect(workerSource).toContain('async handleDefaultBranch');
    expect(workerSource).toMatch(
      /let r=\(await [A-Za-z$_][\w$]*\(\s*e\.root,t,n\s*\)\)\?\.branch\?\?null/,
    );
    expect(workerSource).toMatch(
      /return r\|\|=\(await [A-Za-z$_][\w$]*\(\s*e\.root,10,t,n\s*\)\)\.find\(e=>e===`main`\|\|e===`master`\)\?\?null,X\(\{branch:r\}\)/,
    );
  });

  test('renderer branch defaults still fall back to main and seed branch starting state', () => {
    const rendererSource = readRecoveredAsset('composer-');

    expect(rendererSource).toContain('default_branch??`main`');
    expect(rendererSource).toContain('asyncThreadStartingState');
    expect(rendererSource).toContain('`working-tree`');
    expect(rendererSource).toContain('`recent-branches`');
  });
});
