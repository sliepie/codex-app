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
const windowsTitleBarOverlayDefaultHeightPattern = new RegExp(
  String.raw`\b(${identifierPattern})=36,${identifierPattern}=\x60#1f1f1f\x60,${identifierPattern}=\x60#ffffff\x60;function\s+${identifierPattern}\(\)\{return\{color:${identifierPattern},symbolColor:${identifierPattern}\.nativeTheme\.shouldUseDarkColors\?${identifierPattern}:${identifierPattern},height:\1\}\}`,
);
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
type MethodRange = {
  name: string;
  args: string;
  body: string;
  start: number;
  end: number;
};
type ClassRange = {
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

function collectIdentifiers(source: string): string[] {
  return source.match(new RegExp(identifierPattern, "g")) ?? [];
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

type WindowsMenuBarSettingAliases = {
  cacheModuleName: string;
  intlHookName: string;
  jsxRuntimeName: string;
  messageComponentName: string;
  platformHookName: string;
  queryHookName: string;
  saveSettingName: string;
  settingRowComponentName: string;
  settingsStateInitializer: string;
  toggleComponentName: string;
};

function requireRegexMatch(match: RegExpMatchArray | null, description: string): RegExpMatchArray {
  if (!match) {
    throw new Error("Unable to find " + description + ".");
  }
  return match;
}

function extractAssignedExpression(source: string, identifier: string, description: string): string {
  const assignmentPattern = new RegExp(
    "(?:\\blet\\s+|\\bconst\\s+|\\bvar\\s+|,|;)" + escapeRegExp(identifier) + "=",
    "g",
  );
  const match = assignmentPattern.exec(source);
  if (!match) {
    throw new Error("Unable to find " + description + ".");
  }

  let parenDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;
  let index = assignmentPattern.lastIndex;
  const expressionStart = index;
  while (index < source.length) {
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

    if (parenDepth === 0 && bracketDepth === 0 && braceDepth === 0) {
      if (character === "," || character === ";") {
        break;
      }
    }

    if (character === "(") {
      parenDepth += 1;
    } else if (character === ")") {
      parenDepth -= 1;
    } else if (character === "[") {
      bracketDepth += 1;
    } else if (character === "]") {
      bracketDepth -= 1;
    } else if (character === "{") {
      braceDepth += 1;
    } else if (character === "}") {
      braceDepth -= 1;
    }

    if (parenDepth < 0 || bracketDepth < 0 || braceDepth < 0) {
      throw new Error("Unable to parse " + description + ".");
    }

    index += 1;
  }

  if (parenDepth !== 0 || bracketDepth !== 0 || braceDepth !== 0) {
    throw new Error("Unable to parse " + description + ".");
  }

  const expression = source.slice(expressionStart, index).trim();
  if (!expression) {
    throw new Error("Unable to find " + description + ".");
  }
  return expression;
}

function isWindowsMenuBarAppearancePatchApplied(source: string): boolean {
  const settingRanges = findFunctionRanges(source).filter(
    (range) => range.name === "CodexWindowsMenuBarSetting",
  );
  const appearanceRowPattern = new RegExp(
    "\\(0,(" +
      identifierPattern +
      ")\\.jsx\\)\\(CodexWindowsMenuBarSetting,\\{\\}\\),\\(0,\\1\\.jsx\\)\\(" +
      identifierPattern +
      ",\\{\\}\\)",
  );
  const appearanceHasRow = findFunctionRanges(source).some(
    (range) => range.body.includes("electron:!0") && appearanceRowPattern.test(range.body),
  );
  if (settingRanges.length !== 1 || !appearanceHasRow) {
    return false;
  }

  const body = settingRanges[0].body;
  return (
    body.includes("settings.general.appearance.hideWindowsMenuBar.label") &&
    body.includes("settings.general.appearance.hideWindowsMenuBar.description") &&
    new RegExp("\\b" + identifierPattern + "=" + identifierPattern + "===\\x60windows\\x60").test(
      body,
    ) &&
    new RegExp(identifierPattern + "\\(\\x60hideWindowsMenuBar\\x60," + identifierPattern + "\\)").test(
      body,
    ) &&
    new RegExp("\\b" + identifierPattern + "=" + identifierPattern + "!==!1").test(body) &&
    new RegExp("if\\(!" + identifierPattern + "\\)return null").test(body) &&
    new RegExp(
      identifierPattern +
        "\\(" +
        identifierPattern +
        ",\\x60hideWindowsMenuBar\\x60," +
        identifierPattern +
        "\\)",
    ).test(body)
  );
}

function hasWindowsMenuBarAppearancePatchMarkers(source: string): boolean {
  return (
    source.includes("function CodexWindowsMenuBarSetting()") ||
    source.includes("CodexWindowsMenuBarSetting,{})") ||
    (source.includes("settings.general.appearance.hideWindowsMenuBar.label") &&
      source.includes("settings.general.appearance.hideWindowsMenuBar.description"))
  );
}

function isWindowsMenuBarMainProcessPatchApplied(source: string): boolean {
  const hiddenMethodPattern = new RegExp(
    "\\bisWindowsMenuBarHidden\\((" +
      identifierPattern +
      ")\\)\\{return process\\.platform===\\x60win32\\x60&&this\\.options\\.getGlobalStateForHost\\(\\1\\)\\.get\\(\\x60hideWindowsMenuBar\\x60\\)!==!1\\}",
  );
  const setterMethodPattern = new RegExp(
    "\\bsetWindowsMenuBarHiddenForHost\\((" +
      identifierPattern +
      "),(" +
      identifierPattern +
      ")\\)\\{if\\(process\\.platform!==\\x60win32\\x60\\)return;for\\(let (" +
      identifierPattern +
      ") of (" +
      identifierPattern +
      ")\\.BrowserWindow\\.getAllWindows\\(\\)\\)\\{if\\(\\3\\.isDestroyed\\(\\)\\|\\|this\\.windowHostIds\\.get\\(\\3\\.id\\)!==\\1\\)continue;\\2\\?\\(\\3\\.setAutoHideMenuBar\\(!0\\),\\3\\.setMenuBarVisibility\\(!1\\),\\3\\.removeMenu\\(\\)\\):\\(\\3\\.setMenu\\(\\4\\.Menu\\.getApplicationMenu\\(\\)\\),\\3\\.setAutoHideMenuBar\\(!1\\),\\3\\.setMenuBarVisibility\\(!0\\)\\)\\}\\}",
  );
  const configurationPattern = new RegExp(
    identifierPattern +
      "===\\x60hideWindowsMenuBar\\x60&&this\\.windowManager\\.setWindowsMenuBarHiddenForHost\\(this\\.hostConfig\\.id," +
      identifierPattern +
      "!==!1\\)",
  );
  const createdWindowRemoveMenuPattern = new RegExp(
    "codexWindowsMenuBarHidden&&" + identifierPattern + "\\.removeMenu\\(\\)",
  );
  return (
    hiddenMethodPattern.test(source) &&
    setterMethodPattern.test(source) &&
    source.includes("autoHideMenuBar:codexWindowsMenuBarHidden") &&
    createdWindowRemoveMenuPattern.test(source) &&
    configurationPattern.test(source)
  );
}

function hasWindowsMenuBarMainProcessPatchMarkers(source: string): boolean {
  return (
    source.includes("isWindowsMenuBarHidden(") ||
    source.includes("setWindowsMenuBarHiddenForHost(") ||
    source.includes("codexWindowsMenuBarHidden") ||
    source.includes("windowManager.setWindowsMenuBarHiddenForHost(this.hostConfig.id")
  );
}

function extractWindowsMenuBarSettingAliases(source: string): WindowsMenuBarSettingAliases {
  const cacheMatch = requireRegexMatch(
    source.match(/\(0,([A-Za-z_$][\w$]*)\.c\)\(\d+\)/),
    "font smoothing cache hook alias",
  );
  const queryMatch = requireRegexMatch(
    source.match(
      /let\{data:[A-Za-z_$][\w$]*,isLoading:[A-Za-z_$][\w$]*\}=([A-Za-z_$][\w$]*)\(([A-Za-z_$][\w$]*)\.USE_FONT_SMOOTHING,/,
    ),
    "font smoothing query hook alias",
  );
  const saveMatch = requireRegexMatch(
    source.match(
      /=>\{([A-Za-z_$][\w$]*)\(([A-Za-z_$][\w$]*),([A-Za-z_$][\w$]*)\.USE_FONT_SMOOTHING,[A-Za-z_$][\w$]*\)\}/,
    ),
    "font smoothing save helper alias",
  );
  if (saveMatch[3] !== queryMatch[2]) {
    throw new Error("Font smoothing setting key aliases did not match.");
  }
  const settingsStateInitializer = extractAssignedExpression(
    source,
    saveMatch[2],
    "font smoothing settings state initializer",
  );
  const intlMatch = requireRegexMatch(
    source.match(
      /([A-Za-z_$][\w$]*)\.formatMessage\(\{id:\x60settings\.general\.appearance\.fontSmoothing\.label\x60/,
    ),
    "font smoothing intl alias",
  );
  const platformValueMatch = requireRegexMatch(
    source.match(/([A-Za-z_$][\w$]*)===\x60macOS\x60/),
    "font smoothing platform value alias",
  );
  const platformHookMatch = requireRegexMatch(
    source.match(
      new RegExp("\\{platform(?::" + escapeRegExp(platformValueMatch[1]) + ")?\\}=([A-Za-z_$][\\w$]*)\\(\\)"),
    ),
    "font smoothing platform hook alias",
  );
  const messageMatch = requireRegexMatch(
    source.match(
      /\(0,([A-Za-z_$][\w$]*)\.jsx\)\(([A-Za-z_$][\w$]*),\{id:\x60settings\.general\.appearance\.fontSmoothing\.label\x60/,
    ),
    "font smoothing message component alias",
  );
  const rowMatch = requireRegexMatch(
    source.match(
      /\(0,([A-Za-z_$][\w$]*)\.jsx\)\(([A-Za-z_$][\w$]*),\{label:[A-Za-z_$][\w$]*,description:[A-Za-z_$][\w$]*,control:\(0,\1\.jsx\)\(([A-Za-z_$][\w$]*),\{checked:/,
    ),
    "font smoothing row component aliases",
  );
  if (rowMatch[1] !== messageMatch[1]) {
    throw new Error("Font smoothing JSX runtime aliases did not match.");
  }

  return {
    cacheModuleName: cacheMatch[1],
    settingsStateInitializer,
    intlHookName: intlMatch[1],
    platformHookName: platformHookMatch[1],
    queryHookName: queryMatch[1],
    saveSettingName: saveMatch[1],
    jsxRuntimeName: messageMatch[1],
    messageComponentName: messageMatch[2],
    settingRowComponentName: rowMatch[2],
    toggleComponentName: rowMatch[3],
  };
}

function buildWindowsMenuBarSettingFunction(aliases: WindowsMenuBarSettingAliases): string {
  const reservedIdentifiers = new Set([
    aliases.cacheModuleName,
    aliases.intlHookName,
    aliases.platformHookName,
    aliases.queryHookName,
    aliases.saveSettingName,
    aliases.jsxRuntimeName,
    aliases.messageComponentName,
    aliases.settingRowComponentName,
    aliases.toggleComponentName,
    ...collectIdentifiers(aliases.settingsStateInitializer),
  ]);
  const cacheName = takeAvailableIdentifier("e", reservedIdentifiers);
  const settingsStateName = takeAvailableIdentifier("t", reservedIdentifiers);
  const intlName = takeAvailableIdentifier("n", reservedIdentifiers);
  const platformName = takeAvailableIdentifier("i", reservedIdentifiers);
  const isWindowsName = takeAvailableIdentifier("a", reservedIdentifiers);
  const queryOptionsName = takeAvailableIdentifier("o", reservedIdentifiers);
  const settingValueName = takeAvailableIdentifier("s", reservedIdentifiers);
  const loadingName = takeAvailableIdentifier("c", reservedIdentifiers);
  const checkedName = takeAvailableIdentifier("l", reservedIdentifiers);
  const labelName = takeAvailableIdentifier("u", reservedIdentifiers);
  const descriptionName = takeAvailableIdentifier("d", reservedIdentifiers);
  const onChangeName = takeAvailableIdentifier("f", reservedIdentifiers);
  const nextValueName = takeAvailableIdentifier("e", reservedIdentifiers);
  const ariaLabelName = takeAvailableIdentifier("p", reservedIdentifiers);
  const rowName = takeAvailableIdentifier("m", reservedIdentifiers);

  return (
    "function CodexWindowsMenuBarSetting(){let " +
    cacheName +
    "=(0," +
    aliases.cacheModuleName +
    ".c)(13)," +
    settingsStateName +
    "=" +
    aliases.settingsStateInitializer +
    "," +
    intlName +
    "=" +
    aliases.intlHookName +
    "(),{platform:" +
    platformName +
    "}=" +
    aliases.platformHookName +
    "()," +
    isWindowsName +
    "=" +
    platformName +
    "===\x60windows\x60," +
    queryOptionsName +
    ";" +
    cacheName +
    "[0]===" +
    isWindowsName +
    "?" +
    queryOptionsName +
    "=" +
    cacheName +
    "[1]:(" +
    queryOptionsName +
    "={enabled:" +
    isWindowsName +
    "}," +
    cacheName +
    "[0]=" +
    isWindowsName +
    "," +
    cacheName +
    "[1]=" +
    queryOptionsName +
    ");let{data:" +
    settingValueName +
    ",isLoading:" +
    loadingName +
    "}=" +
    aliases.queryHookName +
    "(\x60hideWindowsMenuBar\x60," +
    queryOptionsName +
    ")," +
    checkedName +
    "=" +
    settingValueName +
    "!==!1;if(!" +
    isWindowsName +
    ")return null;let " +
    labelName +
    "," +
    descriptionName +
    ";" +
    cacheName +
    "[2]===Symbol.for(\x60react.memo_cache_sentinel\x60)?(" +
    labelName +
    "=(0," +
    aliases.jsxRuntimeName +
    ".jsx)(" +
    aliases.messageComponentName +
    ",{id:\x60settings.general.appearance.hideWindowsMenuBar.label\x60,defaultMessage:\x60Hide menu bar\x60,description:\x60Label for Windows menu bar visibility setting\x60})," +
    descriptionName +
    "=(0," +
    aliases.jsxRuntimeName +
    ".jsx)(" +
    aliases.messageComponentName +
    ",{id:\x60settings.general.appearance.hideWindowsMenuBar.description\x60,defaultMessage:\x60Hide the Windows File, Edit, View, Window, and Help menu bar\x60,description:\x60Description for Windows menu bar visibility setting\x60})," +
    cacheName +
    "[2]=" +
    labelName +
    "," +
    cacheName +
    "[3]=" +
    descriptionName +
    "):(" +
    labelName +
    "=" +
    cacheName +
    "[2]," +
    descriptionName +
    "=" +
    cacheName +
    "[3]);let " +
    onChangeName +
    ";" +
    cacheName +
    "[4]===" +
    settingsStateName +
    "?" +
    onChangeName +
    "=" +
    cacheName +
    "[5]:(" +
    onChangeName +
    "=" +
    nextValueName +
    "=>{" +
    aliases.saveSettingName +
    "(" +
    settingsStateName +
    ",\x60hideWindowsMenuBar\x60," +
    nextValueName +
    ")}," +
    cacheName +
    "[4]=" +
    settingsStateName +
    "," +
    cacheName +
    "[5]=" +
    onChangeName +
    ");let " +
    ariaLabelName +
    ";" +
    cacheName +
    "[6]===" +
    intlName +
    "?" +
    ariaLabelName +
    "=" +
    cacheName +
    "[7]:(" +
    ariaLabelName +
    "=" +
    intlName +
    ".formatMessage({id:\x60settings.general.appearance.hideWindowsMenuBar.label\x60,defaultMessage:\x60Hide menu bar\x60,description:\x60Label for Windows menu bar visibility setting\x60})," +
    cacheName +
    "[6]=" +
    intlName +
    "," +
    cacheName +
    "[7]=" +
    ariaLabelName +
    ");let " +
    rowName +
    ";return " +
    cacheName +
    "[8]!==" +
    checkedName +
    "||" +
    cacheName +
    "[9]!==" +
    loadingName +
    "||" +
    cacheName +
    "[10]!==" +
    onChangeName +
    "||" +
    cacheName +
    "[11]!==" +
    ariaLabelName +
    "?(" +
    rowName +
    "=(0," +
    aliases.jsxRuntimeName +
    ".jsx)(" +
    aliases.settingRowComponentName +
    ",{label:" +
    labelName +
    ",description:" +
    descriptionName +
    ",control:(0," +
    aliases.jsxRuntimeName +
    ".jsx)(" +
    aliases.toggleComponentName +
    ",{checked:" +
    checkedName +
    ",disabled:" +
    loadingName +
    ",onChange:" +
    onChangeName +
    ",ariaLabel:" +
    ariaLabelName +
    "})})," +
    cacheName +
    "[8]=" +
    checkedName +
    "," +
    cacheName +
    "[9]=" +
    loadingName +
    "," +
    cacheName +
    "[10]=" +
    onChangeName +
    "," +
    cacheName +
    "[11]=" +
    ariaLabelName +
    "," +
    cacheName +
    "[12]=" +
    rowName +
    "):" +
    rowName +
    "=" +
    cacheName +
    "[12]," +
    rowName +
    "}"
  );
}

function patchWindowsMenuBarAppearanceSetting(): SourcePatcher {
  return (source) => {
    if (isWindowsMenuBarAppearancePatchApplied(source)) {
      return { source, status: "already-applied", matcher: "semantic" };
    }
    if (hasWindowsMenuBarAppearancePatchMarkers(source)) {
      throw new Error("Existing Windows menu bar appearance patch is incomplete or stale.");
    }

    const ranges = findFunctionRanges(source);
    const pointerCursorRange = ranges.filter((range) =>
      range.body.includes("settings.general.appearance.usePointerCursors.label"),
    );
    if (pointerCursorRange.length !== 1) {
      throw new Error(
        "Expected exactly one pointer cursor settings function, found " +
          pointerCursorRange.length +
          ".",
      );
    }
    const fontSmoothingRange = ranges.filter((range) =>
      range.body.includes("settings.general.appearance.fontSmoothing.label"),
    );
    if (fontSmoothingRange.length !== 1) {
      throw new Error(
        "Expected exactly one font smoothing settings function, found " +
          fontSmoothingRange.length +
          ".",
      );
    }

    const aliases = extractWindowsMenuBarSettingAliases(fontSmoothingRange[0].body);
    const pointerCursorCall =
      "(0," + aliases.jsxRuntimeName + ".jsx)(" + pointerCursorRange[0].name + ",{})";
    const fontSmoothingCall =
      "(0," + aliases.jsxRuntimeName + ".jsx)(" + fontSmoothingRange[0].name + ",{})";
    const appearanceRange = ranges.filter(
      (range) =>
        range.body.includes("electron:!0") &&
        range.body.includes(pointerCursorCall) &&
        range.body.includes(fontSmoothingCall),
    );
    if (appearanceRange.length === 0) {
      return undefined;
    }
    if (appearanceRange.length !== 1) {
      throw new Error(
        "Expected exactly one appearance settings function, found " + appearanceRange.length + ".",
      );
    }

    const row =
      "(0," + aliases.jsxRuntimeName + ".jsx)(CodexWindowsMenuBarSetting,{})," + fontSmoothingCall;
    const appearanceBody = appearanceRange[0].body.replace(fontSmoothingCall, row);
    if (appearanceBody === appearanceRange[0].body) {
      throw new Error("Unable to add Windows menu bar row to appearance settings.");
    }

    const appearanceFunction =
      appearanceRange[0].asyncPrefix +
      "function " +
      appearanceRange[0].name +
      "(" +
      appearanceRange[0].args +
      "){" +
      appearanceBody +
      "}";
    const settingFunction = buildWindowsMenuBarSettingFunction(aliases);

    let nextSource =
      source.slice(0, appearanceRange[0].start) +
      appearanceFunction +
      source.slice(appearanceRange[0].end);
    const pointerRangesAfterAppearancePatch = findFunctionRanges(nextSource).filter((range) =>
      range.body.includes("settings.general.appearance.usePointerCursors.label"),
    );
    if (pointerRangesAfterAppearancePatch.length !== 1) {
      throw new Error(
        "Expected exactly one pointer cursor settings function after appearance patch, found " +
          pointerRangesAfterAppearancePatch.length +
          ".",
      );
    }

    const insertAt = pointerRangesAfterAppearancePatch[0].end;
    nextSource = nextSource.slice(0, insertAt) + settingFunction + nextSource.slice(insertAt);
    return { source: nextSource, status: "applied", matcher: "semantic" };
  };
}

function patchWindowsMenuBarMainProcessBehavior(): SourcePatcher {
  return (source) => {
    if (isWindowsMenuBarMainProcessPatchApplied(source)) {
      return { source, status: "already-applied", matcher: "semantic" };
    }
    if (hasWindowsMenuBarMainProcessPatchMarkers(source)) {
      throw new Error("Existing Windows menu bar main-process patch is incomplete or stale.");
    }
    if (
      !source.includes("autoHideMenuBar") ||
      !source.includes("removeMenu") ||
      !source.includes("\"set-configuration\"")
    ) {
      return undefined;
    }

    let nextSource = source;

    const refreshWindowBackdrops = findMethodRanges(nextSource, "refreshWindowBackdrops");
    if (refreshWindowBackdrops.length !== 1) {
      throw new Error(
        "Expected exactly one refreshWindowBackdrops method, found " +
          refreshWindowBackdrops.length +
          ".",
      );
    }
    const refreshWindowBackdropForHost = findMethodRanges(nextSource, "refreshWindowBackdropForHost");
    if (refreshWindowBackdropForHost.length !== 1) {
      throw new Error(
        "Expected exactly one refreshWindowBackdropForHost method, found " +
          refreshWindowBackdropForHost.length +
          ".",
      );
    }
    const electronMatch = refreshWindowBackdropForHost[0].body.match(
      new RegExp("for\\(let " + identifierPattern + " of (" + identifierPattern + ")\\.BrowserWindow\\.getAllWindows\\(\\)\\)"),
    );
    if (!electronMatch?.[1]) {
      throw new Error("Unable to find Electron import alias in refreshWindowBackdropForHost.");
    }
    const electronName = electronMatch[1];
    if (
      !isRangeInsideClass(
        nextSource,
        refreshWindowBackdrops[0].start,
        refreshWindowBackdropForHost[0].end,
      )
    ) {
      throw new Error("Expected refreshWindowBackdrops to be a class method.");
    }
    const reservedIdentifiers = new Set([electronName]);
    const hostName = takeAvailableIdentifier("e", reservedIdentifiers);
    const hiddenName = takeAvailableIdentifier("t", reservedIdentifiers);
    const windowName = takeAvailableIdentifier("r", reservedIdentifiers);
    const menuBarMethods =
      "isWindowsMenuBarHidden(" +
      hostName +
      "){return process.platform===\x60win32\x60&&this.options.getGlobalStateForHost(" +
      hostName +
      ").get(\x60hideWindowsMenuBar\x60)!==!1}" +
      "setWindowsMenuBarHiddenForHost(" +
      hostName +
      "," +
      hiddenName +
      "){if(process.platform!==\x60win32\x60)return;for(let " +
      windowName +
      " of " +
      electronName +
      ".BrowserWindow.getAllWindows()){if(" +
      windowName +
      ".isDestroyed()||this.windowHostIds.get(" +
      windowName +
      ".id)!==" +
      hostName +
      ")continue;" +
      hiddenName +
      "?(" +
      windowName +
      ".setAutoHideMenuBar(!0)," +
      windowName +
      ".setMenuBarVisibility(!1)," +
      windowName +
      ".removeMenu()):(" +
      windowName +
      ".setMenu(" +
      electronName +
      ".Menu.getApplicationMenu())," +
      windowName +
      ".setAutoHideMenuBar(!1)," +
      windowName +
      ".setMenuBarVisibility(!0))}}";
    nextSource =
      nextSource.slice(0, refreshWindowBackdrops[0].end) +
      menuBarMethods +
      nextSource.slice(refreshWindowBackdrops[0].end);

    const opaqueTarget =
      /([A-Za-z_$][\w$]*)=this\.isOpaqueWindowsEnabled\(([A-Za-z_$][\w$]*)\),([A-Za-z_$][\w$]*)=([A-Za-z_$][\w$]*)\(\{appearance:([A-Za-z_$][\w$]*),opaqueWindowsEnabled:\1,platform:process\.platform\}\)/g;
    const opaqueMatches = Array.from(nextSource.matchAll(opaqueTarget));
    if (opaqueMatches.length !== 1) {
      throw new Error("Expected exactly one main window opacity target, found " + opaqueMatches.length + ".");
    }
    nextSource = nextSource.replace(
      opaqueTarget,
      (
        _match,
        opaqueName,
        hostName,
        optionsName,
        windowOptionsFactoryName,
        appearanceName,
      ) =>
        opaqueName +
        "=this.isOpaqueWindowsEnabled(" +
        hostName +
        "),codexWindowsMenuBarHidden=this.isWindowsMenuBarHidden(" +
        hostName +
        ")," +
        optionsName +
        "=" +
        windowOptionsFactoryName +
        "({appearance:" +
        appearanceName +
        ",opaqueWindowsEnabled:" +
        opaqueName +
        ",platform:process.platform})",
    );

    const autoHideTarget =
      /(\.\.\.\s*process\.platform\s*===\s*\x60win32\x60\s*\?\s*\{\s*autoHideMenuBar\s*:)\s*(?:!0|true)\s*(\}\s*:\s*\{\s*\})/g;
    const autoHideMatches = Array.from(nextSource.matchAll(autoHideTarget));
    if (autoHideMatches.length !== 1) {
      throw new Error("Expected exactly one Windows auto-hide menu bar target, found " + autoHideMatches.length + ".");
    }
    nextSource = nextSource.replace(
      autoHideTarget,
      "$1codexWindowsMenuBarHidden$2",
    );

    const removeMenuTarget =
      /(let [A-Za-z_$][\w$]*=this\.installWindowsTitleBarOverlaySync\(([A-Za-z_$][\w$]*),[A-Za-z_$][\w$]*\);)process\.platform===\x60win32\x60&&\2\.removeMenu\(\)/g;
    const removeMenuMatches = Array.from(nextSource.matchAll(removeMenuTarget));
    if (removeMenuMatches.length !== 1) {
      throw new Error("Expected exactly one Windows removeMenu target, found " + removeMenuMatches.length + ".");
    }
    nextSource = nextSource.replace(
      removeMenuTarget,
      "$1codexWindowsMenuBarHidden&&$2.removeMenu()",
    );

    const configTarget =
      /("set-configuration":async\(\{key:([A-Za-z_$][\w$]*),value:([A-Za-z_$][\w$]*)\}\)=>\(this\.globalState\.set\(\2,\3\),)/g;
    const configMatches = Array.from(nextSource.matchAll(configTarget));
    if (configMatches.length !== 1) {
      throw new Error("Expected exactly one set-configuration target, found " + configMatches.length + ".");
    }
    nextSource = nextSource.replace(
      configTarget,
      (_match, prefix, keyName, valueName) =>
        prefix +
        keyName +
        "===\x60hideWindowsMenuBar\x60&&this.windowManager.setWindowsMenuBarHiddenForHost(this.hostConfig.id," +
        valueName +
        "!==!1),",
    );

    return { source: nextSource, status: "applied", matcher: "semantic" };
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

function findMethodRanges(source: string, methodName: string): MethodRange[] {
  const ranges: MethodRange[] = [];
  const methodPattern = new RegExp("\\b(" + escapeRegExp(methodName) + ")\\(([^)]*)\\)\\{", "g");
  let match: RegExpExecArray | null;

  while ((match = methodPattern.exec(source)) !== null) {
    let depth = 1;
    let index = methodPattern.lastIndex;
    while (index < source.length && depth > 0) {
      const character = source[index];
      const next = source[index + 1];
      if (character === "'" || character === "\"") {
        index = skipQuotedString(source, index);
        continue;
      }
      if (character === "\x60") {
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
      throw new Error("Unable to find end of method " + methodName + ".");
    }

    ranges.push({
      name: match[1],
      args: match[2],
      body: source.slice(methodPattern.lastIndex, index - 1),
      start: match.index,
      end: index,
    });
  }

  return ranges;
}

function findClassRanges(source: string): ClassRange[] {
  const ranges: ClassRange[] = [];
  const classPattern = /\bclass\s+(?:[A-Za-z_$][\w$]*)?(?:\s+extends\s+[^{}]+)?\{/g;
  let match: RegExpExecArray | null;

  while ((match = classPattern.exec(source)) !== null) {
    let depth = 1;
    let index = classPattern.lastIndex;
    while (index < source.length && depth > 0) {
      const character = source[index];
      const next = source[index + 1];
      if (character === "'" || character === "\"") {
        index = skipQuotedString(source, index);
        continue;
      }
      if (character === "\x60") {
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
      throw new Error("Unable to find end of class.");
    }

    ranges.push({
      body: source.slice(classPattern.lastIndex, index - 1),
      start: match.index,
      end: index,
    });
  }

  return ranges;
}

function isRangeInsideClass(source: string, start: number, end: number): boolean {
  return findClassRanges(source).some((range) => start > range.start && end <= range.end);
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

function patchAppearanceSettings(recoveredRoot: string): PatchResult[] {
  const filePath = findFileContaining(
    path.join(recoveredRoot, "webview", "assets"),
    /^general-settings-.*\.js$/,
    ["settings.general.appearance.usePointerCursors.label"],
  );

  return [
    replaceWithPatchers(
      recoveredRoot,
      filePath,
      "add Windows menu bar visibility appearance setting",
      [patchWindowsMenuBarAppearanceSetting()],
      { missingTargetMarkers: ["settings.general.appearance.usePointerCursors.label"] },
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
      "add Windows menu bar visibility main-process behavior",
      [patchWindowsMenuBarMainProcessBehavior()],
      { required: true },
    ),
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
    results.push(...patchAppearanceSettings(recoveredRoot));
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
