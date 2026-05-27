import { createRequire } from "node:module";
import type { main as hydrateCodexApp } from "./hydrate-codex-app";

type HydrateCodexAppModule = {
  main: typeof hydrateCodexApp;
};

const require = createRequire(import.meta.url);
const { main } = require("../.cache/scripts/hydrate-codex-app.js") as HydrateCodexAppModule;

await main(process.argv.slice(2));
