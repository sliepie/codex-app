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
const windowsMenuBarVisibilitySyncAppliedPattern =
  /localStorage\.setItem\(`codex\.windowsMenuBarVisible`[\s\S]*?codex-windows-menu-bar-visibility-changed/;
const windowsMenuBarGeneralSettingsAppliedPattern = /settings\.general\.windowsMenuBar\.label/;
const windowsMenuBarComponentAppliedPattern =
  /codex-windows-menu-bar-visibility-changed/;
const windowsTopBarAlignmentAppliedPattern =
  /group\/windows-top-bar[^`]*\bms-2\b/;
const windowsTitleBarOverlayDefaultHeightPattern = new RegExp(
  String.raw`\b(${identifierPattern})=36,${identifierPattern}=\x60#1f1f1f\x60,${identifierPattern}=\x60#ffffff\x60;function\s+${identifierPattern}\(\)\{return\{color:${identifierPattern},symbolColor:${identifierPattern}\.nativeTheme\.shouldUseDarkColors\?${identifierPattern}:${identifierPattern},height:\1\}\}`,
);
const imagePreviewControlsLoweredPattern =
  /className:`absolute top-3 right-3 z-10 flex items-center gap-2`,style:\{top:`calc\(0\.75rem \+ 26px\)`\},children:\[/;
const sidebarChatsHeadingRightPattern =
  /className:`flex min-w-0 flex-1`,style:\{transform:`translateX\(2px\)`\},children:\(0,[A-Za-z_$][\w$]*\.jsx\)\([A-Za-z_$][\w$]*,\{collapsed:[A-Za-z_$][\w$]*\.chats,/;
const sidebarChatRowsLeftPattern =
  /style:\{transform:`translateX\(-4px\)`\},rowContentClassName:[\s\S]{0,1800}?sidebarThreadRow\(\{[\s\S]{0,250}?kind:`local`/;
const sidebarFooterSettingsLeftPattern =
  /className:`min-w-0 flex-1`,style:\{transform:`translateX\(-1px\)`\},children:\(0,[A-Za-z_$][\w$]*\.jsx\)\([A-Za-z_$][\w$]*,\{triggerButton:/;

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

function windowsMenuBarVisibilitySyncPatch(): SourcePatcher {
  const dispatchPattern = new RegExp(
    String.raw`\b(${identifierPattern})\|\|(${identifierPattern})\.dispatchMessage\(\x60mac-menu-bar-enabled-changed\x60,\{enabled:(${identifierPattern})\}\)`,
  );

  return functionContainingAllPatch(
    ["MAC_MENU_BAR_ENABLED", "mac-menu-bar-enabled-changed"],
    windowsMenuBarVisibilitySyncAppliedPattern,
    (range) => {
      const match = dispatchPattern.exec(range.body);
      if (!match) {
        throw new Error("Unable to find Windows menu bar visibility dispatch.");
      }

      const [, isLoading, bridge, enabled] = match;
      const replacement =
        `if(!${isLoading}){try{localStorage.setItem(\`codex.windowsMenuBarVisible\`,${enabled}?\`1\`:\`0\`),window.dispatchEvent(new Event(\`codex-windows-menu-bar-visibility-changed\`))}catch{}` +
        `${bridge}.dispatchMessage(\`mac-menu-bar-enabled-changed\`,{enabled:${enabled}})}`;
      const body = range.body.slice(0, match.index) +
        replacement +
        range.body.slice((match.index ?? 0) + match[0].length);

      return `${range.asyncPrefix}function ${range.name}(${range.args}){${body}}`;
    },
  );
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
      "sync Windows menu bar visibility setting",
      [
        exactPatch(
          "function Yj(){let e=(0,Z.c)(4),{data:t,isLoading:n}=Zs(z.MAC_MENU_BAR_ENABLED),r=t!==!1,i,a;return e[0]!==n||e[1]!==r?(i=()=>{n||G.dispatchMessage(`mac-menu-bar-enabled-changed`,{enabled:r})},a=[n,r],e[0]=n,e[1]=r,e[2]=i,e[3]=a):(i=e[2],a=e[3]),(0,Q.useEffect)(i,a),null}",
          "function Yj(){let e=(0,Z.c)(4),{data:t,isLoading:n}=Zs(z.MAC_MENU_BAR_ENABLED),r=t!==!1,i,a;return e[0]!==n||e[1]!==r?(i=()=>{if(!n){try{localStorage.setItem(`codex.windowsMenuBarVisible`,r?`1`:`0`),window.dispatchEvent(new Event(`codex-windows-menu-bar-visibility-changed`))}catch{}G.dispatchMessage(`mac-menu-bar-enabled-changed`,{enabled:r})}},a=[n,r],e[0]=n,e[1]=r,e[2]=i,e[3]=a):(i=e[2],a=e[3]),(0,Q.useEffect)(i,a),null}",
        ),
        exactPatch(
          "function Ok(){let e=(0,Z.c)(4),{data:t,isLoading:n}=mc(ii.MAC_MENU_BAR_ENABLED),r=t!==!1,i,a;return e[0]!==n||e[1]!==r?(i=()=>{n||J.dispatchMessage(`mac-menu-bar-enabled-changed`,{enabled:r})},a=[n,r],e[0]=n,e[1]=r,e[2]=i,e[3]=a):(i=e[2],a=e[3]),(0,Q.useEffect)(i,a),null}",
          "function Ok(){let e=(0,Z.c)(4),{data:t,isLoading:n}=mc(ii.MAC_MENU_BAR_ENABLED),r=t!==!1,i,a;return e[0]!==n||e[1]!==r?(i=()=>{if(!n){try{localStorage.setItem(`codex.windowsMenuBarVisible`,r?`1`:`0`),window.dispatchEvent(new Event(`codex-windows-menu-bar-visibility-changed`))}catch{}J.dispatchMessage(`mac-menu-bar-enabled-changed`,{enabled:r})}},a=[n,r],e[0]=n,e[1]=r,e[2]=i,e[3]=a):(i=e[2],a=e[3]),(0,Q.useEffect)(i,a),null}",
        ),
        alreadyAppliedPatch(windowsMenuBarVisibilitySyncAppliedPattern),
        windowsMenuBarVisibilitySyncPatch(),
      ],
      {
        missingTargetMarkers: ["MAC_MENU_BAR_ENABLED", "mac-menu-bar-enabled-changed"],
        required: true,
      },
    ),
    replaceWithPatchers(
      recoveredRoot,
      filePath,
      "nudge sidebar Chats heading right",
      [
        regexPatch(
          new RegExp(
            String.raw`className:\x60flex min-w-0 flex-1(?: translate-x-px)?\x60,children:\(0,(${identifierPattern})\.jsx\)\((${identifierPattern}),\{collapsed:(${identifierPattern})\.chats,`,
            "g",
          ),
          (match) =>
            `className:\`flex min-w-0 flex-1\`,style:{transform:\`translateX(2px)\`},children:(0,${match[1]}.jsx)(${match[2]},{collapsed:${match[3]}.chats,`,
          sidebarChatsHeadingRightPattern,
        ),
      ],
      { missingTargetMarkers: ["sidebarElectron.recentChats", ".chats"] },
    ),
    replaceWithPatchers(
      recoveredRoot,
      filePath,
      "nudge recent chat rows left",
      [
        regexPatch(
          new RegExp(
            String.raw`(?<!style:\{transform:\x60translateX\(-4px\)\x60\},)(rowContentClassName:)(?=[\s\S]{0,1800}?dataAttributes:${identifierPattern}\.sidebarThreadRow\(\{[\s\S]{0,250}?kind:\x60local\x60)`,
            "g",
          ),
          (match) =>
            `style:{transform:\`translateX(-4px)\`},${match[1]}`,
          sidebarChatRowsLeftPattern,
        ),
      ],
      {
        missingTargetMarkers: [
          "rowContentClassName",
          "sidebarThreadRow",
        ],
      },
    ),
    replaceWithPatchers(
      recoveredRoot,
      filePath,
      "nudge sidebar footer settings button left",
      [
        regexPatch(
          new RegExp(
            String.raw`className:\x60min-w-0 flex-1\x60,children:\(0,${identifierPattern}\.jsx\)\(${identifierPattern},\{triggerButton:\(0,${identifierPattern}\.jsx\)\(${identifierPattern},\{icon:${identifierPattern},label:${identifierPattern},onClick:${identifierPattern},trailing:${identifierPattern},iconClassName:\x60icon-sm\x60\}\)\}\)`,
            "g",
          ),
          (match) =>
            match[0].replace(
              "className:`min-w-0 flex-1`,",
              "className:`min-w-0 flex-1`,style:{transform:`translateX(-1px)`},",
            ),
          sidebarFooterSettingsLeftPattern,
        ),
      ],
      {
        missingTargetMarkers: [
          "codex.profileFooter.signedInFallback",
          "iconClassName:`icon-sm`",
        ],
      },
    ),
  ];
}

function patchGeneralSettings(recoveredRoot: string): PatchResult[] {
  const filePath = findFileContaining(
    path.join(recoveredRoot, "webview", "assets"),
    /^general-settings-.*\.js$/,
    ["MAC_MENU_BAR_ENABLED", "settings.general.macMenuBar.label"],
  );

  return [
    replaceWithPatchers(
      recoveredRoot,
      filePath,
      "show menu bar setting on Windows",
      [
        exactPatch(
          "function ir(){let e=(0,Q.c)(11),t=S(j),n=F(),{platform:r}=me(),{data:a,isLoading:o}=V(i.MAC_MENU_BAR_ENABLED);if(r!==`macOS`)return null;let s,c;e[0]===Symbol.for(`react.memo_cache_sentinel`)?(s=(0,$.jsx)(N,{id:`settings.general.macMenuBar.label`,defaultMessage:`Show in menu bar`,description:`Label for the macOS menu bar setting`}),c=(0,$.jsx)(N,{id:`settings.general.macMenuBar.description`,defaultMessage:`Keep Codex in the macOS menu bar when the main window is closed`,description:`Description for the macOS menu bar setting`}),e[0]=s,e[1]=c):(s=e[0],c=e[1]);let l=a!==!1,u;e[2]===t?u=e[3]:(u=e=>{L(t,i.MAC_MENU_BAR_ENABLED,e)},e[2]=t,e[3]=u);let d;e[4]===n?d=e[5]:(d=n.formatMessage({id:`settings.general.macMenuBar.ariaLabel`,defaultMessage:`Show Codex in the menu bar`,description:`Aria label for the macOS menu bar setting toggle`}),e[4]=n,e[5]=d);let f;return e[6]!==o||e[7]!==l||e[8]!==u||e[9]!==d?(f=(0,$.jsx)(J,{label:s,description:c,control:(0,$.jsx)(q,{checked:l,disabled:o,onChange:u,ariaLabel:d})}),e[6]=o,e[7]=l,e[8]=u,e[9]=d,e[10]=f):f=e[10],f}",
          "function ir(){let e=(0,Q.c)(11),t=S(j),n=F(),{platform:r}=me(),{data:a,isLoading:o}=V(i.MAC_MENU_BAR_ENABLED);if(r!==`macOS`&&r!==`windows`)return null;let s,c;e[0]===Symbol.for(`react.memo_cache_sentinel`)?(s=r===`windows`?(0,$.jsx)(N,{id:`settings.general.windowsMenuBar.label`,defaultMessage:`Show menu bar`,description:`Label for the Windows menu bar setting`}):(0,$.jsx)(N,{id:`settings.general.macMenuBar.label`,defaultMessage:`Show in menu bar`,description:`Label for the macOS menu bar setting`}),c=r===`windows`?(0,$.jsx)(N,{id:`settings.general.windowsMenuBar.description`,defaultMessage:`Show the File, Edit, View, Window, and Help menu at the top of the window`,description:`Description for the Windows menu bar setting`}):(0,$.jsx)(N,{id:`settings.general.macMenuBar.description`,defaultMessage:`Keep Codex in the macOS menu bar when the main window is closed`,description:`Description for the macOS menu bar setting`}),e[0]=s,e[1]=c):(s=e[0],c=e[1]);let l=a!==!1,u;e[2]===t?u=e[3]:(u=e=>{L(t,i.MAC_MENU_BAR_ENABLED,e)},e[2]=t,e[3]=u);let d;e[4]===n?d=e[5]:(d=r===`windows`?n.formatMessage({id:`settings.general.windowsMenuBar.ariaLabel`,defaultMessage:`Show the window menu bar`,description:`Aria label for the Windows menu bar setting toggle`}):n.formatMessage({id:`settings.general.macMenuBar.ariaLabel`,defaultMessage:`Show Codex in the menu bar`,description:`Aria label for the macOS menu bar setting toggle`}),e[4]=n,e[5]=d);let f;return e[6]!==o||e[7]!==l||e[8]!==u||e[9]!==d?(f=(0,$.jsx)(J,{label:s,description:c,control:(0,$.jsx)(q,{checked:l,disabled:o,onChange:u,ariaLabel:d})}),e[6]=o,e[7]=l,e[8]=u,e[9]=d,e[10]=f):f=e[10],f}",
        ),
        exactPatch(
          "function ir(){let e=(0,Q.c)(11),t=x(u),n=L(),{platform:r}=ge(),{data:i,isLoading:a}=V(y.MAC_MENU_BAR_ENABLED);if(r!==`macOS`)return null;let o,s;e[0]===Symbol.for(`react.memo_cache_sentinel`)?(o=(0,$.jsx)(I,{id:`settings.general.macMenuBar.label`,defaultMessage:`Show in menu bar`,description:`Label for the macOS menu bar setting`}),s=(0,$.jsx)(I,{id:`settings.general.macMenuBar.description`,defaultMessage:`Keep Codex in the macOS menu bar when the main window is closed`,description:`Description for the macOS menu bar setting`}),e[0]=o,e[1]=s):(o=e[0],s=e[1]);let c=i!==!1,l;e[2]===t?l=e[3]:(l=e=>{ie(t,y.MAC_MENU_BAR_ENABLED,e)},e[2]=t,e[3]=l);let d;e[4]===n?d=e[5]:(d=n.formatMessage({id:`settings.general.macMenuBar.ariaLabel`,defaultMessage:`Show Codex in the menu bar`,description:`Aria label for the macOS menu bar setting toggle`}),e[4]=n,e[5]=d);let f;return e[6]!==a||e[7]!==c||e[8]!==l||e[9]!==d?(f=(0,$.jsx)(J,{label:o,description:s,control:(0,$.jsx)(q,{checked:c,disabled:a,onChange:l,ariaLabel:d})}),e[6]=a,e[7]=c,e[8]=l,e[9]=d,e[10]=f):f=e[10],f}",
          "function ir(){let e=(0,Q.c)(11),t=x(u),n=L(),{platform:r}=ge(),{data:i,isLoading:a}=V(y.MAC_MENU_BAR_ENABLED);if(r!==`macOS`&&r!==`windows`)return null;let o,s;e[0]===Symbol.for(`react.memo_cache_sentinel`)?(o=r===`windows`?(0,$.jsx)(I,{id:`settings.general.windowsMenuBar.label`,defaultMessage:`Show menu bar`,description:`Label for the Windows menu bar setting`}):(0,$.jsx)(I,{id:`settings.general.macMenuBar.label`,defaultMessage:`Show in menu bar`,description:`Label for the macOS menu bar setting`}),s=r===`windows`?(0,$.jsx)(I,{id:`settings.general.windowsMenuBar.description`,defaultMessage:`Show the File, Edit, View, Window, and Help menu at the top of the window`,description:`Description for the Windows menu bar setting`}):(0,$.jsx)(I,{id:`settings.general.macMenuBar.description`,defaultMessage:`Keep Codex in the macOS menu bar when the main window is closed`,description:`Description for the macOS menu bar setting`}),e[0]=o,e[1]=s):(o=e[0],s=e[1]);let c=i!==!1,l;e[2]===t?l=e[3]:(l=e=>{ie(t,y.MAC_MENU_BAR_ENABLED,e)},e[2]=t,e[3]=l);let d;e[4]===n?d=e[5]:(d=r===`windows`?n.formatMessage({id:`settings.general.windowsMenuBar.ariaLabel`,defaultMessage:`Show the window menu bar`,description:`Aria label for the Windows menu bar setting toggle`}):n.formatMessage({id:`settings.general.macMenuBar.ariaLabel`,defaultMessage:`Show Codex in the menu bar`,description:`Aria label for the macOS menu bar setting toggle`}),e[4]=n,e[5]=d);let f;return e[6]!==a||e[7]!==c||e[8]!==l||e[9]!==d?(f=(0,$.jsx)(J,{label:o,description:s,control:(0,$.jsx)(q,{checked:c,disabled:a,onChange:l,ariaLabel:d})}),e[6]=a,e[7]=c,e[8]=l,e[9]=d,e[10]=f):f=e[10],f}",
        ),
        alreadyAppliedPatch(windowsMenuBarGeneralSettingsAppliedPattern),
      ],
      { missingTargetMarkers: ["MAC_MENU_BAR_ENABLED", "settings.general.macMenuBar.label"] },
    ),
  ];
}

function patchAppShell(recoveredRoot: string): PatchResult[] {
  const filePath = findFileContaining(
    path.join(recoveredRoot, "webview", "assets"),
    /^app-shell-.*\.js$/,
    ["showApplicationMenu", "windowsMenuBar.file", "group/windows-top-bar"],
  );

  return [
    replaceWithPatchers(
      recoveredRoot,
      filePath,
      "make Windows menu bar hideable",
      [
        exactPatch(
          "function Zt(){let e=we(),t=Jt(),[n,r]=(0,$.useState)(null),i=(0,$.useRef)(0);if(!t)return null;let a=async(e,t)=>{let n=window.electronBridge?.showApplicationMenu;if(!n)return;let a=i.current+1;i.current=a,r(e);let o=t.currentTarget.getBoundingClientRect();try{await n(e,Math.round(o.left),Math.round(o.bottom))}finally{i.current===a&&r(null)}};return(0,Q.jsx)(`div`,{className:`flex items-center gap-0.5 pr-2 pl-1`,children:Xt.map(({id:t,message:r})=>(0,Q.jsx)(`button`,{type:`button`,\"aria-expanded\":n===t,\"aria-haspopup\":`menu`,\"aria-label\":e.formatMessage(r),className:K(`no-drag rounded-md border border-transparent px-2.5 py-1 text-base font-normal leading-none outline-none transition-colors`,n===t?`bg-[var(--color-token-menubar-selection-background)] text-[var(--color-token-menubar-selection-foreground)]`:`text-token-text-tertiary hover:bg-token-foreground/5 hover:text-token-description-foreground focus-visible:bg-token-foreground/5 focus-visible:text-token-description-foreground`),onClick:e=>{a(t,e)},children:(0,Q.jsx)(Y,{...r})},t))})}",
          "function Zt(){let e=we(),t=Jt(),[n,r]=(0,$.useState)(null),[i,a]=(0,$.useState)(()=>localStorage.getItem(`codex.windowsMenuBarVisible`)!==`0`),o=(0,$.useRef)(0);(0,$.useEffect)(()=>{let e=()=>{a(localStorage.getItem(`codex.windowsMenuBarVisible`)!==`0`)};return window.addEventListener(`codex-windows-menu-bar-visibility-changed`,e),window.addEventListener(`storage`,e),()=>{window.removeEventListener(`codex-windows-menu-bar-visibility-changed`,e),window.removeEventListener(`storage`,e)}},[]);if(!t||!i)return null;let s=async(e,t)=>{let n=window.electronBridge?.showApplicationMenu;if(!n)return;let i=o.current+1;o.current=i,r(e);let a=t.currentTarget.getBoundingClientRect();try{await n(e,Math.round(a.left),Math.round(a.bottom))}finally{o.current===i&&r(null)}};return(0,Q.jsx)(`div`,{className:`flex items-center gap-0.5 pr-2 pl-1`,children:Xt.map(({id:t,message:r})=>(0,Q.jsx)(`button`,{type:`button`,\"aria-expanded\":n===t,\"aria-haspopup\":`menu`,\"aria-label\":e.formatMessage(r),className:K(`no-drag rounded-md border border-transparent px-2.5 py-1 text-base font-normal leading-none outline-none transition-colors`,n===t?`bg-[var(--color-token-menubar-selection-background)] text-[var(--color-token-menubar-selection-foreground)]`:`text-token-text-tertiary hover:bg-token-foreground/5 hover:text-token-description-foreground focus-visible:bg-token-foreground/5 focus-visible:text-token-description-foreground`),onClick:e=>{s(t,e)},children:(0,Q.jsx)(Y,{...r})},t))})}",
        ),
        exactPatch(
          "function Jt(){let e=Ee(),t=Gt(),[n,r]=(0,$.useState)(null),i=(0,$.useRef)(0);if(!t)return null;let a=async(e,t)=>{let n=window.electronBridge?.showApplicationMenu;if(!n)return;let a=i.current+1;i.current=a,r(e);let o=t.currentTarget.getBoundingClientRect();try{await n(e,Math.round(o.left),Math.round(o.bottom))}finally{i.current===a&&r(null)}};return(0,Q.jsx)(`div`,{className:`flex items-center gap-0.5 pr-2 pl-1`,children:qt.map(({id:t,message:r})=>(0,Q.jsx)(`button`,{type:`button`,\"aria-expanded\":n===t,\"aria-haspopup\":`menu`,\"aria-label\":e.formatMessage(r),className:Y(`no-drag rounded-md border border-transparent px-2.5 py-1 text-base font-normal leading-none outline-none transition-colors`,n===t?`bg-[var(--color-token-menubar-selection-background)] text-[var(--color-token-menubar-selection-foreground)]`:`text-token-text-tertiary hover:bg-token-foreground/5 hover:text-token-description-foreground focus-visible:bg-token-foreground/5 focus-visible:text-token-description-foreground`),onClick:e=>{a(t,e)},children:(0,Q.jsx)(Ce,{...r})},t))})}",
          "function Jt(){let e=Ee(),t=Gt(),[n,r]=(0,$.useState)(null),[i,a]=(0,$.useState)(()=>localStorage.getItem(`codex.windowsMenuBarVisible`)!==`0`),o=(0,$.useRef)(0);(0,$.useEffect)(()=>{let e=()=>{a(localStorage.getItem(`codex.windowsMenuBarVisible`)!==`0`)};return window.addEventListener(`codex-windows-menu-bar-visibility-changed`,e),window.addEventListener(`storage`,e),()=>{window.removeEventListener(`codex-windows-menu-bar-visibility-changed`,e),window.removeEventListener(`storage`,e)}},[]);if(!t||!i)return null;let s=async(e,t)=>{let n=window.electronBridge?.showApplicationMenu;if(!n)return;let i=o.current+1;o.current=i,r(e);let a=t.currentTarget.getBoundingClientRect();try{await n(e,Math.round(a.left),Math.round(a.bottom))}finally{o.current===i&&r(null)}};return(0,Q.jsx)(`div`,{className:`flex items-center gap-0.5 pr-2 pl-1`,children:qt.map(({id:t,message:r})=>(0,Q.jsx)(`button`,{type:`button`,\"aria-expanded\":n===t,\"aria-haspopup\":`menu`,\"aria-label\":e.formatMessage(r),className:Y(`no-drag rounded-md border border-transparent px-2.5 py-1 text-base font-normal leading-none outline-none transition-colors`,n===t?`bg-[var(--color-token-menubar-selection-background)] text-[var(--color-token-menubar-selection-foreground)]`:`text-token-text-tertiary hover:bg-token-foreground/5 hover:text-token-description-foreground focus-visible:bg-token-foreground/5 focus-visible:text-token-description-foreground`),onClick:e=>{s(t,e)},children:(0,Q.jsx)(Ce,{...r})},t))})}",
        ),
        alreadyAppliedPatch(windowsMenuBarComponentAppliedPattern),
      ],
      { missingTargetMarkers: ["showApplicationMenu", "windowsMenuBar.file"] },
    ),
    replaceWithPatchers(
      recoveredRoot,
      filePath,
      "align Windows sidebar trigger with sidebar rows",
      [
        exactPatch(
          "app-header-tint draggable group/windows-top-bar z-40 flex h-toolbar-sm items-center ps-(--spacing-token-safe-header-left) pe-(--spacing-token-safe-header-right)",
          "app-header-tint draggable group/windows-top-bar z-40 flex h-toolbar-sm items-center ps-(--spacing-token-safe-header-left) ms-2 pe-(--spacing-token-safe-header-right)",
        ),
        alreadyAppliedPatch(windowsTopBarAlignmentAppliedPattern),
      ],
      { missingTargetMarkers: ["group/windows-top-bar", "ps-(--spacing-token-safe-header-left)"] },
    ),
    replaceWithPatchers(
      recoveredRoot,
      filePath,
      "nudge sidebar trigger button right",
      [
        exactPatch(
          "u=c==null?void 0:{viewTransitionName:c}",
          "u=c==null?void 0:{viewTransitionName:c,transform:`translateX(2px)`}",
        ),
        alreadyAppliedPatch("u=c==null?void 0:{viewTransitionName:c,transform:`translateX(2px)`}"),
      ],
      { missingTargetMarkers: ["viewTransitionName:`sidebar-trigger`", "viewTransitionName:c"] },
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

function patchImagePreview(recoveredRoot: string): PatchResult[] {
  const filePath = findFileContaining(
    path.join(recoveredRoot, "webview", "assets"),
    /^(?:image-preview-dialog|use-model-settings)-.*\.js$/,
    ["imagePreviewDialog.download", "absolute top-3 right-3 z-10 flex items-center gap-2"],
  );

  return [
    replaceWithPatchers(
      recoveredRoot,
      filePath,
      "move image preview controls below Windows title bar",
      [
        regexPatch(
          new RegExp(
            String.raw`\(0,(${identifierPattern})\.jsxs\)\(\`div\`,\{className:\`absolute top-3 right-3 z-10 flex items-center gap-2\`,children:\[(${identifierPattern}),(${identifierPattern})\]\}\)`,
            "g",
          ),
          (match) =>
            `(0,${match[1]}.jsxs)(\`div\`,{className:\`absolute top-3 right-3 z-10 flex items-center gap-2\`,style:{top:\`calc(0.75rem + 26px)\`},children:[${match[2]},${match[3]}]})`,
          imagePreviewControlsLoweredPattern,
        ),
      ],
      {
        missingTargetMarkers: [
          "imagePreviewDialog.download",
          "absolute top-3 right-3 z-10 flex items-center gap-2",
        ],
      },
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
  ];
}

function patchMainBundle(recoveredRoot: string): PatchResult[] {
  const filePath = findFile(path.join(recoveredRoot, ".vite", "build"), /^main-.*\.js$/);

  return [
    replaceWithPatchers(
      recoveredRoot,
      filePath,
      "restore Windows title bar overlay controls height",
      [
        regexPatch(
          new RegExp(
            String.raw`\b(${identifierPattern})=(?:96|106),(${identifierPattern})=\x60#1f1f1f\x60,(${identifierPattern})=\x60#ffffff\x60;function\s+(${identifierPattern})\(\)\{return\{color:(${identifierPattern}),symbolColor:(${identifierPattern})\.nativeTheme\.shouldUseDarkColors\?\3:\2,height:\1\}\}`,
            "g",
          ),
          (match) => {
            const heightName = match[1];
            const darkSymbolName = match[2];
            const lightSymbolName = match[3];
            const functionName = match[4];
            const colorName = match[5];
            const electronName = match[6];

            return `${heightName}=36,${darkSymbolName}=\`#1f1f1f\`,${lightSymbolName}=\`#ffffff\`;function ${functionName}(){return{color:${colorName},symbolColor:${electronName}.nativeTheme.shouldUseDarkColors?${lightSymbolName}:${darkSymbolName},height:${heightName}}}`;
          },
          windowsTitleBarOverlayDefaultHeightPattern,
        ),
      ],
      { missingTargetMarkers: ["titleBarOverlay", "height:"] },
    ),
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
    results.push(...patchGeneralSettings(recoveredRoot));
    results.push(...patchAppShell(recoveredRoot));
    results.push(...patchAgentSettings(recoveredRoot));
    results.push(...patchImagePreview(recoveredRoot));
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
