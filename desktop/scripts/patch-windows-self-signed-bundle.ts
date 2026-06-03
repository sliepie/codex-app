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
const workspaceDependencyFeatureMapAppliedPattern =
  /return\{(?=[^{}]*workspace_dependencies:!0)(?=[^{}]*\[[^\]]+\]:[^{}]*?\.groupName===`Test`)[^{}]*\}/;
const packageLocalCacheRelocationAppliedPattern =
  /process\.resourcesPath\?\.replace[\s\S]*?`Packages`[\s\S]*?`LocalCache`[\s\S]*?`Local`/;
const windowsArm64PrimaryRuntimeManifestUrl =
  "https://github.com/sliepie/codex-app/releases/download/codex-primary-runtime-win32-arm64/LATEST.json";
const windowsArm64PrimaryRuntimeManifestUrlPattern = new RegExp(
  escapeRegExp(windowsArm64PrimaryRuntimeManifestUrl),
);
const enabledDesktopFeatureGateIds = [
  "533078438",
  "3789238711",
  "2798711298",
  "2327881676",
  "1488233300",
  "1244621283",
  "1372061905",
  "4100906017",
  "1848317837",
  "2423536643",
] as const;

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

type ReplaceWithPatchersOptions = {
  missingTargetMarkers?: string[];
  required?: boolean;
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function findFileContaining(root: string, pattern: RegExp, markers: string[]): string {
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
      if (!entry.isFile() || !pattern.test(entry.name)) {
        continue;
      }

      const contents = fs.readFileSync(entryPath, "utf8");
      if (markers.every((marker) => contents.includes(marker))) {
        matches.push(entryPath);
      }
    }
  }

  matches.sort();
  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one recovered bundle file matching ${pattern} containing ${markers.join(", ")}, found ${matches.length}.`,
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

function takeAvailableIdentifier(preferred: string, reserved: Set<string>): string {
  let candidate = preferred;
  while (reserved.has(candidate)) {
    candidate = `_${candidate}`;
  }
  reserved.add(candidate);
  return candidate;
}

function exactPatch(target: string, replacement: string): SourcePatcher {
  return (source) => {
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

function skipQuotedString(source: string, start: number): number {
  const quote = source[start];
  let index = start + 1;

  while (index < source.length) {
    const character = source[index];
    if (character === "\\") {
      index += 2;
      continue;
    }
    if (character === quote) {
      return index + 1;
    }
    index += 1;
  }

  throw new Error("Unable to find end of string literal.");
}

function skipLineComment(source: string, start: number): number {
  const end = source.indexOf("\n", start + 2);
  return end === -1 ? source.length : end + 1;
}

function skipBlockComment(source: string, start: number): number {
  const end = source.indexOf("*/", start + 2);
  if (end === -1) {
    throw new Error("Unable to find end of block comment.");
  }
  return end + 2;
}

function skipRegexLiteral(source: string, start: number): number {
  let escaped = false;
  let inCharacterClass = false;
  let index = start + 1;

  while (index < source.length) {
    const character = source[index];
    if (escaped) {
      escaped = false;
      index += 1;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      index += 1;
      continue;
    }
    if (character === "[") {
      inCharacterClass = true;
      index += 1;
      continue;
    }
    if (character === "]") {
      inCharacterClass = false;
      index += 1;
      continue;
    }
    if (character === "/" && !inCharacterClass) {
      index += 1;
      while (/[A-Za-z]/.test(source[index] ?? "")) {
        index += 1;
      }
      return index;
    }
    index += 1;
  }

  throw new Error("Unable to find end of regex literal.");
}

const regexPrefixKeywords = new Set([
  "await",
  "case",
  "delete",
  "else",
  "in",
  "instanceof",
  "of",
  "return",
  "throw",
  "typeof",
  "void",
  "yield",
]);

function previousSignificantToken(source: string, index: number): string | undefined {
  let cursor = index - 1;
  while (cursor >= 0 && /\s/.test(source[cursor] ?? "")) {
    cursor -= 1;
  }
  if (cursor < 0) {
    return undefined;
  }

  const character = source[cursor];
  if (/[A-Za-z0-9_$]/.test(character ?? "")) {
    let start = cursor;
    while (start > 0 && /[A-Za-z0-9_$]/.test(source[start - 1] ?? "")) {
      start -= 1;
    }
    return source.slice(start, cursor + 1);
  }

  return character;
}

function canStartRegex(source: string, index: number): boolean {
  const previousToken = previousSignificantToken(source, index);
  return (
    previousToken == null ||
    regexPrefixKeywords.has(previousToken) ||
    "({[=,:;!&|?+-*~^<>".includes(previousToken)
  );
}

function skipTemplateExpression(source: string, start: number): number {
  let depth = 1;
  let index = start;

  while (index < source.length && depth > 0) {
    const character = source[index];
    const next = source[index + 1];

    if (character === "'" || character === "\"") {
      index = skipQuotedString(source, index);
      continue;
    }
    if (character === "`") {
      index = skipTemplateLiteral(source, index);
      continue;
    }
    if (character === "/" && next === "/") {
      index = skipLineComment(source, index);
      continue;
    }
    if (character === "/" && next === "*") {
      index = skipBlockComment(source, index);
      continue;
    }
    if (character === "/" && canStartRegex(source, index)) {
      index = skipRegexLiteral(source, index);
      continue;
    }

    if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
    }
    index += 1;
  }

  if (depth !== 0) {
    throw new Error("Unable to find end of template expression.");
  }

  return index;
}

function skipTemplateLiteral(source: string, start: number): number {
  let index = start + 1;

  while (index < source.length) {
    const character = source[index];
    if (character === "\\") {
      index += 2;
      continue;
    }
    if (character === "`") {
      return index + 1;
    }
    if (character === "$" && source[index + 1] === "{") {
      index = skipTemplateExpression(source, index + 2);
      continue;
    }
    index += 1;
  }

  throw new Error("Unable to find end of template literal.");
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

function patchWindowsArm64PrimaryRuntimeManifestUrl(): SourcePatcher {
  return functionContainingAllPatch(
    ["latest-alpha", "latest", "oaisidekickupdates.blob.core.windows.net/owl"],
    windowsArm64PrimaryRuntimeManifestUrlPattern,
    (range) => {
      const args = range.args.split(",").map((arg) => arg.trim());
      if (args.length !== 3 || args.some((arg) => !new RegExp(`^${identifierPattern}$`).test(arg))) {
        throw new Error(`Unexpected primary runtime manifest URL helper args: ${range.args}`);
      }

      const [targetArg, configArg, releaseArg] = args;
      const targetExpressionMatch = range.body.match(
        new RegExp(String.raw`\`latest\`,(${identifierPattern}\(${targetArg}\)),`),
      );
      if (!targetExpressionMatch?.[1]) {
        throw new Error("Unable to find primary runtime target expression.");
      }

      return `${range.asyncPrefix}function ${range.name}(${range.args}){if(${configArg}.baseUrl==null&&${releaseArg}===\`latest\`&&${targetExpressionMatch[1]}===\`win32-arm64\`)return\`${windowsArm64PrimaryRuntimeManifestUrl}\`;${range.body}}`;
    },
  );
}

function failIfUnmodifiedBundleContains(evidence: string | RegExp, reason: string): SourcePatcher {
  return (source) => {
    const matched =
      typeof evidence === "string" ? source.includes(evidence) : evidence.test(source);
    if (!matched) {
      return undefined;
    }

    throw new Error(reason);
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
      const next = source[index + 1];
      if (character === "'" || character === "\"") {
        index = skipQuotedString(source, index);
        continue;
      }
      if (character === "`") {
        index = skipTemplateLiteral(source, index);
        continue;
      }
      if (character === "/" && next === "/") {
        index = skipLineComment(source, index);
        continue;
      }
      if (character === "/" && next === "*") {
        index = skipBlockComment(source, index);
        continue;
      }
      if (character === "/" && canStartRegex(source, index)) {
        index = skipRegexLiteral(source, index);
        continue;
      }

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
    const matches = findFunctionRanges(source).filter((range) =>
      markers.every((marker) => range.body.includes(marker)),
    );
    if (alreadyApplied.test(source) && matches.length === 0) {
      return { source, status: "already-applied", matcher: "semantic" };
    }

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

function forceFeatureGateCalls(gateIds: readonly string[]): SourcePatcher {
  const alternation = gateIds.map(escapeRegExp).join("|");
  const markerPattern = new RegExp("`(" + alternation + ")`", "g");
  const callPattern = new RegExp(
    String.raw`\b${identifierPattern}\(` + "`(" + alternation + ")`" + String.raw`\)`,
    "g",
  );

  return (source) => {
    const markerMatches = Array.from(source.matchAll(markerPattern));
    if (markerMatches.length === 0) {
      return undefined;
    }

    const callMatches = Array.from(source.matchAll(callPattern));
    if (callMatches.length === 0) {
      throw new Error(
        `Feature gate marker(s) were found without patchable gate call(s): ${[
          ...new Set(markerMatches.map((match) => match[1])),
        ].join(", ")}`,
      );
    }

    callPattern.lastIndex = 0;
    const nextSource = source.replace(callPattern, "true");
    markerPattern.lastIndex = 0;
    const remainingGateIds = [
      ...new Set(Array.from(nextSource.matchAll(markerPattern)).map((match) => match[1])),
    ];
    if (remainingGateIds.length > 0) {
      throw new Error(
        `Feature gate marker(s) remain after patch: ${remainingGateIds.join(", ")}`,
      );
    }

    return {
      source: nextSource,
      status: nextSource === source ? "already-applied" : "applied",
      matcher: "semantic",
    };
  };
}

function replaceWithPatchers(
  recoveredRoot: string,
  filePath: string,
  name: string,
  patchers: SourcePatcher[],
  options: ReplaceWithPatchersOptions = {},
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

  const missingTargetMarkers = options.missingTargetMarkers ?? [];
  if (options.required) {
    const result = {
      file: reportFile,
      name,
      status: "failed-required" as const,
      reason: "Required patch target was not found.",
    };
    throw new PatchFailure(result, result.reason);
  }

  if (
    missingTargetMarkers.length > 0 &&
    missingTargetMarkers.every((marker) => original.includes(marker))
  ) {
    const result = {
      file: reportFile,
      name,
      status: "failed-required" as const,
      reason: `Gate target was not found, but required marker(s) are still present: ${missingTargetMarkers.join(", ")}`,
    };
    throw new PatchFailure(result, result.reason);
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
      { missingTargetMarkers: ["1981165915"] },
    ),
  ];
}

function patchIndex(recoveredRoot: string): PatchResult[] {
  const filePath = findFileContaining(
    path.join(recoveredRoot, "webview", "assets"),
    /^(?:app-main|index)-.*\.js$/,
    ["electron-desktop-features-changed"],
  );

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
      { missingTargetMarkers: ["1981165915"] },
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
        alreadyAppliedPatch(workspaceDependencyFeatureMapAppliedPattern),
        regexPatch(
          /return\{([^{}]*?)(\[[^\]]+\]:[^{}]*?\.groupName===`Test`)(,\.\.\.[^{}]+?)\}/g,
          (match) => `return{${match[1]}workspace_dependencies:!0,${match[2]}${match[3]}}`,
          workspaceDependencyFeatureMapAppliedPattern,
        ),
      ],
      { missingTargetMarkers: [".groupName===`Test`"] },
    ),
    replaceWithPatchers(
      recoveredRoot,
      filePath,
      "enable selected desktop feature gates",
      [forceFeatureGateCalls(enabledDesktopFeatureGateIds)],
      { missingTargetMarkers: enabledDesktopFeatureGateIds.map((id) => `\`${id}\``) },
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
      { missingTargetMarkers: ["2106641128"] },
    ),
  ];
}

function patchWorkspaceRootDropHandlerBundle(recoveredRoot: string): PatchResult[] {
  const filePath = findFile(
    path.join(recoveredRoot, ".vite", "build"),
    /^workspace-root-drop-handler-.*\.js$/,
  );

  return [
    replaceWithPatchers(
      recoveredRoot,
      filePath,
      "relocate WindowsApps helper executables into package LocalCache",
      [
        regexPatch(
          new RegExp(
            String.raw`\bfunction\s+(${identifierPattern})\(([^)]*)\)\{return\(0,(${identifierPattern})\.join\)\(process\.env\.LOCALAPPDATA\?\?\(0,\3\.join\)\(\(0,(${identifierPattern})\.homedir\)\(\),\`AppData\`,\`Local\`\),\.\.\.\2\)\}`,
            "g",
          ),
          (match) => {
            const functionName = match[1];
            const argumentName = match[2];
            const pathIdentifier = match[3];
            const osIdentifier = match[4];
            const reservedIdentifiers = new Set([
              functionName,
              pathIdentifier,
              osIdentifier,
              ...(argumentName.match(new RegExp(identifierPattern, "g")) ?? []),
            ]);
            const localAppDataIdentifier = takeAvailableIdentifier("t", reservedIdentifiers);
            const packageMatchIdentifier = takeAvailableIdentifier("n", reservedIdentifiers);
            const packageFamilyExpression = `\`${"${"}${packageMatchIdentifier}[1]}_${"${"}${packageMatchIdentifier}[2]}\``;

            return `function ${functionName}(${argumentName}){let ${localAppDataIdentifier}=process.env.LOCALAPPDATA??(0,${pathIdentifier}.join)((0,${osIdentifier}.homedir)(),\`AppData\`,\`Local\`),${packageMatchIdentifier}=process.resourcesPath?.replace(/\\//g,\`\\\\\`).match(/\\\\Program Files\\\\WindowsApps\\\\([^\\\\]+?)_\\d+\\.\\d+\\.\\d+\\.\\d+_[^\\\\]+__([^\\\\]+)\\\\app\\\\resources$/i);return(0,${pathIdentifier}.join)(${packageMatchIdentifier}?(0,${pathIdentifier}.join)(${localAppDataIdentifier},\`Packages\`,${packageFamilyExpression},\`LocalCache\`,\`Local\`):${localAppDataIdentifier},...${argumentName})}`;
          },
          packageLocalCacheRelocationAppliedPattern,
        ),
      ],
      { missingTargetMarkers: ["process.env.LOCALAPPDATA", "`AppData`,`Local`"] },
    ),
    replaceWithPatchers(
      recoveredRoot,
      filePath,
      "route Windows ARM64 primary runtime manifest to GitHub release",
      [
        alreadyAppliedPatch(windowsArm64PrimaryRuntimeManifestUrlPattern),
        patchWindowsArm64PrimaryRuntimeManifestUrl(),
      ],
      { missingTargetMarkers: ["latest-alpha", "oaisidekickupdates.blob.core.windows.net/owl"] },
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
      { missingTargetMarkers: ["Object.entries", "workspace_dependencies"] },
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
      {
        missingTargetMarkers: [
          "sendAppServerRequest(`experimentalFeature/list`",
          "workspace_dependencies",
        ],
      },
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
    results.push(...patchWorkspaceRootDropHandlerBundle(recoveredRoot));
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
