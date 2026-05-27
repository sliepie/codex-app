import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { main } = require("../.cache/scripts/hydrate-codex-app.js");

await main(process.argv.slice(2));
