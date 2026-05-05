import fs from "node:fs";
import path from "node:path";

type PatchStatus = "applied" | "already-applied";

type PatchResult = {
  file: string;
  name: string;
  status: PatchStatus;
};

const desktopRoot = process.cwd();

function readOption(argv: string[], ...names: string[]): string | undefined {
  for (const name of names) {
    const index = argv.indexOf(name);
    if (index !== -1) {
      const value = argv[index + 1];
      if (!value || value.startsWith("-")) {
        throw new Error(`Missing value for ${name}`);
      }
      return value;
    }
  }
  return undefined;
}

function findFile(root: string, pattern: RegExp): string {
  const matches: string[] = [];
  const pending = [root];

  while (pending.length > 0) {
    const directory = pending.pop();
    if (!directory) {
      break;
    }

    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        pending.push(entryPath);
        continue;
      }

      if (entry.isFile() && pattern.test(entry.name)) {
        matches.push(entryPath);
      }
    }
  }

  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one recovered bundle file matching ${pattern}, found ${matches.length}.`,
    );
  }

  return matches[0];
}

function countOccurrences(text: string, value: string): number {
  let count = 0;
  let index = text.indexOf(value);
  while (index !== -1) {
    count += 1;
    index = text.indexOf(value, index + value.length);
  }
  return count;
}

function replaceExact(
  filePath: string,
  name: string,
  target: string,
  replacement: string,
): PatchResult {
  const original = fs.readFileSync(filePath, "utf8");
  if (original.includes(replacement) && !original.includes(target)) {
    return { file: path.relative(desktopRoot, filePath), name, status: "already-applied" };
  }

  const count = countOccurrences(original, target);
  if (count !== 1) {
    throw new Error(
      `Expected exactly one target for ${name} in ${filePath}, found ${count}.`,
    );
  }

  fs.writeFileSync(filePath, original.replace(target, replacement), "utf8");
  return { file: path.relative(desktopRoot, filePath), name, status: "applied" };
}

function patchSettingsPage(recoveredRoot: string): PatchResult[] {
  const filePath = findFile(path.join(recoveredRoot, "webview", "assets"), /^settings-page-.*\.js$/);

  return [
    replaceExact(
      filePath,
      "enable keyboard shortcuts settings section",
      "h=E(`1981165915`)",
      "h=!0",
    ),
  ];
}

function patchIndex(recoveredRoot: string): PatchResult[] {
  const filePath = findFile(path.join(recoveredRoot, "webview", "assets"), /^index-.*\.js$/);

  return [
    replaceExact(
      filePath,
      "enable keyboard shortcuts command menu entries",
      "y=ms(`1981165915`)",
      "y=!0",
    ),
    replaceExact(
      filePath,
      "include workspace dependencies in default feature map",
      "return{...t,...n,[xE]:ps(e,SE)&&gs(e,bE).groupName===`Test`,...r}",
      "return{...t,...n,workspace_dependencies:!0,[xE]:ps(e,SE)&&gs(e,bE).groupName===`Test`,...r}",
    ),
  ];
}

function patchAgentSettings(recoveredRoot: string): PatchResult[] {
  const filePath = findFile(path.join(recoveredRoot, "webview", "assets"), /^agent-settings-.*\.js$/);

  return [
    replaceExact(
      filePath,
      "show beta feature group and workspace dependencies section",
      "s=oe(W),c=oe(`2106641128`)",
      "s=!0,c=!0",
    ),
  ];
}

function patchMainBundle(recoveredRoot: string): PatchResult[] {
  const filePath = findFile(path.join(recoveredRoot, ".vite", "build"), /^main-.*\.js$/);

  return [
    replaceExact(
      filePath,
      "enable workspace dependencies static gate",
      "function ap(e){return typeof e!=`object`||!e?!1:Object.entries(e).some(([e,t])=>e===`workspace_dependencies`&&t===!0)}",
      "function ap(e){return!0}",
    ),
    replaceExact(
      filePath,
      "enable workspace dependencies app-server feature check",
      "async function op(e){let t=async n=>{let r=await e.sendAppServerRequest(`experimentalFeature/list`,{cursor:n,limit:100});return r.data.some(e=>e.name===`workspace_dependencies`&&e.enabled===!0)?!0:r.nextCursor==null?!1:t(r.nextCursor)};return t(null)}",
      "async function op(e){return!0}",
    ),
  ];
}

function main(): void {
  const recoveredRoot =
    readOption(process.argv.slice(2), "--recovered-root", "-RecoveredRoot") ??
    path.join(desktopRoot, "recovered", "app-asar-extracted");

  if (!fs.existsSync(recoveredRoot)) {
    throw new Error(`Recovered app root does not exist: ${recoveredRoot}`);
  }

  const results = [
    ...patchSettingsPage(recoveredRoot),
    ...patchIndex(recoveredRoot),
    ...patchAgentSettings(recoveredRoot),
    ...patchMainBundle(recoveredRoot),
  ];

  const summary = results
    .map((result) => `${result.status}: ${result.name} (${result.file})`)
    .join("\n");
  console.log(`Patched Windows self-signed bundle:\n${summary}`);
}

main();
