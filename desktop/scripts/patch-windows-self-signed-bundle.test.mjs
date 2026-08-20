import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.dirname(scriptsRoot);
const require = createRequire(import.meta.url);
const patcherModule = require(
  path.join(desktopRoot, ".cache", "scripts", "patch-windows-self-signed-bundle.js"),
);
const {
  patchBrowserRuntimeRelocation,
  patchFeatureGateCalls,
  patchInactiveWindowsMicaBackdrop,
  patchWindowsArm64PrimaryRuntimeManifestUrl,
  patchWorkspaceRootDropHandler,
  toReportPath,
} = patcherModule;
const { replaceChatGptProductTextInJavaScriptStrings } = require(
  path.join(desktopRoot, ".cache", "scripts", "javascript-product-text.js"),
);
const tick = String.fromCharCode(96);
const templateExpression = "$" + "{";

function applyPatch(patcher, source) {
  const result = patcher(source);
  assert.ok(result);
  assert.equal(result.status, "applied");
  return result.source;
}

function createBrowserRuntimeSource() {
  return [
    "function tP({executableName:e,runtimeRoot:t}){",
    "let n=dP([" + tick + "OpenAI" + tick + "," + tick + "Codex" + tick + "," + tick + "runtimes" + tick + ",RN]),r=VN.get(t);",
    "if(r!=null)return(0,i.join)(r," + tick + "bin" + tick + ",e);",
    "let a=[" +
      tick +
      "manifest.json" +
      tick +
      "," +
      tick +
      "bin/node.exe" +
      tick +
      "," +
      tick +
      "bin/node_repl.exe" +
      tick +
      "," +
      tick +
      "node_modules" +
      tick +
      "," +
      tick +
      "mkdir_staging" +
      tick +
      "," +
      tick +
      "copy_directory" +
      tick +
      "," +
      tick +
      "rename_staging" +
      tick +
      "],o=oP(a).slice(0,16),s=(0,i.join)(n,o),l=(0,i.join)(s," +
      tick +
      "bin" +
      tick +
      ",e);",
    "if((0,c.existsSync)(s)&&hP({destinationPath:s,executableName:e,operation:" +
      tick +
      "remove_destination" +
      tick +
      ",sourcePath:t},()=>(0,c.rmSync)(s,{force:!0,recursive:!0})))return l;",
    "VN.set(t,s);return l}",
  ].join("");
}

function createBrowserRuntimeHarness(bundle) {
  const harnessRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-browser-runtime-"));
  const cacheRoot = path.join(harnessRoot, "cache");
  const runtimeRoot = path.join(harnessRoot, "runtime");
  const lockedTarget = path.join(
    cacheRoot,
    "OpenAI",
    "Codex",
    "runtimes",
    "runtime",
    "runtime-hash",
  );
  fs.mkdirSync(lockedTarget, { recursive: true });

  const logs = [];
  const runtime = new Function(
    "pathModule",
    "fsModule",
    "cacheRoot",
    "lockedTarget",
    "logs",
    [
      "const i={join:pathModule.join};",
      "const c={",
      "  existsSync:target=>fsModule.existsSync(target),",
      "  rmSync:(target,options)=>{if(target===lockedTarget){const error=new Error('locked');error.code='EPERM';throw error}return fsModule.rmSync(target,options)},",
      "};",
      "const RN='runtime';",
      "const VN=new Map();",
      "function dP(parts){return pathModule.join(cacheRoot,...parts)}",
      "function oP(){return 'runtime-hash'}",
      "function hP(operation,callback){logs.push(operation.operation);return callback()}",
      bundle,
      "return {relocate:tP};",
    ].join("\n"),
  )(path, fs, cacheRoot, lockedTarget, logs);

  return { cacheRoot, logs, relocate: runtime.relocate, runtimeRoot };
}

test("reports recovered-app paths without exposing absolute paths", () => {
  const recoveredRoot = path.resolve("recovered-app");

  assert.equal(
    toReportPath(recoveredRoot, path.join(recoveredRoot, ".vite", "build", "main.js")),
    ".vite/build/main.js",
  );
  assert.throws(
    () => toReportPath(recoveredRoot, path.join(path.dirname(recoveredRoot), "outside.js")),
    /outside recovered app root/,
  );
});

test("replaces product text only inside JavaScript strings and templates", () => {
  const source = [
    'const quoted="ChatGPT";',
    'const template=' + tick + "ChatGPT " + templateExpression + '"ChatGPT"} ' + templateExpression + "ChatGPT}" + tick + ";",
    "const regex=/ChatGPT/g;",
    "// ChatGPT",
    "const header=" + tick + "ChatGPT-Account-ID" + tick + ";",
  ].join("\n");
  const expected = [
    'const quoted="Codex";',
    'const template=' + tick + "Codex " + templateExpression + '"Codex"} ' + templateExpression + "ChatGPT}" + tick + ";",
    "const regex=/ChatGPT/g;",
    "// ChatGPT",
    "const header=" + tick + "ChatGPT-Account-ID" + tick + ";",
  ].join("\n");

  const result = replaceChatGptProductTextInJavaScriptStrings(source);

  assert.equal(result.source, expected);
  assert.equal(result.replacementCount, 3);
});

test("feature-gate matching supports one- and two-argument calls with polarity", () => {
  const source =
    "const first=read(" +
    tick +
    "one" +
    tick +
    "),second=read(context," +
    tick +
    "two" +
    tick +
    "),untouched=read(" +
    tick +
    "other" +
    tick +
    ");";
  const result = patchFeatureGateCalls(source, [
    { id: "one", value: "!0" },
    { id: "two", value: "!1" },
  ]);

  assert.equal(
    result.source,
    "const first=!0,second=!1,untouched=read(" +
      tick +
      "other" +
      tick +
      ");",
  );
  assert.deepEqual(result.matchedIds, ["one", "two"]);
});

test("keeps Mica enabled for inactive non-dark windows", () => {
  const source = [
    "function isDark(appearance){return appearance===" + tick + "dark" + tick + "}",
    "function backdrop({appearance:a,isFocused:f,platform:p}){return!f&&!isDark(a)&&(p===" +
      tick +
      "darwin" +
      tick +
      "||p===" +
      tick +
      "win32" +
      tick +
      ")}",
  ].join("");
  const patched = applyPatch(patchInactiveWindowsMicaBackdrop(), source);
  const evaluate = new Function(patched + ";return backdrop(arguments[0]);");

  assert.equal(evaluate({ appearance: "light", isFocused: false, platform: "win32" }), false);
  assert.equal(evaluate({ appearance: "light", isFocused: false, platform: "darwin" }), true);
});

test("routes only the latest Windows ARM64 primary runtime manifest to GitHub", () => {
  const source = [
    "const publicBase=" + tick + "https://persistent.oaistatic.com" + tick + ";",
    'function targetKey(target){return target.platform+"-"+target.arch}',
    "function manifest(target,config,release){return[config.baseUrl??(release===" +
      tick +
      "latest" +
      tick +
      "?publicBase:" +
      tick +
      "https://oaisidekickupdates.blob.core.windows.net/owl" +
      tick +
      "),"+
      tick +
      "runtime" +
      tick +
      ",...release===" +
      tick +
      "latest-alpha" +
      tick +
      "?[" +
      tick +
      "alpha" +
      tick +
      "]:[]," +
      tick +
      "latest" +
      tick +
      ",targetKey(target)," +
      tick +
      "LATEST.json" +
      tick +
      "].join(" +
      tick +
      "/" +
      tick +
      ")}",
  ].join("");
  const patched = applyPatch(patchWindowsArm64PrimaryRuntimeManifestUrl(), source);
  const evaluate = new Function(patched + ";return manifest(arguments[0],arguments[1],arguments[2]);");

  assert.equal(
    evaluate({ platform: "win32", arch: "arm64" }, {}, "latest"),
    "https://github.com/sliepie/codex-app/releases/download/codex-primary-runtime-win32-arm64/LATEST.json",
  );
  assert.equal(
    evaluate({ platform: "win32", arch: "x64" }, {}, "latest"),
    "https://persistent.oaistatic.com/runtime/win32-x64/LATEST.json",
  );
  assert.equal(
    evaluate({ platform: "win32", arch: "arm64" }, {}, "latest-alpha"),
    "https://oaisidekickupdates.blob.core.windows.net/owl/runtime/alpha/latest/win32-arm64/LATEST.json",
  );
});

test("uses a collision-free Browser runtime destination when cleanup is locked", () => {
  const patcher = patchBrowserRuntimeRelocation();
  const result = patcher(createBrowserRuntimeSource());
  assert.ok(result);
  assert.equal(result.status, "applied");

  const harness = createBrowserRuntimeHarness(result.source);
  const first = harness.relocate({
    executableName: "node.exe",
    runtimeRoot: harness.runtimeRoot,
  });
  const fallbackRoot = path.join(
    harness.cacheRoot,
    "OpenAI",
    "Codex",
    "runtimes",
    "runtime",
    "runtime-hash-1",
  );

  assert.equal(first, path.join(fallbackRoot, "bin", "node.exe"));
  assert.ok(harness.logs.includes("remove_destination"));

  harness.logs.length = 0;
  const second = harness.relocate({
    executableName: "node.exe",
    runtimeRoot: harness.runtimeRoot,
  });
  assert.equal(second, first);
  assert.deepEqual(harness.logs, []);

  const repeated = patcher(result.source);
  assert.ok(repeated);
  assert.equal(repeated.status, "already-applied");
});

test("rejects a drifted Browser runtime cleanup target before writing", () => {
  const drifted = createBrowserRuntimeSource().replace(
    "remove_destination",
    "remove_runtime_destination",
  );

  assert.throws(
    () => patchBrowserRuntimeRelocation()(drifted),
    /Unable to identify Browser runtime relocation cleanup/,
  );
});

test("uses the package LocalCache path for WindowsApps helpers without local-name assumptions", () => {
  const source =
    "function localBin(parts){return(0,e.join)(process.env.LOCALAPPDATA??(0,e.join)((0,r.homedir)()," +
    tick +
    "AppData" +
    tick +
    "," +
    tick +
    "Local" +
    tick +
    "),...parts)}";
  const patched = applyPatch(patchWorkspaceRootDropHandler(), source);
  const localAppData = path.join("C:", "Users", "test", "AppData", "Local");
  const resourcesPath = path.join(
    "C:",
    "Program Files",
    "WindowsApps",
    "Codex_1.0.0.0_x64__abcd",
    "app",
    "resources",
  );
  const evaluate = new Function(
    "e",
    "r",
    "process",
    patched + ";return localBin(['bin','node.exe']);",
  );

  assert.equal(
    evaluate(
      { join: path.join },
      { homedir: () => path.join("C:", "Users", "test") },
      { env: { LOCALAPPDATA: localAppData }, resourcesPath },
    ),
    path.join(
      localAppData,
      "Packages",
      "Codex_abcd",
      "LocalCache",
      "Local",
      "bin",
      "node.exe",
    ),
  );
});
