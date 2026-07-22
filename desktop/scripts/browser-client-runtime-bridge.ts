const browserClientRuntimeBridgeImport = /from\s*["']\.\/node_modules\/classic-level\.mjs["']/;

export const browserClientRuntimeBridgeRelativePath = "scripts/node_modules/classic-level.mjs";

export const browserClientRuntimeBridgeSource = [
  'import { createRequire } from "node:module";',
  "",
  "const require = createRequire(import.meta.url);",
  'const { ClassicLevel } = require("./classic-level/index.js");',
  "",
  "export { ClassicLevel };",
  "",
].join("\n");

export function browserClientUsesRuntimeBridge(source: string): boolean {
  return browserClientRuntimeBridgeImport.test(source);
}
