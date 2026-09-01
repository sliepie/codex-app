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
const browserRuntimeRelocationMarkers = [
  "manifest.json",
  "bin/node.exe",
  "bin/node_repl.exe",
  "node_modules",
  "mkdir_staging",
  "copy_directory",
  "rename_staging",
];
const browserRuntimeRelocationAppliedMarker = "codex-runtime-relocation-fallback";
const inactiveWindowsMicaBackdropAppliedPattern =
  /\bfunction\s+[A-Za-z_$][\w$]*\(\{appearance:([A-Za-z_$][\w$]*),isFocused:([A-Za-z_$][\w$]*),platform:([A-Za-z_$][\w$]*)\}\)\{return!\2&&![A-Za-z_$][\w$]*\(\1\)&&\3===`darwin`\}/;
const windowsArm64PrimaryRuntimeManifestUrl =
  "https://github.com/sliepie/codex-app/releases/download/codex-primary-runtime-win32-arm64/LATEST.json";
const windowsArm64PrimaryRuntimeManifestUrlPattern = new RegExp(
  escapeRegExp(windowsArm64PrimaryRuntimeManifestUrl),
);
const usageRemainingMarkers = [
  "composer.mode.rateLimit.heading",
  "composer.mode.rateLimit.resetsAvailable",
  "composer.mode.rateLimit.loading",
];
const browserDownloadsFeatureGateSelectorPattern = new RegExp(
  String.raw`(featureName:\`in_app_browser\`[\s\S]{0,1024}?)\b(${identifierPattern})=\{contactInfo:(${identifierPattern}),downloads:(\3|\{enabled:!0,isLoading:!1\}),extensions:(${identifierPattern}),history:(${identifierPattern}),passwordManager:\3,siteSettings:\3\}`,
  "g",
);
const featureGateGroupMarkers = {
  voiceDictation: "codex-feature-gates-voice-dictation-enabled",
  browserComputer: "codex-feature-gates-browser-computer-enabled",
  appGenSites: "codex-feature-gates-appgen-sites-enabled",
  remoteConnectors: "codex-feature-gates-remote-connectors-enabled",
  pluginsMcpSkills: "codex-feature-gates-plugins-mcp-skills-enabled",
} as const;
const voiceDictationGateOverrides = [
  { id: "620613358", value: "!0" },
] as const;
const browserComputerGateOverrides = [
  { id: "410262010", value: "!0" },
  { id: "410065390", value: "!0" },
  { id: "1506311413", value: "!0" },
  { id: "1256703444", value: "!0" },
  { id: "4131705479", value: "!0" },
] as const;
const appGenSitesGateOverrides = [
  { id: "637432221", value: "!0" },
  { id: "3000193894", value: "!0" },
  { id: "476199071", value: "!0" },
  { id: "1912312436", value: "!0" },
  { id: "324493575", value: "!0" },
  { id: "2196156952", value: "!0" },
] as const;
const remoteConnectorsGateOverrides = [
  { id: "1042620455", value: "!0" },
  { id: "4114442250", value: "!0" },
  { id: "2055603567", value: "!0" },
  { id: "3936985709", value: "!1" },
  { id: "2296472986", value: "!0" },
] as const;
const pluginsMcpSkillsGateOverrides = [
  { id: "403472035", value: "!0" },
  { id: "603443661", value: "!0" },
  { id: "3413548395", value: "!0" },
  { id: "4218407052", value: "!0" },
] as const;
type SourcePatchResult = {
  source: string;
  status: PatchStatus;
  matcher: string;
};

type FeatureGateOverride = {
  id: string;
  value: "!0" | "!1";
};
type FeatureGateSourcePatchResult = SourcePatchResult & {
  matchedIds: string[];
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
type JavaScriptObjectProperty = {
  key: string;
  value: string;
};
type JsxObjectCall = {
  start: number;
  assignedIdentifier?: string;
  objectStart: number;
  objectEnd: number;
  properties: JavaScriptObjectProperty[];
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

export function toReportPath(root: string, filePath: string): string {
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

function findFileForPatcher(
  root: string,
  pattern: RegExp,
  markers: string[],
  patcher: SourcePatcher,
  targetName: string,
): string {
  const candidates = findFilesContaining(root, pattern, markers);
  const matches = candidates.filter((filePath) =>
    patcher(fs.readFileSync(filePath, "utf8")) !== undefined,
  );

  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one recovered bundle file containing ${markers.join(", ")} with ${targetName}, found ${matches.length}.`,
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

export function patchWindowsArm64PrimaryRuntimeManifestUrl(): SourcePatcher {
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

export function patchInactiveWindowsMicaBackdrop(): SourcePatcher {
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

function patchLatestVoiceDictationCapabilities(
  source: string,
): FeatureGateSourcePatchResult | undefined {
  const composerMarker = "navigator?.mediaDevices?.getUserMedia";
  const composerMarkerIndex = source.indexOf(composerMarker);
  if (composerMarkerIndex === -1) {
    return undefined;
  }

  const voiceAvailabilityPattern = new RegExp(
    String.raw`(\bfunction (${identifierPattern})\(\)\{let ${identifierPattern}=${identifierPattern}\(\`2380644311\`\),${identifierPattern}=${identifierPattern}\(\`1697652030\`\);return)\s+${identifierPattern}&&!${identifierPattern}(\})`,
    "g",
  );
  const availabilityMatches = Array.from(source.matchAll(voiceAvailabilityPattern));
  if (availabilityMatches.length !== 1) {
    throw new Error(
      `Expected exactly one latest Voice availability function, found ${availabilityMatches.length}.`,
    );
  }

  const availabilityMatch = availabilityMatches[0];
  if (!availabilityMatch?.[2]) {
    throw new Error("Unable to identify the latest Voice availability function.");
  }

  const voiceConsumerPattern = new RegExp(
    String.raw`(\bfunction ${identifierPattern}\(\)\{let ${identifierPattern}=${escapeRegExp(availabilityMatch[2])}\(\),[^;]+;return)\s+${identifierPattern}&&${identifierPattern}&&${identifierPattern}&&!${identifierPattern}(\})`,
    "g",
  );
  let patchedSource = source;

  const arrowIndex = source.lastIndexOf("=>{", composerMarkerIndex);
  if (arrowIndex === -1) {
    throw new Error("Unable to locate the current dictation capability function.");
  }

  const bodyStart = arrowIndex + 3;
  const bodyEnd = findJavaScriptBlockEnd(source, bodyStart);
  if (bodyEnd === undefined) {
    throw new Error("Unable to locate the end of the current dictation capability function.");
  }

  const body = source.slice(bodyStart, bodyEnd - 1);
  const composerGatePattern = new RegExp(
    String.raw`(${identifierPattern}\(${identifierPattern},\s*\`4100906017\`\)),\s*(${identifierPattern})=${identifierPattern}\(${identifierPattern},\s*\`4100906017\`\)`,
    "g",
  );
  const composerMatches = Array.from(body.matchAll(composerGatePattern));
  if (composerMatches.length !== 1) {
    throw new Error(
      `Expected exactly one current dictation composer gate pair, found ${composerMatches.length}.`,
    );
  }

  const globalDictationPattern = new RegExp(
    String.raw`(\`global-dictation\`,)statsig:\[\`4100906017\`,\`1244621283\`\],(?=supportedClients:)`,
    "g",
  );
  const globalDictationMatches = Array.from(source.matchAll(globalDictationPattern));
  if (globalDictationMatches.length !== 1) {
    throw new Error(
      `Expected exactly one current global dictation Statsig gate list, found ${globalDictationMatches.length}.`,
    );
  }

  const patchedBody = body.replace(composerGatePattern, "$1,$2=!0");
  patchedSource =
    patchedSource.slice(0, bodyStart) + patchedBody + patchedSource.slice(bodyEnd - 1);
  patchedSource = patchedSource.replace(globalDictationPattern, "$1");
  patchedSource = patchedSource.replace(voiceAvailabilityPattern, "$1!0$3");
  const consumerMatches = Array.from(patchedSource.matchAll(voiceConsumerPattern));
  if (consumerMatches.length !== 1) {
    throw new Error(
      `Expected exactly one latest Voice consumer, found ${consumerMatches.length}.`,
    );
  }
  patchedSource = patchedSource.replace(voiceConsumerPattern, "$1!0$2");

  return {
    source: patchedSource,
    status: "applied",
    matcher: "latest-voice-dictation-capabilities",
    matchedIds: ["2380644311", "1697652030", "4100906017", "1244621283"],
  };
}

type FeatureGateValueResolver = (
  id: string,
  callIndex: number,
  functionRanges: FunctionRange[],
  source: string,
) => "!0" | "!1";

export function patchFeatureGateCalls(
  source: string,
  overrides: readonly FeatureGateOverride[],
  resolveValue?: FeatureGateValueResolver,
): FeatureGateSourcePatchResult | undefined {
  const ids = overrides.map(({ id }) => escapeRegExp(id)).join("|");
  const overrideValues = new Map(overrides.map(({ id, value }) => [id, value]));
  const pattern = new RegExp(
    String.raw`(?<!\.)\b(?:${identifierPattern}\(\s*${identifierPattern}\s*,\s*|${identifierPattern}\(\s*)\`(${ids})\`\s*\)`,
    "g",
  );
  const matches = Array.from(source.matchAll(pattern));
  if (matches.length === 0) {
    return undefined;
  }

  const functionRanges = resolveValue ? findFunctionRanges(source) : [];
  const matchedIds = new Set<string>();
  let previousEnd = 0;
  let patchedSource = "";
  for (const match of matches) {
    const id = match[1];
    const start = match.index;
    if (!id || start === undefined) {
      throw new Error("Unable to identify a feature gate call.");
    }

    const defaultValue = overrideValues.get(id);
    if (!defaultValue) {
      throw new Error(`No override was defined for feature gate ${id}.`);
    }

    matchedIds.add(id);
    patchedSource += source.slice(previousEnd, start);
    patchedSource += resolveValue?.(id, start, functionRanges, source) ?? defaultValue;
    previousEnd = start + match[0].length;
  }
  patchedSource += source.slice(previousEnd);

  return {
    source: patchedSource,
    status: "applied",
    matcher: "feature-gate-call",
    matchedIds: [...matchedIds],
  };
}

function resolvePluginsMcpSkillsGateValue(
  id: string,
  callIndex: number,
  functionRanges: FunctionRange[],
  source: string,
): "!0" | "!1" {
  if (id === "4218407052") {
    const functionRange = functionRanges.find(
      (range) =>
        callIndex >= range.start &&
        callIndex < range.end &&
        range.body.includes("includeVerticalCatalog:"),
    );
    if (functionRange) {
      const precedingSource = source.slice(
        Math.max(functionRange.start, callIndex - 120),
        callIndex,
      );
      if (/(?:^|[;,]|let\s|const\s)\s*[A-Za-z_$][\w$]*\s*=\s*$/.test(precedingSource)) {
        return "!1";
      }
    }
  }

  return "!0";
}

function patchFeatureGateGroup(
  recoveredRoot: string,
  name: string,
  marker: string,
  overrides: readonly FeatureGateOverride[],
  requiredIds: readonly string[] = overrides.map(({ id }) => id),
  specialPatcher?: (source: string) => FeatureGateSourcePatchResult | undefined,
  resolveValue?: FeatureGateValueResolver,
): PatchResult[] {
  const assetsRoot = path.join(recoveredRoot, "webview", "assets");
  const reportFile = toReportPath(recoveredRoot, assetsRoot);

  try {
    const assetFiles = findFilesContaining(assetsRoot, /^.*\.js$/, []);
    if (assetFiles.length === 0) {
      throw new Error("Recovered renderer assets do not contain JavaScript bundles.");
    }

    const sources = assetFiles.map((filePath) => ({
      filePath,
      source: fs.readFileSync(filePath, "utf8"),
    }));
    const hasExistingMarker = sources.some(({ source }) => source.includes(marker));
    const matchedIds = new Set<string>(hasExistingMarker ? requiredIds : []);
    const updates: Array<{ filePath: string; source: string }> = [];

    for (const { filePath, source } of sources) {
      let patchedSource = source;
      const specialResult = hasExistingMarker ? undefined : specialPatcher?.(patchedSource);
      if (specialResult) {
        patchedSource = specialResult.source;
        specialResult.matchedIds.forEach((id) => matchedIds.add(id));
      }

      const gateResult = patchFeatureGateCalls(patchedSource, overrides, resolveValue);
      if (gateResult) {
        patchedSource = gateResult.source;
        gateResult.matchedIds.forEach((id) => matchedIds.add(id));
      }

      if (patchedSource !== source) {
        updates.push({ filePath, source: `/* ${marker} */\n${patchedSource}` });
      }
    }

    const missingIds = requiredIds.filter((id) => !matchedIds.has(id));
    if (missingIds.length > 0) {
      throw new Error(
        `Required feature gate calls were not found: ${missingIds.join(", ")}.`,
      );
    }

    for (const update of updates) {
      fs.writeFileSync(update.filePath, update.source, "utf8");
    }

    return [
      {
        file: reportFile,
        name,
        status: updates.length > 0 ? "applied" : "already-applied",
        matcher: "feature-gate-call",
        reason:
          updates.length > 0
            ? `Enabled ${requiredIds.length} gate(s) across ${updates.length} renderer asset(s).`
            : "All requested gate overrides are already present.",
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

function skipJavaScriptQuotedValue(source: string, start: number): number {
  const quote = source[start];
  let index = start + 1;
  while (index < source.length) {
    if (source[index] === "\\") {
      index += 2;
      continue;
    }
    if (source[index] === quote) {
      return index + 1;
    }
    index += 1;
  }
  return source.length;
}

function skipJavaScriptComment(source: string, start: number): number {
  if (source[start + 1] === "/") {
    const lineEnd = source.indexOf("\n", start + 2);
    return lineEnd === -1 ? source.length : lineEnd + 1;
  }
  const blockEnd = source.indexOf("*/", start + 2);
  return blockEnd === -1 ? source.length : blockEnd + 2;
}

function findTopLevelDelimiter(
  source: string,
  start: number,
  delimiter: string,
): number | undefined {
  let parentheses = 0;
  let brackets = 0;
  let braces = 0;

  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (character === "'" || character === '"' || character === "`") {
      index = skipJavaScriptQuotedValue(source, index) - 1;
      continue;
    }
    if (character === "/" && (next === "/" || next === "*")) {
      index = skipJavaScriptComment(source, index) - 1;
      continue;
    }

    if (character === "(") {
      parentheses += 1;
    } else if (character === ")") {
      parentheses -= 1;
    } else if (character === "[") {
      brackets += 1;
    } else if (character === "]") {
      brackets -= 1;
    } else if (character === "{") {
      braces += 1;
    } else if (character === "}") {
      braces -= 1;
    } else if (
      character === delimiter &&
      parentheses === 0 &&
      brackets === 0 &&
      braces === 0
    ) {
      return index;
    }
  }

  return undefined;
}

function findTopLevelObjectProperties(
  source: string,
  start: number,
  end: number,
): JavaScriptObjectProperty[] {
  const properties: JavaScriptObjectProperty[] = [];
  let propertyStart = start;
  let colonIndex: number | undefined;
  let parentheses = 0;
  let brackets = 0;
  let braces = 0;

  const addProperty = (propertyEnd: number) => {
    if (colonIndex === undefined) {
      return;
    }

    const key = source.slice(propertyStart, colonIndex).trim();
    if (new RegExp(`^${identifierPattern}$`).test(key)) {
      properties.push({
        key,
        value: source.slice(colonIndex + 1, propertyEnd).trim(),
      });
    }
  };

  for (let index = start; index < end; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (character === "'" || character === '"' || character === "`") {
      index = skipJavaScriptQuotedValue(source, index) - 1;
      continue;
    }
    if (character === "/" && (next === "/" || next === "*")) {
      index = skipJavaScriptComment(source, index) - 1;
      continue;
    }

    if (character === "(") {
      parentheses += 1;
    } else if (character === ")") {
      parentheses -= 1;
    } else if (character === "[") {
      brackets += 1;
    } else if (character === "]") {
      brackets -= 1;
    } else if (character === "{") {
      braces += 1;
    } else if (character === "}") {
      braces -= 1;
    } else if (parentheses === 0 && brackets === 0 && braces === 0) {
      if (character === ":" && colonIndex === undefined) {
        colonIndex = index;
      } else if (character === ",") {
        addProperty(index);
        propertyStart = index + 1;
        colonIndex = undefined;
      }
    }
  }
  addProperty(end);

  return properties;
}

function findJsxObjectCalls(source: string): JsxObjectCall[] {
  const calls: JsxObjectCall[] = [];
  const callPattern = new RegExp(
    String.raw`(?:\(\s*0\s*,\s*${identifierPattern}\.(?:jsx|jsxs|jsxDEV)\)|\b${identifierPattern}\.(?:jsx|jsxs|jsxDEV)|\b(?:jsx|jsxs|jsxDEV))\(`,
    "g",
  );
  let match: RegExpExecArray | null;

  while ((match = callPattern.exec(source)) !== null) {
    const argumentSeparator = findTopLevelDelimiter(
      source,
      callPattern.lastIndex,
      ",",
    );
    if (argumentSeparator === undefined) {
      throw new Error("Unable to find the JSX component argument separator.");
    }

    let objectStart = argumentSeparator + 1;
    while (/\s/.test(source[objectStart] ?? "")) {
      objectStart += 1;
    }
    if (source[objectStart] !== "{") {
      continue;
    }

    const objectEndExclusive = findJavaScriptBlockEnd(source, objectStart + 1);
    if (objectEndExclusive === undefined) {
      throw new Error("Unable to find the end of a JSX props object.");
    }

    const objectEnd = objectEndExclusive - 1;
    const assignment = new RegExp(
      String.raw`(${identifierPattern})\s*=\s*$`,
    ).exec(source.slice(0, match.index));
    calls.push({
      start: match.index,
      assignedIdentifier: assignment?.[1],
      objectStart,
      objectEnd,
      properties: findTopLevelObjectProperties(source, objectStart + 1, objectEnd),
    });
  }

  return calls;
}

function findIdentifierAssignmentPositions(source: string, identifier: string): number[] {
  const pattern = new RegExp(`\\b${escapeRegExp(identifier)}\\s*=`, "g");
  return Array.from(source.matchAll(pattern), (match) => match.index ?? -1).filter(
    (index) => index >= 0,
  );
}

function findUniqueObjectProperty(
  call: JsxObjectCall,
  key: string,
): JavaScriptObjectProperty | undefined {
  const matches = call.properties.filter((property) => property.key === key);
  return matches.length === 1 ? matches[0] : undefined;
}

function hasObjectProperties(call: JsxObjectCall, keys: string[]): boolean {
  return keys.every((key) => findUniqueObjectProperty(call, key) !== undefined);
}

function appendObjectProperty(
  source: string,
  call: JsxObjectCall,
  property: string,
): { index: number; value: string } {
  let index = call.objectEnd;
  while (index > call.objectStart + 1 && /\s/.test(source[index - 1] ?? "")) {
    index -= 1;
  }

  const body = source.slice(call.objectStart + 1, index);
  const separator = body.trim().endsWith(",") || body.trim() === "" ? "" : ",";
  return { index, value: `${separator}${property}` };
}

function isPreventDefaultHandler(value: string): boolean {
  return /^\(?([A-Za-z_$][\w$]*)\)?=>\{?\1\.preventDefault\(\);?\}?$/.test(
    value.replace(/\s+/g, ""),
  );
}

function isAlwaysOpenValue(value: string): boolean {
  return /^(?:!0|true)$/.test(value.replace(/\s+/g, ""));
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

function patchUsageRemainingAlwaysExpanded(): SourcePatcher {
  return (source) => {
    const matches = findFunctionRanges(source).filter((range) =>
      usageRemainingMarkers.every((marker) => range.body.includes(marker)),
    );
    if (matches.length === 0) {
      return undefined;
    }
    if (matches.length !== 1) {
      throw new Error(
        `Expected exactly one Usage remaining submenu function containing ${usageRemainingMarkers.join(", ")}, found ${matches.length}.`,
      );
    }

    const match = matches[0];
    const calls = findJsxObjectCalls(match.body);
    const triggerTargets = calls.filter((call) =>
      hasObjectProperties(call, ["LeftIcon", "RightIcon", "tooltipSide", "children"]),
    );
    const submenuTargets = calls.filter((call) =>
      hasObjectProperties(call, ["trigger", "children"]),
    );
    if (triggerTargets.length !== 1) {
      throw new Error(
        `Expected exactly one Usage remaining submenu trigger target, found ${triggerTargets.length}.`,
      );
    }
    if (submenuTargets.length !== 1) {
      throw new Error(
        `Expected exactly one Usage remaining submenu target, found ${submenuTargets.length}.`,
      );
    }

    const triggerTarget = triggerTargets[0];
    const submenuTarget = submenuTargets[0];
    if (!triggerTarget || !submenuTarget) {
      throw new Error("Unable to identify Usage remaining submenu JSX targets.");
    }

    const submenuTrigger = findUniqueObjectProperty(submenuTarget, "trigger");
    if (
      !triggerTarget.assignedIdentifier ||
      !submenuTrigger ||
      submenuTrigger.value !== triggerTarget.assignedIdentifier
    ) {
      throw new Error(
        "Usage remaining submenu is not connected to its identified trigger.",
      );
    }

    const submenuChildren = findUniqueObjectProperty(submenuTarget, "children");
    if (!submenuChildren || !new RegExp(`^${identifierPattern}$`).test(submenuChildren.value)) {
      throw new Error("Unable to identify Usage remaining submenu content.");
    }
    const contentAssignments = findIdentifierAssignmentPositions(
      match.body,
      submenuChildren.value,
    );
    if (
      contentAssignments.length === 0 ||
      !contentAssignments.some((index) => index < submenuTarget.start)
    ) {
      throw new Error(
        "Unable to prove the Usage remaining submenu content belongs to this function.",
      );
    }

    const triggerOnSelect = findUniqueObjectProperty(triggerTarget, "onSelect");
    const triggerNeedsPatch = triggerOnSelect === undefined;
    if (triggerOnSelect && !isPreventDefaultHandler(triggerOnSelect.value)) {
      throw new Error(
        "Usage remaining trigger already defines an unsupported onSelect handler.",
      );
    }

    const submenuDefaultOpen = findUniqueObjectProperty(
      submenuTarget,
      "isDefaultOpen",
    );
    const submenuNeedsPatch = submenuDefaultOpen === undefined;
    if (submenuDefaultOpen && !isAlwaysOpenValue(submenuDefaultOpen.value)) {
      throw new Error(
        "Usage remaining submenu already defines an unsupported isDefaultOpen value.",
      );
    }

    if (!triggerNeedsPatch && !submenuNeedsPatch) {
      return { source, status: "already-applied", matcher: "semantic" };
    }

    const replacements = [
      triggerNeedsPatch
        ? {
            ...appendObjectProperty(
              match.body,
              triggerTarget,
              "onSelect:e=>e.preventDefault()",
            ),
          }
        : undefined,
      submenuNeedsPatch
        ? {
            ...appendObjectProperty(
              match.body,
              submenuTarget,
              "isDefaultOpen:!0",
            ),
          }
        : undefined,
    ]
      .filter((replacement): replacement is { index: number; value: string } =>
        replacement !== undefined,
      )
      .sort((left, right) => right.index - left.index);

    let patchedBody = match.body;
    for (const replacement of replacements) {
      patchedBody =
        patchedBody.slice(0, replacement.index) +
        replacement.value +
        patchedBody.slice(replacement.index);
    }

    const patchedCalls = findJsxObjectCalls(patchedBody);
    const patchedTriggerTargets = patchedCalls.filter((call) =>
      hasObjectProperties(call, ["LeftIcon", "RightIcon", "tooltipSide", "children"]),
    );
    const patchedSubmenuTargets = patchedCalls.filter((call) =>
      hasObjectProperties(call, ["trigger", "children"]),
    );
    const patchedTrigger = patchedTriggerTargets[0];
    const patchedSubmenu = patchedSubmenuTargets[0];
    const patchedHandler = patchedTrigger
      ? findUniqueObjectProperty(patchedTrigger, "onSelect")
      : undefined;
    const patchedDefaultOpen = patchedSubmenu
      ? findUniqueObjectProperty(patchedSubmenu, "isDefaultOpen")
      : undefined;
    if (
      patchedTriggerTargets.length !== 1 ||
      patchedSubmenuTargets.length !== 1 ||
      !patchedHandler ||
      !isPreventDefaultHandler(patchedHandler.value) ||
      !patchedDefaultOpen ||
      !isAlwaysOpenValue(patchedDefaultOpen.value) ||
      patchedBody === match.body
    ) {
      throw new Error("Usage remaining patch postcondition failed.");
    }

    return {
      source:
        source.slice(0, match.start) +
        `${match.asyncPrefix}function ${match.name}(${match.args}){${patchedBody}}` +
        source.slice(match.end),
      status: "applied",
      matcher: "semantic",
    };
  };
}

function patchUsageRemainingBundle(recoveredRoot: string): PatchResult[] {
  const patcher = patchUsageRemainingAlwaysExpanded();
  const filePath = findFileForPatcher(
    path.join(recoveredRoot, "webview", "assets"),
    /^.*\.js$/,
    usageRemainingMarkers,
    patcher,
    "Usage remaining submenu",
  );

  return [
    replaceWithPatchers(
      recoveredRoot,
      filePath,
      "keep Usage remaining expanded",
      [patcher],
    ),
  ];
}

function patchVoiceDictationGates(recoveredRoot: string): PatchResult[] {
  return patchFeatureGateGroup(
    recoveredRoot,
    "enable Voice and dictation gates",
    featureGateGroupMarkers.voiceDictation,
    voiceDictationGateOverrides,
    [
      "2380644311",
      "1697652030",
      "1244621283",
      ...voiceDictationGateOverrides.map(({ id }) => id),
    ],
    patchLatestVoiceDictationCapabilities,
  );
}

function patchBrowserComputerGates(recoveredRoot: string): PatchResult[] {
  return patchFeatureGateGroup(
    recoveredRoot,
    "enable Browser and computer-use gates",
    featureGateGroupMarkers.browserComputer,
    browserComputerGateOverrides,
  );
}

function patchAppGenSitesGates(recoveredRoot: string): PatchResult[] {
  return patchFeatureGateGroup(
    recoveredRoot,
    "enable AppGen and Sites gates",
    featureGateGroupMarkers.appGenSites,
    appGenSitesGateOverrides,
  );
}

function patchRemoteConnectorsGates(recoveredRoot: string): PatchResult[] {
  return patchFeatureGateGroup(
    recoveredRoot,
    "enable Remote and connector gates",
    featureGateGroupMarkers.remoteConnectors,
    remoteConnectorsGateOverrides,
  );
}

export function patchPluginsMcpSkillsGates(recoveredRoot: string): PatchResult[] {
  return patchFeatureGateGroup(
    recoveredRoot,
    "enable Plugins, MCP, and skills gates",
    featureGateGroupMarkers.pluginsMcpSkills,
    pluginsMcpSkillsGateOverrides,
    undefined,
    undefined,
    resolvePluginsMcpSkillsGateValue,
  );
}

function patchBrowserDownloadsFeatureGate(recoveredRoot: string): PatchResult[] {
  const selectorMarkers = [
    "featureName:`in_app_browser`",
    "contactInfo:",
    "downloads:",
    "extensions:",
    "history:",
    "passwordManager:",
    "siteSettings:",
  ];
  const patcher: SourcePatcher = (source) => {
    const matches = [...source.matchAll(browserDownloadsFeatureGateSelectorPattern)];
    if (matches.length === 0) {
      return undefined;
    }
    if (matches.length !== 1) {
      throw new Error(
        `Found ${matches.length} Browser downloads feature selectors; expected exactly one.`,
      );
    }

    const [match] = matches;
    if (!match) {
      return undefined;
    }
    const prefix = match[1];
    const settings = match[2];
    const sharedState = match[3];
    const downloadsState = match[4];
    const extensionsState = match[5];
    const historyState = match[6];
    if (
      !prefix ||
      !settings ||
      !sharedState ||
      !downloadsState ||
      !extensionsState ||
      !historyState
    ) {
      throw new Error("Unable to identify the Browser downloads feature state.");
    }
    if (downloadsState === "{enabled:!0,isLoading:!1}") {
      return { source, status: "already-applied", matcher: "semantic" };
    }

    const replacement = `${prefix}${settings}={contactInfo:${sharedState},downloads:{enabled:!0,isLoading:!1},extensions:${extensionsState},history:${historyState},passwordManager:${sharedState},siteSettings:${sharedState}}`;
    const start = match.index ?? 0;
    return {
      source: source.slice(0, start) + replacement + source.slice(start + match[0].length),
      status: "applied",
      matcher: "semantic",
    };
  };
  const patchName = "enable Electron Browser downloads";
  const assetsRoot = path.join(recoveredRoot, "webview", "assets");
  let filePath: string;
  try {
    filePath = findFileForPatcher(
      assetsRoot,
      /^.*\.js$/,
      selectorMarkers,
      patcher,
      "Browser downloads feature selector",
    );
  } catch (error) {
    const result = {
      file: toReportPath(recoveredRoot, assetsRoot),
      name: patchName,
      status: "failed-required" as const,
      reason: errorMessage(error),
    };
    throw new PatchFailure(result, error);
  }

  return [
    replaceWithPatchers(
      recoveredRoot,
      filePath,
      patchName,
      [patcher],
    ),
  ];
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

function findWorkspaceRootDropHandlerBundle(
  recoveredRoot: string,
  patcher: SourcePatcher,
): string {
  const buildRoot = path.join(recoveredRoot, ".vite", "build");
  const filePattern = /^.*\.js$/;
  const candidates = new Set([
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
  const matches = [...candidates].filter((filePath) =>
    patcher(fs.readFileSync(filePath, "utf8")) !== undefined,
  );

  if (matches.length === 0 && candidates.size === 1) {
    return [...candidates][0];
  }

  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one recovered bundle containing the WindowsApps relocation helper target, found ${matches.length}.`,
    );
  }

  return matches[0];
}

export function patchWorkspaceRootDropHandler(): SourcePatcher {
  return regexPatch(
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
  );
}

function patchWorkspaceRootDropHandlerBundle(recoveredRoot: string): PatchResult[] {
  const patcher = patchWorkspaceRootDropHandler();
  const filePath = findWorkspaceRootDropHandlerBundle(recoveredRoot, patcher);

  return [
    replaceWithPatchers(
      recoveredRoot,
      filePath,
      "relocate WindowsApps helper executables into package LocalCache",
      [patcher],
    ),
  ];
}

export function patchBrowserRuntimeRelocation(): SourcePatcher {
  return (source) => {
    const matches = findFunctionRanges(source).filter((range) => {
      const executableNameMatch = new RegExp(
        String.raw`\bexecutableName\s*:\s*(${identifierPattern})\b`,
      ).exec(range.args);
      const runtimeRootMatch = new RegExp(
        String.raw`\bruntimeRoot\s*:\s*(${identifierPattern})\b`,
      ).exec(range.args);
      return (
        executableNameMatch != null &&
        runtimeRootMatch != null &&
        browserRuntimeRelocationMarkers.every((marker) => range.body.includes(marker))
      );
    });

    if (matches.length === 0) {
      return undefined;
    }
    if (matches.length !== 1) {
      throw new Error(
        `Expected exactly one Browser runtime relocation function containing ${browserRuntimeRelocationMarkers.join(", ")}, found ${matches.length}.`,
      );
    }

    const match = matches[0];
    if (match.body.includes(browserRuntimeRelocationAppliedMarker)) {
      return { source, status: "already-applied", matcher: "semantic" };
    }

    const executableNameMatch = new RegExp(
      String.raw`\bexecutableName\s*:\s*(${identifierPattern})\b`,
    ).exec(match.args);
    const runtimeRootMatch = new RegExp(
      String.raw`\bruntimeRoot\s*:\s*(${identifierPattern})\b`,
    ).exec(match.args);
    if (!executableNameMatch?.[1] || !runtimeRootMatch?.[1]) {
      throw new Error("Unable to identify Browser runtime relocation arguments.");
    }

    const executableNameIdentifier = executableNameMatch[1];
    const runtimeRootIdentifier = runtimeRootMatch[1];
    const targetMatches = Array.from(
      match.body.matchAll(
        new RegExp(
          String.raw`\b(${identifierPattern})\s*=\s*\(0,(${identifierPattern})\.join\)\((${identifierPattern}),\s*(${identifierPattern})\)\s*,\s*(${identifierPattern})\s*=\s*\(0,\2\.join\)\(\1,\s*\`bin\`,\s*(${identifierPattern})\)`,
          "g",
        ),
      ),
    );
    if (targetMatches.length !== 1) {
      throw new Error(
        `Expected exactly one Browser runtime relocation target path, found ${targetMatches.length}.`,
      );
    }

    const targetMatch = targetMatches[0];
    const [
      ,
      destinationIdentifier,
      pathIdentifier,
      destinationRootIdentifier,
      currentHashIdentifier,
      executablePathIdentifier,
      targetExecutableNameIdentifier,
    ] = targetMatch;
    if (
      !destinationIdentifier ||
      !pathIdentifier ||
      !destinationRootIdentifier ||
      !currentHashIdentifier ||
      !executablePathIdentifier ||
      !targetExecutableNameIdentifier
    ) {
      throw new Error("Unable to identify Browser runtime relocation path bindings.");
    }
    if (targetExecutableNameIdentifier !== executableNameIdentifier) {
      throw new Error("Browser runtime relocation target uses an unexpected executable binding.");
    }

    const cleanupPattern = new RegExp(
      String.raw`\(0,(${identifierPattern})\.existsSync\)\(${escapeRegExp(destinationIdentifier)}\)&&${identifierPattern}\(\{destinationPath:${escapeRegExp(destinationIdentifier)},executableName:${escapeRegExp(executableNameIdentifier)},operation:\`remove_destination\`,sourcePath:${escapeRegExp(runtimeRootIdentifier)}\},\(\)=>\(0,\1\.rmSync\)\(${escapeRegExp(destinationIdentifier)},\{force:!0,recursive:!0\}\)\)`,
    );
    const cleanupMatch = cleanupPattern.exec(match.body);
    if (!cleanupMatch?.[0]) {
      throw new Error("Unable to identify Browser runtime relocation cleanup.");
    }

    const reservedIdentifiers = new Set(
      `${match.args},${match.body}`.match(new RegExp(identifierPattern, "g")) ?? [],
    );
    const fallbackIndexIdentifier = takeAvailableIdentifier("f", reservedIdentifiers);
    const fallbackNameExpression =
      "`${" + currentHashIdentifier + "}-${++" + fallbackIndexIdentifier + "}`";
    const fallbackDestinationExpression =
      `(0,${pathIdentifier}.join)(${destinationRootIdentifier},${fallbackNameExpression})`;
    const replacement =
      `(()=>{try{${cleanupMatch[0]}}catch{let ${fallbackIndexIdentifier}=0;do{${destinationIdentifier}=${fallbackDestinationExpression}}while((0,${cleanupMatch[1]}.existsSync)(${destinationIdentifier}));${executablePathIdentifier}=(0,${pathIdentifier}.join)(${destinationIdentifier},\`bin\`,${executableNameIdentifier})}})()/* ${browserRuntimeRelocationAppliedMarker} */`;
    const cleanupStart = cleanupMatch.index;
    const body =
      match.body.slice(0, cleanupStart) +
      replacement +
      match.body.slice(cleanupStart + cleanupMatch[0].length);
    const functionReplacement = `${match.asyncPrefix}function ${match.name}(${match.args}){${body}}`;

    return {
      source: source.slice(0, match.start) + functionReplacement + source.slice(match.end),
      status: "applied",
      matcher: "semantic",
    };
  };
}

function patchBrowserRuntimeRelocationBundle(recoveredRoot: string): PatchResult[] {
  const patchName = "use a collision-free Browser runtime cache target";
  const patcher = patchBrowserRuntimeRelocation();
  const buildRoot = path.join(recoveredRoot, ".vite", "build");
  let filePath: string;
  try {
    filePath = findFileForPatcher(
      buildRoot,
      /^.*\.js$/,
      browserRuntimeRelocationMarkers,
      patcher,
      patchName,
    );
  } catch (error) {
    const result = {
      file: toReportPath(recoveredRoot, buildRoot),
      name: patchName,
      status: "failed-required" as const,
      reason: errorMessage(error),
    };
    throw new PatchFailure(result, error);
  }

  return [
    replaceWithPatchers(recoveredRoot, filePath, patchName, [patcher]),
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
    const uniqueHeightIdentifiers = [...new Set(heightIdentifiers)];
    const alreadyPatchedConstants = uniqueHeightIdentifiers
      .map((identifier) => new RegExp(`\\b${escapeRegExp(identifier)}=46\\b`))
      .filter((pattern) => pattern.test(source));
    if (alreadyPatchedConstants.length === 1) {
      return { source, status: "already-applied", matcher: "semantic" };
    }

    const constants = uniqueHeightIdentifiers
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
    results.push(...patchVoiceDictationGates(recoveredRoot));
    results.push(...patchBrowserComputerGates(recoveredRoot));
    results.push(...patchAppGenSitesGates(recoveredRoot));
    results.push(...patchRemoteConnectorsGates(recoveredRoot));
    results.push(...patchPluginsMcpSkillsGates(recoveredRoot));
    results.push(...patchUsageRemainingBundle(recoveredRoot));
    results.push(...patchBrowserDownloadsFeatureGate(recoveredRoot));
    results.push(...patchSidebarProjectsBundle(recoveredRoot));
    results.push(...patchAgentSettings(recoveredRoot));
    results.push(...patchWorkspaceRootDropHandlerBundle(recoveredRoot));
    results.push(...patchBrowserRuntimeRelocationBundle(recoveredRoot));
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

if (require.main === module) {
  main();
}
