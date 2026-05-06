import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.dirname(scriptsRoot);
const patcherPath = path.join(
  desktopRoot,
  ".cache",
  "scripts",
  "patch-windows-self-signed-bundle.js",
);

function writeFixture(filePath, source) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, source, "utf8");
}

function createRecoveredFixture() {
  const recoveredRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-self-signed-patch-"));

  writeFixture(
    path.join(recoveredRoot, "webview", "assets", "settings-page-fixture.js"),
    "let shortcutGate=Gate(`1981165915`);export{shortcutGate};",
  );
  writeFixture(
    path.join(recoveredRoot, "webview", "assets", "index-fixture.js"),
    "let commandGate=FeatureGate(`1981165915`);function buildFlags(user,base,remote,rest){return{...base,...remote,[workspaceKey]:isOn(user,flag)&&groupFor(user,group).groupName===`Test`,...rest}}",
  );
  writeFixture(
    path.join(recoveredRoot, "webview", "assets", "agent-settings-fixture.js"),
    "let showBeta=featureGate(betaFlag),workspaceDependencies=featureGate(`2106641128`);export{showBeta,workspaceDependencies};",
  );
  writeFixture(
    path.join(recoveredRoot, ".vite", "build", "workspace-root-drop-handler-fixture.js"),
    "function localBin(parts){return(0,path.join)(process.env.LOCALAPPDATA??(0,path.join)((0,os.homedir)(),`AppData`,`Local`),...parts)}",
  );
  writeFixture(
    path.join(recoveredRoot, ".vite", "build", "main-fixture.js"),
    "function zx(config){return typeof config!=`object`||!config?!1:Object.entries(config).some(([name,value])=>name===`workspace_dependencies`&&value===!0)}async function qp(client){let load=async cursor=>{let response=await client.sendAppServerRequest(`experimentalFeature/list`,{cursor,limit:100});return response.data.some(feature=>feature.name===`workspace_dependencies`&&feature.enabled===!0)?!0:response.nextCursor==null?!1:load(response.nextCursor)};return load(null)}",
  );

  return recoveredRoot;
}

function runPatcher(recoveredRoot, reportPath) {
  const args = [patcherPath, "--recovered-root", recoveredRoot];
  if (reportPath) {
    args.push("--report-json", reportPath);
  }

  return spawnSync(process.execPath, args, {
    cwd: desktopRoot,
    encoding: "utf8",
  });
}

test("writes patch report file paths relative to the recovered app root", () => {
  const recoveredRoot = createRecoveredFixture();
  const reportPath = path.join(recoveredRoot, "patch-report.json");

  const result = runPatcher(recoveredRoot, reportPath);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  assert.deepEqual(
    report.patches.map((patch) => patch.file),
    [
      "webview/assets/settings-page-fixture.js",
      "webview/assets/index-fixture.js",
      "webview/assets/index-fixture.js",
      "webview/assets/agent-settings-fixture.js",
      ".vite/build/workspace-root-drop-handler-fixture.js",
      ".vite/build/main-fixture.js",
      ".vite/build/main-fixture.js",
    ],
  );
  assert.ok(report.patches.every((patch) => !path.isAbsolute(patch.file)));
  assert.ok(report.patches.every((patch) => !patch.file.includes("..")));
});

test("reports a missing gate target as assumed enabled and continues", () => {
  const recoveredRoot = createRecoveredFixture();
  const indexPath = path.join(recoveredRoot, "webview", "assets", "index-fixture.js");
  fs.writeFileSync(indexPath, "let unrelated=!0;", "utf8");
  const reportPath = path.join(recoveredRoot, "patch-report.json");

  const result = runPatcher(recoveredRoot, reportPath);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  assert.equal(report.patches[1].name, "enable keyboard shortcuts command menu entries");
  assert.equal(report.patches[1].status, "assumed-enabled");
  assert.equal(report.patches[1].file, "webview/assets/index-fixture.js");
  assert.match(report.patches[1].reason, /Gate target was not found/);
  assert.equal(report.patches.at(-1).name, "enable workspace dependencies app-server feature check");
  assert.equal(report.patches.at(-1).status, "applied");
});

test("fails when a required gate marker remains but no patcher matches", () => {
  const recoveredRoot = createRecoveredFixture();
  fs.writeFileSync(
    path.join(recoveredRoot, "webview", "assets", "settings-page-fixture.js"),
    "let h=!0,shortcutGate=Gate(\"1981165915\");export{shortcutGate};",
    "utf8",
  );
  const reportPath = path.join(recoveredRoot, "patch-report.json");

  const result = runPatcher(recoveredRoot, reportPath);

  assert.notEqual(result.status, 0);
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  assert.equal(report.patches[0].name, "enable keyboard shortcuts settings section");
  assert.equal(report.patches[0].status, "failed-required");
  assert.match(report.patches[0].reason, /required marker\(s\) are still present: 1981165915/);
});

test("patches function ranges when bundle literals contain braces", () => {
  const recoveredRoot = createRecoveredFixture();
  fs.writeFileSync(
    path.join(recoveredRoot, ".vite", "build", "main-fixture.js"),
    "function zx(config){let text=\"{not code\";let pattern=/\\{not-code\\}/;return typeof config!=`object`||!config?!1:Object.entries(config).some(([name,value])=>name===`workspace_dependencies`&&value===!0)}async function qp(client){let ignored=`literal ${\"{still string}\"}`;let load=async cursor=>{let response=await client.sendAppServerRequest(`experimentalFeature/list`,{cursor,limit:100});return response.data.some(feature=>feature.name===`workspace_dependencies`&&feature.enabled===!0)?!0:response.nextCursor==null?!1:load(response.nextCursor)};return load(null)}",
    "utf8",
  );
  const reportPath = path.join(recoveredRoot, "patch-report.json");

  const result = runPatcher(recoveredRoot, reportPath);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const mainBundle = fs.readFileSync(
    path.join(recoveredRoot, ".vite", "build", "main-fixture.js"),
    "utf8",
  );
  assert.match(mainBundle, /function zx\(config\)\{return!0\}/);
  assert.match(mainBundle, /async function qp\(client\)\{return!0\}/);
});

test("patches function ranges when regex literals follow keywords", () => {
  const recoveredRoot = createRecoveredFixture();
  fs.writeFileSync(
    path.join(recoveredRoot, ".vite", "build", "main-fixture.js"),
    "function zx(config){return /}/.test(`}`)||typeof config!=`object`||!config?!1:Object.entries(config).some(([name,value])=>name===`workspace_dependencies`&&value===!0)}async function qp(client){return!0}",
    "utf8",
  );
  const reportPath = path.join(recoveredRoot, "patch-report.json");

  const result = runPatcher(recoveredRoot, reportPath);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  assert.equal(report.patches.at(-2).name, "enable workspace dependencies static gate");
  assert.equal(report.patches.at(-2).status, "applied");
  assert.equal(report.patches.at(-1).name, "enable workspace dependencies app-server feature check");
  assert.equal(report.patches.at(-1).status, "already-applied");
});

test("does not let one main-bundle gate marker fail the other gate patch", () => {
  const recoveredRoot = createRecoveredFixture();
  fs.writeFileSync(
    path.join(recoveredRoot, ".vite", "build", "main-fixture.js"),
    "function zx(config){return!0}async function qp(client){let load=async cursor=>{let response=await client.sendAppServerRequest(`experimentalFeature/list`,{cursor,limit:100});return response.data.some(feature=>feature.name===`workspace_dependencies`&&feature.enabled===!0)?!0:response.nextCursor==null?!1:load(response.nextCursor)};return load(null)}",
    "utf8",
  );
  const reportPath = path.join(recoveredRoot, "patch-report.json");

  const result = runPatcher(recoveredRoot, reportPath);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  assert.equal(report.patches.at(-2).name, "enable workspace dependencies static gate");
  assert.equal(report.patches.at(-2).status, "already-applied");
  assert.equal(report.patches.at(-1).name, "enable workspace dependencies app-server feature check");
  assert.equal(report.patches.at(-1).status, "applied");
});

test("keeps workspace dependency feature-map already-applied evidence contextual", () => {
  const recoveredRoot = createRecoveredFixture();
  fs.writeFileSync(
    path.join(recoveredRoot, "webview", "assets", "index-fixture.js"),
    "let commandGate=FeatureGate(`1981165915`);const unrelated={workspace_dependencies:!0};function buildFlags(user,base,remote,rest){return{...base,...remote,[workspaceKey]:isOn(user,flag)&&groupFor(user,group).groupName===`Test`,...rest}}",
    "utf8",
  );
  const reportPath = path.join(recoveredRoot, "patch-report.json");

  const result = runPatcher(recoveredRoot, reportPath);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const featureMapPatch = report.patches.find(
    (patch) => patch.name === "include workspace dependencies in default feature map",
  );
  assert.equal(featureMapPatch?.status, "applied");
  assert.match(
    fs.readFileSync(path.join(recoveredRoot, "webview", "assets", "index-fixture.js"), "utf8"),
    /return\{\.\.\.base,\.\.\.remote,workspace_dependencies:!0,\[workspaceKey\]:/,
  );
});

test("patches self-signed Windows gates when upstream minifier names change", () => {
  const recoveredRoot = createRecoveredFixture();
  const reportPath = path.join(recoveredRoot, "patch-report.json");

  const result = runPatcher(recoveredRoot, reportPath);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(
    fs.readFileSync(
      path.join(recoveredRoot, "webview", "assets", "settings-page-fixture.js"),
      "utf8",
    ),
    /shortcutGate=!0/,
  );
  assert.match(
    fs.readFileSync(path.join(recoveredRoot, "webview", "assets", "index-fixture.js"), "utf8"),
    /commandGate=!0/,
  );
  assert.match(
    fs.readFileSync(path.join(recoveredRoot, "webview", "assets", "index-fixture.js"), "utf8"),
    /workspace_dependencies:!0/,
  );
  assert.match(
    fs.readFileSync(
      path.join(recoveredRoot, "webview", "assets", "agent-settings-fixture.js"),
      "utf8",
    ),
    /showBeta=!0,workspaceDependencies=!0/,
  );
  assert.match(
    fs.readFileSync(
      path.join(recoveredRoot, ".vite", "build", "workspace-root-drop-handler-fixture.js"),
      "utf8",
    ),
    /function localBin\(parts\)\{let t=process\.env\.LOCALAPPDATA/,
  );
  assert.match(
    fs.readFileSync(
      path.join(recoveredRoot, ".vite", "build", "workspace-root-drop-handler-fixture.js"),
      "utf8",
    ),
    /process\.resourcesPath\?\.replace/,
  );
  assert.match(
    fs.readFileSync(
      path.join(recoveredRoot, ".vite", "build", "workspace-root-drop-handler-fixture.js"),
      "utf8",
    ),
    /`Packages`,`\$\{n\[1\]\}_\$\{n\[2\]\}`,`LocalCache`,`Local`/,
  );
  assert.match(
    fs.readFileSync(path.join(recoveredRoot, ".vite", "build", "main-fixture.js"), "utf8"),
    /function zx\(config\)\{return!0\}/,
  );
  assert.match(
    fs.readFileSync(path.join(recoveredRoot, ".vite", "build", "main-fixture.js"), "utf8"),
    /async function qp\(client\)\{return!0\}/,
  );

  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  assert.equal(report.patches.length, 7);
  assert.ok(report.patches.every((patch) => patch.status === "applied"));
});

test("uses collision-free locals when relocation helper names are minified", () => {
  const recoveredRoot = createRecoveredFixture();
  const workspaceRootDropHandlerPath = path.join(
    recoveredRoot,
    ".vite",
    "build",
    "workspace-root-drop-handler-fixture.js",
  );
  fs.writeFileSync(
    workspaceRootDropHandlerPath,
    "function t(n){return(0,e.join)(process.env.LOCALAPPDATA??(0,e.join)((0,r.homedir)(),`AppData`,`Local`),...n)}",
    "utf8",
  );
  const reportPath = path.join(recoveredRoot, "patch-report.json");

  const result = runPatcher(recoveredRoot, reportPath);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const bundle = fs.readFileSync(workspaceRootDropHandlerPath, "utf8");
  assert.match(bundle, /function t\(n\)\{let _t=process\.env\.LOCALAPPDATA/);
  assert.match(bundle, /,_n=process\.resourcesPath\?\.replace/);
  assert.match(
    bundle,
    /return\(0,e\.join\)\(_n\?\(0,e\.join\)\(_t,`Packages`,`\$\{_n\[1\]\}_\$\{_n\[2\]\}`,`LocalCache`,`Local`\):_t,\.\.\.n\)/,
  );
  assert.doesNotMatch(bundle, /function t\(n\)\{let t=/);
  assert.doesNotMatch(bundle, /function t\(n\)\{let [^}]*,n=process\.resourcesPath/);
});

test("uses collision-free locals when relocation helper imports are minified", () => {
  const recoveredRoot = createRecoveredFixture();
  const workspaceRootDropHandlerPath = path.join(
    recoveredRoot,
    ".vite",
    "build",
    "workspace-root-drop-handler-fixture.js",
  );
  fs.writeFileSync(
    workspaceRootDropHandlerPath,
    "function r(e){return(0,t.join)(process.env.LOCALAPPDATA??(0,t.join)((0,n.homedir)(),`AppData`,`Local`),...e)}",
    "utf8",
  );
  const reportPath = path.join(recoveredRoot, "patch-report.json");

  const result = runPatcher(recoveredRoot, reportPath);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const bundle = fs.readFileSync(workspaceRootDropHandlerPath, "utf8");
  assert.match(bundle, /function r\(e\)\{let _t=process\.env\.LOCALAPPDATA/);
  assert.match(bundle, /,_n=process\.resourcesPath\?\.replace/);
  assert.match(
    bundle,
    /return\(0,t\.join\)\(_n\?\(0,t\.join\)\(_t,`Packages`,`\$\{_n\[1\]\}_\$\{_n\[2\]\}`,`LocalCache`,`Local`\):_t,\.\.\.e\)/,
  );
  assert.doesNotMatch(bundle, /function r\(e\)\{let t=/);
  assert.doesNotMatch(bundle, /function r\(e\)\{let [^}]*,n=process\.resourcesPath/);
});

test("does not fail or rewrite when self-signed Windows gate patches run again", () => {
  const recoveredRoot = createRecoveredFixture();
  const reportPath = path.join(recoveredRoot, "patch-report.json");

  const first = runPatcher(recoveredRoot, reportPath);
  assert.equal(first.status, 0, first.stderr || first.stdout);
  const files = [
    path.join(recoveredRoot, "webview", "assets", "settings-page-fixture.js"),
    path.join(recoveredRoot, "webview", "assets", "index-fixture.js"),
    path.join(recoveredRoot, "webview", "assets", "agent-settings-fixture.js"),
    path.join(recoveredRoot, ".vite", "build", "workspace-root-drop-handler-fixture.js"),
    path.join(recoveredRoot, ".vite", "build", "main-fixture.js"),
  ];
  const before = new Map(files.map((file) => [file, fs.readFileSync(file, "utf8")]));

  const second = runPatcher(recoveredRoot, reportPath);

  assert.equal(second.status, 0, second.stderr || second.stdout);
  for (const file of files) {
    assert.equal(fs.readFileSync(file, "utf8"), before.get(file));
  }
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  assert.equal(report.patches.length, 7);
  assert.ok(
    report.patches.every((patch) =>
      ["already-applied", "assumed-enabled"].includes(patch.status),
    ),
  );
});
