import fs from "node:fs";
import path from "node:path";
import {
  findJavaScriptBlockEnd,
  replaceChatGptProductTextInJavaScriptStrings,
} from "./javascript-product-text.ts";

type PatchStatus = "applied" | "already-applied" | "failed-required";

type PatchResult = {
  file: string;
  name: string;
  status: PatchStatus;
  matcher?: string;
  reason?: string;
};

const desktopRoot = process.cwd();
const identifierPattern = String.raw`[A-Za-z_$][\w$]*`;
const packageLocalCacheRelocationAppliedPattern =
  /process\.resourcesPath\?\.replace[\s\S]*?`Packages`[\s\S]*?`LocalCache`[\s\S]*?`Local`/;
const inactiveWindowsMicaBackdropAppliedPattern =
  /\bfunction\s+[A-Za-z_$][\w$]*\(\{appearance:([A-Za-z_$][\w$]*),isFocused:([A-Za-z_$][\w$]*),platform:([A-Za-z_$][\w$]*)\}\)\{return!\2&&![A-Za-z_$][\w$]*\(\1\)&&\3===`darwin`\}/;
const windowsArm64PrimaryRuntimeManifestUrl =
  "https://github.com/sliepie/codex-app/releases/download/codex-primary-runtime-win32-arm64/LATEST.json";
const windowsArm64PrimaryRuntimeManifestUrlPattern = new RegExp(
  escapeRegExp(windowsArm64PrimaryRuntimeManifestUrl),
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
  const matches = findFilesContaining(root, pattern, markers);

  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one recovered bundle file matching ${pattern} containing ${markers.join(", ")}, found ${matches.length}.`,
    );
  }

  return matches[0];
}

function findFilesContaining(root: string, pattern: RegExp, markers: string[]): string[] {
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
  return matches;
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

function findPrimaryRuntimeInstallerBundle(recoveredRoot: string): string | null {
  const buildRoot = path.join(recoveredRoot, ".vite", "build");
  const alreadyPatchedMatches = findFilesContaining(buildRoot, /^.*\.js$/, [
    windowsArm64PrimaryRuntimeManifestUrl,
  ]);
  if (alreadyPatchedMatches.length > 1) {
    throw new Error(
      `Expected at most one recovered primary runtime bundle already containing ${windowsArm64PrimaryRuntimeManifestUrl}, found ${alreadyPatchedMatches.length}.`,
    );
  }
  if (alreadyPatchedMatches.length === 1) {
    return alreadyPatchedMatches[0];
  }

  const installerMatches = findFilesContaining(buildRoot, /^.*\.js$/, [
    "codex-primary-runtime-installer",
    "Failed to download primary runtime manifest",
    "oaisidekickupdates.blob.core.windows.net/owl",
  ]);
  if (installerMatches.length > 1) {
    throw new Error(
      `Expected at most one recovered primary runtime installer bundle, found ${installerMatches.length}.`,
    );
  }
  if (installerMatches.length === 1) {
    return installerMatches[0];
  }

  const legacyMatches = findFilesContaining(buildRoot, /^.*\.js$/, [
    "latest-alpha",
    "oaisidekickupdates.blob.core.windows.net/owl",
  ]);
  if (legacyMatches.length > 1) {
    throw new Error(
      `Expected at most one recovered primary runtime manifest helper bundle, found ${legacyMatches.length}.`,
    );
  }
  return legacyMatches[0] ?? null;
}

function patchInactiveWindowsMicaBackdrop(): SourcePatcher {
  return (source) => {
    const matches = findFunctionRanges(source).filter((range) => {
      const argsMatch = range.args.match(
        new RegExp(
          String.raw`^\s*\{\s*appearance\s*:\s*(${identifierPattern})\s*,\s*isFocused\s*:\s*(${identifierPattern})\s*,\s*platform\s*:\s*(${identifierPattern})\s*\}\s*$`,
        ),
      );
      if (!argsMatch) {
        return false;
      }

      const [, appearanceArg, isFocusedArg, platformArg] = argsMatch;
      const bodyPattern = new RegExp(
        "^return!" +
          escapeRegExp(isFocusedArg) +
          "&&!([A-Za-z_$][\\w$]*\\(" +
          escapeRegExp(appearanceArg) +
          "\\))&&\\(" +
          escapeRegExp(platformArg) +
          "===`darwin`\\|\\|" +
          escapeRegExp(platformArg) +
          "===`win32`\\)$",
      );
      return bodyPattern.test(range.body);
    });

    if (inactiveWindowsMicaBackdropAppliedPattern.test(source) && matches.length === 0) {
      return { source, status: "already-applied", matcher: "semantic" };
    }

    if (matches.length === 0) {
      return undefined;
    }
    if (matches.length !== 1) {
      throw new Error(
        `Expected exactly one inactive Windows Mica backdrop target, found ${matches.length}.`,
      );
    }

    const match = matches[0];
    const argsMatch = match.args.match(
      new RegExp(
        String.raw`^\s*\{\s*appearance\s*:\s*(${identifierPattern})\s*,\s*isFocused\s*:\s*(${identifierPattern})\s*,\s*platform\s*:\s*(${identifierPattern})\s*\}\s*$`,
      ),
    );
    if (!argsMatch) {
      throw new Error("Unable to read inactive Mica backdrop function args.");
    }

    const [, appearanceArg, isFocusedArg, platformArg] = argsMatch;
    const darkAppearanceMatch = match.body.match(
      new RegExp(
        "^return!" +
          escapeRegExp(isFocusedArg) +
          "&&!([A-Za-z_$][\\w$]*\\(" +
          escapeRegExp(appearanceArg) +
          "\\))&&",
      ),
    );
    if (!darkAppearanceMatch?.[1]) {
      throw new Error("Unable to read inactive Mica backdrop appearance check.");
    }

    const replacement =
      `${match.asyncPrefix}function ${match.name}(${match.args}){return!${isFocusedArg}&&!${darkAppearanceMatch[1]}&&${platformArg}===\`darwin\`}`;

    return {
      source: source.slice(0, match.start) + replacement + source.slice(match.end),
      status: "applied",
      matcher: "semantic",
    };
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
    const index = findJavaScriptBlockEnd(source, functionPattern.lastIndex);
    if (index === undefined) {
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

function patchSidebarProjectLimit(): SourcePatcher {
  const markers = ["sidebarElectron.projectsNavLink", "showProjectHoverCard"];
  const appliedPattern =
    /maxGroups\s*:\s*[A-Za-z_$][\w$]*\s*\?\s*void 0\s*:\s*9999(?=\s*,\s*showProjectHoverCard\s*:)/;
  const targetPattern = new RegExp(
    String.raw`maxGroups\s*:\s*${identifierPattern}\s*\?\s*void 0\s*:\s*5(?=\s*,\s*showProjectHoverCard\s*:)`,
    "g",
  );

  return (source) => {
    const matches = findFunctionRanges(source).filter((range) =>
      markers.every((marker) => range.body.includes(marker)),
    );
    if (matches.length === 0) {
      return undefined;
    }
    if (matches.length !== 1) {
      throw new Error(
        `Expected exactly one sidebar Projects function containing ${markers.join(", ")}, found ${matches.length}.`,
      );
    }

    const match = matches[0];
    const targets = Array.from(match.body.matchAll(targetPattern));
    if (targets.length === 0 && appliedPattern.test(match.body)) {
      return { source, status: "already-applied", matcher: "semantic" };
    }
    if (targets.length !== 1) {
      throw new Error(`Expected exactly one sidebar Projects maxGroups target, found ${targets.length}.`);
    }

    const target = targets[0];
    const targetStart = target.index ?? 0;
    const patchedTarget = target[0].replace(/5$/, "9999");
    const body =
      match.body.slice(0, targetStart) +
      patchedTarget +
      match.body.slice(targetStart + target[0].length);
    const replacement = `${match.asyncPrefix}function ${match.name}(${match.args}){${body}}`;

    return {
      source: source.slice(0, match.start) + replacement + source.slice(match.end),
      status: "applied",
      matcher: "semantic",
    };
  };
}

function patchSidebarChatsHeading(): SourcePatcher {
  const markers = [
    "sidebarElectron.recentChats",
    "sidebarElectron.newThread",
    "sectionKind:`chats`",
  ];
  const targetPattern =
    /([A-Za-z_$][\w$]*)\.sidebarSection\(\{collapsed:([A-Za-z_$][\w$]*),heading:`Tasks`\}\)/g;
  const appliedPattern =
    /([A-Za-z_$][\w$]*)\.sidebarSection\(\{collapsed:([A-Za-z_$][\w$]*),heading:`Chats`\}\)/;

  return (source) => {
    const matches = findFunctionRanges(source).filter((range) =>
      markers.every((marker) => range.body.includes(marker)),
    );
    if (matches.length === 0) {
      return undefined;
    }
    if (matches.length !== 1) {
      throw new Error(
        `Expected exactly one sidebar Chats function containing ${markers.join(", ")}, found ${matches.length}.`,
      );
    }

    const match = matches[0];
    const targets = Array.from(match.body.matchAll(targetPattern));
    if (targets.length === 0 && appliedPattern.test(match.body)) {
      return { source, status: "already-applied", matcher: "semantic" };
    }
    if (targets.length !== 1) {
      throw new Error(`Expected exactly one sidebar Chats heading target, found ${targets.length}.`);
    }

    const target = targets[0];
    const targetStart = target.index ?? 0;
    const patchedTarget = target[0].replace("heading:`Tasks`", "heading:`Chats`");
    const body =
      match.body.slice(0, targetStart) +
      patchedTarget +
      match.body.slice(targetStart + target[0].length);
    const replacement = `${match.asyncPrefix}function ${match.name}(${match.args}){${body}}`;

    return {
      source: source.slice(0, match.start) + replacement + source.slice(match.end),
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

  const result = {
    file: reportFile,
    name,
    status: "failed-required" as const,
    reason: "Required patch target was not found.",
  };
  throw new PatchFailure(result, result.reason);
}

function patchSettingsPage(recoveredRoot: string): PatchResult[] {
  findFile(path.join(recoveredRoot, "webview", "assets"), /^settings-page-.*\.js$/);

  return [];
}

function patchIndex(recoveredRoot: string): PatchResult[] {
  const markers = ["electron-desktop-features-changed"];
  const webviewMatches = findFilesContaining(
    path.join(recoveredRoot, "webview", "assets"),
    /^(?:app-main|index)-.*\.js$/,
    markers,
  );

  if (webviewMatches.length > 1) {
    throw new Error(
      `Expected at most one recovered webview app feature bundle containing ${markers.join(", ")}, found ${webviewMatches.length}.`,
    );
  }

  if (webviewMatches.length === 1) {
    return [];
  }

  findFileContaining(path.join(recoveredRoot, ".vite", "build"), /^main-.*\.js$/, markers);

  return [];
}

function patchSidebarProjectsBundle(recoveredRoot: string): PatchResult[] {
  const markers = [
    "sidebarElectron.projectsNavLink",
    "showProjectHoverCard",
    "maxGroups:",
    "showProjectPinAction",
  ];
  const filePath = findFileContaining(
    path.join(recoveredRoot, "webview", "assets"),
    /^.*\.js$/,
    markers,
  );

  return [
    replaceWithPatchers(
      recoveredRoot,
      filePath,
      "raise sidebar project limit",
      [patchSidebarProjectLimit()],
    ),
  ];
}

function patchSidebarChatsBundle(recoveredRoot: string): PatchResult[] {
  const markers = [
    "sidebarElectron.recentChats",
    "sidebarElectron.newThread",
    "sectionKind:`chats`",
  ];
  const filePath = findFileContaining(
    path.join(recoveredRoot, "webview", "assets"),
    /^.*\.js$/,
    markers,
  );

  return [
    replaceWithPatchers(
      recoveredRoot,
      filePath,
      "normalize sidebar Chats heading marker",
      [patchSidebarChatsHeading()],
    ),
  ];
}

function patchAgentSettings(recoveredRoot: string): PatchResult[] {
  findFile(path.join(recoveredRoot, "webview", "assets"), /^agent-settings-.*\.js$/);

  return [];
}

function patchRendererProductText(recoveredRoot: string): PatchResult[] {
  const name = "replace ChatGPT renderer text with Codex";
  const assetRoot = path.join(recoveredRoot, "webview", "assets");
  const reportFile = toReportPath(recoveredRoot, assetRoot);

  try {
    const assetFiles = fs
      .readdirSync(assetRoot, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
      .map((entry) => path.join(assetRoot, entry.name))
      .sort();
    if (assetFiles.length === 0) {
      throw new Error("Recovered renderer assets do not contain JavaScript bundles.");
    }

    let changedFileCount = 0;
    let replacementCount = 0;
    for (const filePath of assetFiles) {
      const original = fs.readFileSync(filePath, "utf8");
      const replacement = replaceChatGptProductTextInJavaScriptStrings(original);
      if (replacement.replacementCount === 0) {
        continue;
      }

      fs.writeFileSync(filePath, replacement.source, "utf8");
      changedFileCount += 1;
      replacementCount += replacement.replacementCount;
    }

    return [
      {
        file: reportFile,
        name,
        status: replacementCount > 0 ? "applied" : "already-applied",
        matcher: "string-literal",
        reason:
          replacementCount > 0
            ? `Replaced ${replacementCount} product-name occurrence(s) across ${changedFileCount} renderer asset(s).`
            : "No replaceable ChatGPT renderer text remains.",
      },
    ];
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
}

function findWorkspaceRootDropHandlerBundle(recoveredRoot: string): string {
  const buildRoot = path.join(recoveredRoot, ".vite", "build");
  const filePattern = /^.*\.js$/;
  const matches = new Set([
    ...findFilesContaining(
      buildRoot,
      filePattern,
      ["process.env.LOCALAPPDATA", "`AppData`,`Local`),..."],
    ),
    ...findFilesContaining(
      buildRoot,
      filePattern,
      ["process.resourcesPath?.replace", "`Packages`", "`LocalCache`", "`Local`"],
    ),
  ]);

  if (matches.size !== 1) {
    throw new Error(
      `Expected exactly one recovered bundle containing the WindowsApps relocation helper, found ${matches.size}.`,
    );
  }

  return [...matches][0];
}

function patchWorkspaceRootDropHandlerBundle(recoveredRoot: string): PatchResult[] {
  const filePath = findWorkspaceRootDropHandlerBundle(recoveredRoot);

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
    ),
  ];
}

function patchPrimaryRuntimeInstallerBundle(recoveredRoot: string): PatchResult[] {
  const filePath = findPrimaryRuntimeInstallerBundle(recoveredRoot);
  const patchName = "route Windows ARM64 primary runtime manifest to GitHub release";

  if (filePath == null) {
    const result = {
      file: ".vite/build",
      name: patchName,
      status: "failed-required" as const,
      reason: "Required primary runtime manifest bundle was not found.",
    };
    throw new PatchFailure(result, result.reason);
  }

  return [
    replaceWithPatchers(
      recoveredRoot,
      filePath,
      patchName,
      [
        alreadyAppliedPatch(windowsArm64PrimaryRuntimeManifestUrlPattern),
        patchWindowsArm64PrimaryRuntimeManifestUrl(),
      ],
    ),
  ];
}

const windowsPrimaryWindowIconOption =
  'icon:process.platform===`win32`?require("node:path").join(process.resourcesPath,`icon.ico`):void 0,';
const windowsPrimaryWindowIconAppliedPattern =
  /BrowserWindow\(\{icon:process\.platform===`win32`\?require\("node:path"\)\.join\(process\.resourcesPath,`icon\.ico`\):void 0,width:/;

function patchWindowsPrimaryBrowserWindowIcon(): SourcePatcher {
  return regexPatch(
    new RegExp(
      String.raw`\bnew\s+(${identifierPattern})\.BrowserWindow\(\{width:${identifierPattern},height:${identifierPattern},(?:(?!\}\)).)*?title:${identifierPattern}\?\?\1\.app\.getName\(\),(?:(?!\}\)).)*?webPreferences:${identifierPattern}\}\)`,
      "g",
    ),
    (match) => match[0].replace(
      "BrowserWindow({",
      `BrowserWindow({${windowsPrimaryWindowIconOption}`,
    ),
    windowsPrimaryWindowIconAppliedPattern,
  );
}

function patchWindowsTitleBarOverlayHeight(): SourcePatcher {
  return (source) => {
    const overlayHelpers = Array.from(
      source.matchAll(new RegExp(`titleBarOverlay:(${identifierPattern})\\(`, "g")),
      (match) => match[1],
    );
    const uniqueOverlayHelpers = [...new Set(overlayHelpers)];
    if (uniqueOverlayHelpers.length !== 1) {
      return undefined;
    }

    const helperName = uniqueOverlayHelpers[0];
    const helperPattern = new RegExp(
      `function\\s+${escapeRegExp(helperName)}\\([^)]*\\)\\{return\\{([^{}]*)\\}\\}`,
    );
    const helperMatch = helperPattern.exec(source);
    if (!helperMatch?.[1]) {
      return undefined;
    }

    const heightMatch = /height:([^,}]+)/.exec(helperMatch[1]);
    if (!heightMatch?.[1]) {
      return undefined;
    }

    const heightExpression = heightMatch[1];
    if (/\b46\b/.test(heightExpression)) {
      return { source, status: "already-applied", matcher: "semantic" };
    }
    if (/\b36\b/.test(heightExpression)) {
      return {
        source: source.replace(helperPattern, (match) => match.replace(/\b36\b/, "46")),
        status: "applied",
        matcher: "semantic",
      };
    }

    const heightIdentifiers = heightExpression.match(new RegExp(identifierPattern, "g")) ?? [];
    const constants = [...new Set(heightIdentifiers)]
      .map((identifier) => new RegExp(`\\b${escapeRegExp(identifier)}=36\\b`))
      .filter((pattern) => pattern.test(source));
    if (constants.length !== 1) {
      throw new Error("Could not identify the Windows title bar overlay height constant.");
    }

    return {
      source: source.replace(constants[0], (match) => match.replace("36", "46")),
      status: "applied",
      matcher: "semantic",
    };
  };
}

function patchMainBundle(recoveredRoot: string): PatchResult[] {
  const filePath = findFile(path.join(recoveredRoot, ".vite", "build"), /^main-.*\.js$/);

  return [
    replaceWithPatchers(
      recoveredRoot,
      filePath,
      "keep Mica enabled for inactive Windows windows",
      [
        exactPatch(
          "function D2({appearance:e,isFocused:t,platform:n}){return!t&&!w2(e)&&(n===`darwin`||n===`win32`)}",
          "function D2({appearance:e,isFocused:t,platform:n}){return!t&&!w2(e)&&n===`darwin`}",
        ),
        patchInactiveWindowsMicaBackdrop(),
      ],
    ),
    replaceWithPatchers(
      recoveredRoot,
      filePath,
      "set Windows primary window taskbar icon",
      [
        alreadyAppliedPatch(windowsPrimaryWindowIconAppliedPattern),
        patchWindowsPrimaryBrowserWindowIcon(),
      ],
    ),
    replaceWithPatchers(
      recoveredRoot,
      filePath,
      "set Windows title bar overlay height to 46px",
      [patchWindowsTitleBarOverlayHeight()],
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
    results.push(...patchRendererProductText(recoveredRoot));
    results.push(...patchSettingsPage(recoveredRoot));
    results.push(...patchIndex(recoveredRoot));
    results.push(...patchSidebarProjectsBundle(recoveredRoot));
    results.push(...patchSidebarChatsBundle(recoveredRoot));
    results.push(...patchAgentSettings(recoveredRoot));
    results.push(...patchWorkspaceRootDropHandlerBundle(recoveredRoot));
    results.push(...patchPrimaryRuntimeInstallerBundle(recoveredRoot));
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
