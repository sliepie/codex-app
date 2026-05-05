import fs from "node:fs";
import path from "node:path";

type PatchStatus = "applied" | "already-applied" | "assumed-enabled" | "failed-required";

type PatchResult = {
  file: string;
  name: string;
  status: PatchStatus;
  matcher?: string;
  reason?: string;
};

const desktopRoot = process.cwd();
const identifierPattern = String.raw`[A-Za-z_$][\w$]*`;

type SourcePatchResult = {
  source: string;
  status: PatchStatus;
  matcher: string;
};

type SourcePatcher = (source: string) => SourcePatchResult | undefined;
type FunctionRange = {
  asyncPrefix: string;
  name: string;
  args: string;
  body: string;
  start: number;
  end: number;
};

class PatchFailure extends Error {
  result: PatchResult;

  constructor(result: PatchResult, cause: unknown) {
    super(`${result.name}: ${errorMessage(cause)}`);
    this.name = "PatchFailure";
    this.result = result;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

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

function toReportPath(root: string, filePath: string): string {
  const resolvedRoot = path.resolve(root);
  const resolvedFile = path.resolve(filePath);
  const relative = path.relative(resolvedRoot, resolvedFile);

  if (!relative) {
    return ".";
  }
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Cannot report path outside recovered app root: ${filePath}`);
  }

  return relative.replaceAll(path.sep, path.posix.sep);
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

      pattern.lastIndex = 0;
      if (entry.isFile() && pattern.test(entry.name)) {
        matches.push(entryPath);
      }
    }
  }

  matches.sort();
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

function exactPatch(target: string, replacement: string): SourcePatcher {
  return (source) => {
    if (source.includes(replacement) && !source.includes(target)) {
      return { source, status: "already-applied", matcher: "exact" };
    }

    const count = countOccurrences(source, target);
    if (count === 0) {
      return undefined;
    }
    if (count !== 1) {
      throw new Error(`Expected exactly one exact target, found ${count}.`);
    }

    return {
      source: source.replace(target, replacement),
      status: "applied",
      matcher: "exact",
    };
  };
}

function regexPatch(
  pattern: RegExp,
  replacement: string | ((match: RegExpExecArray) => string),
  alreadyApplied?: RegExp,
): SourcePatcher {
  return (source) => {
    if (alreadyApplied) {
      alreadyApplied.lastIndex = 0;
    }
    pattern.lastIndex = 0;
    if (alreadyApplied?.test(source) && !pattern.test(source)) {
      return { source, status: "already-applied", matcher: "semantic" };
    }
    pattern.lastIndex = 0;

    const matches = Array.from(source.matchAll(pattern));
    if (matches.length === 0) {
      return undefined;
    }
    if (matches.length !== 1) {
      throw new Error(`Expected exactly one semantic target, found ${matches.length}.`);
    }

    const match = matches[0];
    const nextSource =
      typeof replacement === "string"
        ? source.replace(pattern, replacement)
        : source.slice(0, match.index) +
          replacement(match) +
          source.slice((match.index ?? 0) + match[0].length);

    return {
      source: nextSource,
      status: nextSource === source ? "already-applied" : "applied",
      matcher: "semantic",
    };
  };
}

function alreadyAppliedPatch(evidence: string | RegExp): SourcePatcher {
  return (source) => {
    const applied =
      typeof evidence === "string" ? source.includes(evidence) : evidence.test(source);
    if (!applied) {
      return undefined;
    }

    return { source, status: "already-applied", matcher: "semantic" };
  };
}

function findFunctionRanges(source: string): FunctionRange[] {
  const ranges: FunctionRange[] = [];
  const functionPattern = /\b(async\s+)?function\s+([A-Za-z_$][\w$]*)\(([^)]*)\)\{/g;
  let match: RegExpExecArray | null;

  while ((match = functionPattern.exec(source)) !== null) {
    let depth = 1;
    let index = functionPattern.lastIndex;
    while (index < source.length && depth > 0) {
      const character = source[index];
      if (character === "{") {
        depth += 1;
      } else if (character === "}") {
        depth -= 1;
      }
      index += 1;
    }

    if (depth !== 0) {
      throw new Error(`Unable to find end of function ${match[2]}.`);
    }

    ranges.push({
      asyncPrefix: match[1] ?? "",
      name: match[2],
      args: match[3],
      body: source.slice(functionPattern.lastIndex, index - 1),
      start: match.index,
      end: index,
    });
  }

  return ranges;
}

function functionContainingAllPatch(
  markers: string[],
  alreadyApplied: RegExp,
  replacement: (range: FunctionRange) => string,
): SourcePatcher {
  return (source) => {
    if (alreadyApplied.test(source) && !markers.some((marker) => source.includes(marker))) {
      return { source, status: "already-applied", matcher: "semantic" };
    }

    const matches = findFunctionRanges(source).filter((range) =>
      markers.every((marker) => range.body.includes(marker)),
    );
    if (matches.length === 0) {
      return undefined;
    }
    if (matches.length !== 1) {
      throw new Error(
        `Expected exactly one function containing ${markers.join(", ")}, found ${matches.length}.`,
      );
    }

    const match = matches[0];
    return {
      source: source.slice(0, match.start) + replacement(match) + source.slice(match.end),
      status: "applied",
      matcher: "semantic",
    };
  };
}

function replaceWithPatchers(
  recoveredRoot: string,
  filePath: string,
  name: string,
  patchers: SourcePatcher[],
): PatchResult {
  const reportFile = toReportPath(recoveredRoot, filePath);
  const original = fs.readFileSync(filePath, "utf8");
  for (const patcher of patchers) {
    let result: SourcePatchResult | undefined;
    try {
      result = patcher(original);
    } catch (error) {
      throw new PatchFailure(
        {
          file: reportFile,
          name,
          status: "failed-required",
          reason: errorMessage(error),
        },
        error,
      );
    }
    if (!result) {
      continue;
    }

    if (result.source !== original) {
      fs.writeFileSync(filePath, result.source, "utf8");
    }

    return {
      file: reportFile,
      name,
      status: result.status,
      matcher: result.matcher,
    };
  }

  return {
    file: reportFile,
    name,
    status: "assumed-enabled",
    reason: "Gate target was not found; assuming upstream removed or enabled this gate.",
  };
}

function patchSettingsPage(recoveredRoot: string): PatchResult[] {
  const filePath = findFile(path.join(recoveredRoot, "webview", "assets"), /^settings-page-.*\.js$/);

  return [
    replaceWithPatchers(
      recoveredRoot,
      filePath,
      "enable keyboard shortcuts settings section",
      [
        exactPatch("h=E(`1981165915`)", "h=!0"),
        regexPatch(
          new RegExp(String.raw`\b(${identifierPattern}=)${identifierPattern}\(\`1981165915\`\)`, "g"),
          "$1!0",
        ),
      ],
    ),
  ];
}

function patchIndex(recoveredRoot: string): PatchResult[] {
  const filePath = findFile(path.join(recoveredRoot, "webview", "assets"), /^index-.*\.js$/);

  return [
    replaceWithPatchers(
      recoveredRoot,
      filePath,
      "enable keyboard shortcuts command menu entries",
      [
        exactPatch("y=ms(`1981165915`)", "y=!0"),
        regexPatch(
          new RegExp(String.raw`\b(${identifierPattern}=)${identifierPattern}\(\`1981165915\`\)`, "g"),
          "$1!0",
        ),
      ],
    ),
    replaceWithPatchers(
      recoveredRoot,
      filePath,
      "include workspace dependencies in default feature map",
      [
        exactPatch(
          "return{...t,...n,[xE]:ps(e,SE)&&gs(e,bE).groupName===`Test`,...r}",
          "return{...t,...n,workspace_dependencies:!0,[xE]:ps(e,SE)&&gs(e,bE).groupName===`Test`,...r}",
        ),
        alreadyAppliedPatch("workspace_dependencies:!0"),
        regexPatch(
          /return\{([^{}]*?)(\[[^\]]+\]:[^{}]*?\.groupName===`Test`)(,\.\.\.[^{}]+?)\}/g,
          (match) => `return{${match[1]}workspace_dependencies:!0,${match[2]}${match[3]}}`,
          /workspace_dependencies:!0/,
        ),
      ],
    ),
  ];
}

function patchAgentSettings(recoveredRoot: string): PatchResult[] {
  const filePath = findFile(path.join(recoveredRoot, "webview", "assets"), /^agent-settings-.*\.js$/);

  return [
    replaceWithPatchers(
      recoveredRoot,
      filePath,
      "show beta feature group and workspace dependencies section",
      [
        exactPatch("s=oe(W),c=oe(`2106641128`)", "s=!0,c=!0"),
        regexPatch(
          new RegExp(
            String.raw`\b(${identifierPattern}=)${identifierPattern}\(${identifierPattern}\),(${identifierPattern}=)${identifierPattern}\(\`2106641128\`\)`,
            "g",
          ),
          "$1!0,$2!0",
        ),
      ],
    ),
  ];
}

function patchMainBundle(recoveredRoot: string): PatchResult[] {
  const filePath = findFile(path.join(recoveredRoot, ".vite", "build"), /^main-.*\.js$/);

  return [
    replaceWithPatchers(
      recoveredRoot,
      filePath,
      "enable workspace dependencies static gate",
      [
        exactPatch(
          "function ap(e){return typeof e!=`object`||!e?!1:Object.entries(e).some(([e,t])=>e===`workspace_dependencies`&&t===!0)}",
          "function ap(e){return!0}",
        ),
        functionContainingAllPatch(
          ["Object.entries", "workspace_dependencies"],
          /\bfunction\s+[A-Za-z_$][\w$]*\([^)]*\)\{return!0\}/,
          (range) => `function ${range.name}(${range.args}){return!0}`,
        ),
      ],
    ),
    replaceWithPatchers(
      recoveredRoot,
      filePath,
      "enable workspace dependencies app-server feature check",
      [
        exactPatch(
          "async function op(e){let t=async n=>{let r=await e.sendAppServerRequest(`experimentalFeature/list`,{cursor:n,limit:100});return r.data.some(e=>e.name===`workspace_dependencies`&&e.enabled===!0)?!0:r.nextCursor==null?!1:t(r.nextCursor)};return t(null)}",
          "async function op(e){return!0}",
        ),
        functionContainingAllPatch(
          ["sendAppServerRequest(`experimentalFeature/list`", "workspace_dependencies"],
          /\basync\s+function\s+[A-Za-z_$][\w$]*\([^)]*\)\{return!0\}/,
          (range) => `${range.asyncPrefix}function ${range.name}(${range.args}){return!0}`,
        ),
      ],
    ),
  ];
}

function writePatchReport(reportPath: string, recoveredRoot: string, patches: PatchResult[]): void {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        target: path.basename(path.resolve(recoveredRoot)),
        patches,
      },
      null,
      2,
    ),
    "utf8",
  );
}

function main(): void {
  const argv = process.argv.slice(2);
  const recoveredRoot =
    readOption(argv, "--recovered-root", "-RecoveredRoot") ??
    path.join(desktopRoot, "recovered", "app-asar-extracted");
  const reportPath = readOption(argv, "--report-json", "-ReportJson");

  if (!fs.existsSync(recoveredRoot)) {
    throw new Error(`Recovered app root does not exist: ${recoveredRoot}`);
  }

  const results: PatchResult[] = [];
  try {
    results.push(...patchSettingsPage(recoveredRoot));
    results.push(...patchIndex(recoveredRoot));
    results.push(...patchAgentSettings(recoveredRoot));
    results.push(...patchMainBundle(recoveredRoot));
  } catch (error) {
    if (error instanceof PatchFailure) {
      results.push(error.result);
    } else {
      results.push({
        file: ".",
        name: "patch Windows self-signed bundle",
        status: "failed-required",
        reason: errorMessage(error),
      });
    }

    if (reportPath) {
      writePatchReport(reportPath, recoveredRoot, results);
    }
    throw error;
  }

  const summary = results
    .map((result) => {
      const matcher = result.matcher ? `, ${result.matcher}` : "";
      const reason = result.reason ? ` - ${result.reason}` : "";
      return `${result.status}: ${result.name} (${result.file}${matcher})${reason}`;
    })
    .join("\n");
  console.log(`Patched Windows self-signed bundle:\n${summary}`);

  if (reportPath) {
    writePatchReport(reportPath, recoveredRoot, results);
  }
}

main();
