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
const indexFeatureTargets =
  "var YA=[`apps`,`memories`,`plugins`,`tool_call_mcp_elicitation`,`tool_search`,`tool_suggest`,kr];function QA(){J.dispatchMessage(`electron-desktop-features-changed`,{avatarOverlay:n,ambientSuggestions:r,artifactsPane:!0,browserAgent:a.available,browserAgentAvailable:a.available,browserPane:i,computerUse:c.available,computerUseNodeRepl:c.available&&l,control:u,multiWindow:d})}";
const sidebarPixelTargets =
  "function Sidebar(){let A=C.formatMessage({id:`sidebarElectron.recentChats`,defaultMessage:`Chats`}),rr=(0,$.jsx)(`div`,{className:`flex min-w-0 flex-1`,children:(0,$.jsx)(av,{collapsed:At.chats,onToggle:()=>{},children:A})}),ir=(0,$.jsx)(G_,{items:on,ariaLabel:A,currentThreadKey:y,onActivateThread:x,className:`-translate-x-px`,itemClassName:`after:block after:h-px after:content-[''] last:after:hidden`,itemWrapper:ke?Tg:void 0,emptyState:(0,$.jsx)(Y,{id:`sidebarElectron.noRecentChats`,defaultMessage:`No chats`,description:`Empty state for projectless chats in the sidebar`}),emptyStateClassName:`text-token-description-foreground p-2 text-base opacity-50`,rowOptions:{hideRemoteHostEnvIcon:!1,showPinActionOnHover:!0,getSectionContextMenuItems:Kt}}),ar=bt?(0,$.jsx)(`div`,{className:`px-row-x`,...ne.sidebarSection({collapsed:At.chats,heading:`Chats`}),children:(0,$.jsx)(Zd,{title:rr})}):null;return[rr,ir,ar]}function Row(){return(0,$.jsx)(L_,{conversationId:N,isAutomationRun:i,hasPendingChildApproval:c,isActive:u,forceLoadingIndicator:t&&l,className:s?`opacity-50`:void 0,rowContentClassName:Dc(t&&(D?`ml-10`:`ml-5`),g&&`pr-3 group-focus-within:[mask-image:linear-gradient(to_right,transparent_0,transparent_21px,black_26px)] group-hover:[mask-image:linear-gradient(to_right,transparent_0,transparent_21px,black_26px)]`),envIconLocation:`end`,dataAttributes:ne.sidebarThreadRow({kind:`local`,title:H})})}function vy(){let C=(0,$.jsx)(`div`,{className:`min-w-0 flex-1`,children:(0,$.jsx)(cn,{triggerButton:(0,$.jsx)(Qd,{icon:b,label:x,onClick:yy,trailing:S,iconClassName:`icon-sm`})})});return C}let settingsLabel={id:`codex.profileFooter.signedInFallback`};";

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
];
const enabledDesktopFeatureGateTargets = enabledDesktopFeatureGateIds
  .map((id, index) => `selectedGate${index}=FeatureGate(\`${id}\`)`)
  .join(",");

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
    `let commandGate=FeatureGate(\`1981165915\`),${enabledDesktopFeatureGateTargets};function buildFlags(user,base,remote,rest){return{...base,...remote,[workspaceKey]:isOn(user,flag)&&groupFor(user,group).groupName===\`Test\`,...rest}}${indexFeatureTargets}${sidebarPixelTargets}`,
  );
  writeFixture(
    path.join(recoveredRoot, "webview", "assets", "composer-fixture.js"),
    "const noResults=`composer.slashCommands.noResults`,empty=`requiresEmptyComposer`;function hU(e){let t=(0,$.c)(16),{composerController:n,slashCommands:r,onOpenCommandContent:i}=e,a=F(n,_U),o=F(n,gU),s=(0,Z.useRef)(null),c;if(t[0]!==a||t[1]!==r||t[2]!==o){let e=lx(r,ux(a));c=o?.active?cx(e,o.query):e,t[0]=a,t[1]=r,t[2]=o,t[3]=c}else c=t[3];return c}",
  );
  writeFixture(
    path.join(recoveredRoot, "webview", "assets", "agent-settings-fixture.js"),
    "let showBeta=featureGate(betaFlag),workspaceDependencies=featureGate(`2106641128`);export{showBeta,workspaceDependencies};",
  );
  writeFixture(
    path.join(recoveredRoot, "webview", "assets", "use-model-settings-fixture.js"),
    "let downloadLabel=`imagePreviewDialog.download`,closeLabel=`imagePreviewDialog.close`;function imagePreview(){return(0,Y.jsxs)(`div`,{className:`absolute top-3 right-3 z-10 flex items-center gap-2`,children:[downloadButton,closeButton]})}",
  );
  writeFixture(
    path.join(recoveredRoot, ".vite", "build", "workspace-root-drop-handler-fixture.js"),
    "function localBin(parts){return(0,path.join)(process.env.LOCALAPPDATA??(0,path.join)((0,os.homedir)(),`AppData`,`Local`),...parts)}",
  );
  writeFixture(
    path.join(recoveredRoot, ".vite", "build", "primary-runtime-installer-fixture.js"),
    "var runtimeRoot=`codex-primary-runtime`,latestFile=`LATEST.json`,publicBase=`https://persistent.oaistatic.com`,loggerName=`codex-primary-runtime-installer`;function targetKey(target){return`${platformName(target.platform)}-${archName(target.arch)}`}function manifestUrl(target,config,release){return[(config.baseUrl??(release===`latest`?publicBase:`https://oaisidekickupdates.blob.core.windows.net/owl`)).replace(/\\/+$/,``),runtimeRoot,...release===`latest-alpha`?[`alpha`]:[],`latest`,targetKey(target),latestFile].join(`/`)}async function fetchManifest(url){let response=await fetch(url,{headers:{\"User-Agent\":`codex-primary-runtime-installer`}});if(!response.ok)throw Error(`Failed to download primary runtime manifest (${response.status} ${response.statusText}).`);return response.json()}",
  );
  writeFixture(
    path.join(recoveredRoot, ".vite", "build", "main-fixture.js"),
    "var dM=`#00000000`,vM=36,yM=`#1f1f1f`,bM=`#ffffff`;function xM(){return{color:dM,symbolColor:n.nativeTheme.shouldUseDarkColors?bM:yM,height:vM}}function IM(platform){return platform===`win32`?{titleBarStyle:`hidden`,titleBarOverlay:xM()}:null}function w2(appearance){return appearance===`dark`}function D2({appearance:e,isFocused:t,platform:n}){return!t&&!w2(e)&&(n===`darwin`||n===`win32`)}function applyWindowBackdrop(window,backgroundMaterial){window.setBackgroundMaterial(backgroundMaterial);return{backgroundMaterial}}function zx(config){return typeof config!=`object`||!config?!1:Object.entries(config).some(([name,value])=>name===`workspace_dependencies`&&value===!0)}async function qp(client){let load=async cursor=>{let response=await client.sendAppServerRequest(`experimentalFeature/list`,{cursor,limit:100});return response.data.some(feature=>feature.name===`workspace_dependencies`&&feature.enabled===!0)?!0:response.nextCursor==null?!1:load(response.nextCursor)};return load(null)}",
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

function moveIndexFixtureToAppMain(recoveredRoot) {
  const assetsRoot = path.join(recoveredRoot, "webview", "assets");
  const appMainPath = path.join(assetsRoot, "app-main-fixture.js");
  fs.renameSync(path.join(assetsRoot, "index-fixture.js"), appMainPath);
  return appMainPath;
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
      "webview/assets/index-fixture.js",
      "webview/assets/agent-settings-fixture.js",
      ".vite/build/workspace-root-drop-handler-fixture.js",
      ".vite/build/primary-runtime-installer-fixture.js",
      ".vite/build/main-fixture.js",
      ".vite/build/main-fixture.js",
      ".vite/build/main-fixture.js",
    ],
  );
  assert.ok(report.patches.every((patch) => !path.isAbsolute(patch.file)));
  assert.ok(report.patches.every((patch) => !patch.file.includes("..")));
});

test("routes Windows ARM64 primary runtime manifest checks to GitHub Releases", () => {
  const recoveredRoot = createRecoveredFixture();
  const primaryRuntimeInstallerPath = path.join(
    recoveredRoot,
    ".vite",
    "build",
    "primary-runtime-installer-fixture.js",
  );
  const reportPath = path.join(recoveredRoot, "patch-report.json");

  const result = runPatcher(recoveredRoot, reportPath);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const bundle = fs.readFileSync(primaryRuntimeInstallerPath, "utf8");
  assert.match(
    bundle,
    /release===`latest`&&targetKey\(target\)===`win32-arm64`\)return`https:\/\/github\.com\/sliepie\/codex-app\/releases\/download\/codex-primary-runtime-win32-arm64\/LATEST\.json`/,
  );
  assert.match(bundle, /oaisidekickupdates\.blob\.core\.windows\.net\/owl/);

  const evaluateManifestUrl = new Function(
    `${bundle};function platformName(value){return value}function archName(value){return value}return manifestUrl(arguments[0],arguments[1],arguments[2]);`,
  );
  assert.equal(
    evaluateManifestUrl({ platform: "win32", arch: "arm64" }, {}, "latest"),
    "https://github.com/sliepie/codex-app/releases/download/codex-primary-runtime-win32-arm64/LATEST.json",
  );
  assert.equal(
    evaluateManifestUrl({ platform: "win32", arch: "x64" }, {}, "latest"),
    "https://persistent.oaistatic.com/codex-primary-runtime/latest/win32-x64/LATEST.json",
  );
  assert.equal(
    evaluateManifestUrl({ platform: "win32", arch: "arm64" }, {}, "latest-alpha"),
    "https://oaisidekickupdates.blob.core.windows.net/owl/codex-primary-runtime/alpha/latest/win32-arm64/LATEST.json",
  );
  assert.equal(
    evaluateManifestUrl(
      { platform: "win32", arch: "arm64" },
      { baseUrl: "https://example.test/runtime" },
      "latest",
    ),
    "https://example.test/runtime/codex-primary-runtime/latest/win32-arm64/LATEST.json",
  );

  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const patch = report.patches.find(
    (patch) => patch.name === "route Windows ARM64 primary runtime manifest to GitHub release",
  );
  assert.equal(patch?.status, "applied");
  assert.equal(patch?.file, ".vite/build/primary-runtime-installer-fixture.js");
});

test("routes legacy Windows ARM64 primary runtime manifest helpers outside installer bundles", () => {
  const recoveredRoot = createRecoveredFixture();
  const primaryRuntimeInstallerPath = path.join(
    recoveredRoot,
    ".vite",
    "build",
    "primary-runtime-installer-fixture.js",
  );
  const workspaceRootDropHandlerPath = path.join(
    recoveredRoot,
    ".vite",
    "build",
    "workspace-root-drop-handler-fixture.js",
  );
  fs.unlinkSync(primaryRuntimeInstallerPath);
  fs.writeFileSync(
    workspaceRootDropHandlerPath,
    "var runtimeRoot=`codex-primary-runtime`,latestFile=`LATEST.json`,publicBase=`https://persistent.oaistatic.com`;function targetKey(target){return`${platformName(target.platform)}-${archName(target.arch)}`}function manifestUrl(target,config,release){return[(config.baseUrl??(release===`latest`?publicBase:`https://oaisidekickupdates.blob.core.windows.net/owl`)).replace(/\\\\/+$/,``),runtimeRoot,...release===`latest-alpha`?[`alpha`]:[],`latest`,targetKey(target),latestFile].join(`/`)}function localBin(parts){return(0,path.join)(process.env.LOCALAPPDATA??(0,path.join)((0,os.homedir)(),`AppData`,`Local`),...parts)}",
    "utf8",
  );
  const reportPath = path.join(recoveredRoot, "patch-report.json");

  const result = runPatcher(recoveredRoot, reportPath);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const bundle = fs.readFileSync(workspaceRootDropHandlerPath, "utf8");
  assert.match(bundle, /github\.com\/sliepie\/codex-app\/releases\/download\/codex-primary-runtime-win32-arm64\/LATEST\.json/);
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const patch = report.patches.find(
    (patch) => patch.name === "route Windows ARM64 primary runtime manifest to GitHub release",
  );
  assert.equal(patch?.status, "applied");
  assert.equal(patch?.file, ".vite/build/workspace-root-drop-handler-fixture.js");
});

test("assumes primary runtime manifest route is enabled when target bundle is absent", () => {
  const recoveredRoot = createRecoveredFixture();
  fs.unlinkSync(
    path.join(recoveredRoot, ".vite", "build", "primary-runtime-installer-fixture.js"),
  );
  const reportPath = path.join(recoveredRoot, "patch-report.json");

  const result = runPatcher(recoveredRoot, reportPath);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const patch = report.patches.find(
    (patch) => patch.name === "route Windows ARM64 primary runtime manifest to GitHub release",
  );
  assert.equal(patch?.status, "assumed-enabled");
  assert.equal(patch?.file, ".vite/build");
  assert.match(patch?.reason, /Primary runtime manifest target was not found/);
});

test("keeps Mica enabled for inactive Windows windows", () => {
  const recoveredRoot = createRecoveredFixture();
  const mainBundlePath = path.join(recoveredRoot, ".vite", "build", "main-fixture.js");
  const reportPath = path.join(recoveredRoot, "patch-report.json");

  const result = runPatcher(recoveredRoot, reportPath);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const bundle = fs.readFileSync(mainBundlePath, "utf8");
  assert.match(
    bundle,
    /function D2\(\{appearance:e,isFocused:t,platform:n\}\)\{return!t&&!w2\(e\)&&n===`darwin`\}/,
  );
  assert.doesNotMatch(bundle, /D2[\s\S]{0,160}\|\|n===`win32`/);

  const shouldUseInactiveOpaqueSurface = new Function(
    `${bundle};return D2(arguments[0]);`,
  );
  assert.equal(
    shouldUseInactiveOpaqueSurface({
      appearance: "light",
      isFocused: false,
      platform: "win32",
    }),
    false,
  );
  assert.equal(
    shouldUseInactiveOpaqueSurface({
      appearance: "light",
      isFocused: false,
      platform: "darwin",
    }),
    true,
  );

  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const patch = report.patches.find(
    (patch) => patch.name === "keep Mica enabled for inactive Windows windows",
  );
  assert.equal(patch?.status, "applied");
});

test("patches app main bundle when upstream moves index targets there", () => {
  const recoveredRoot = createRecoveredFixture();
  const appMainPath = moveIndexFixtureToAppMain(recoveredRoot);
  const reportPath = path.join(recoveredRoot, "patch-report.json");

  const result = runPatcher(recoveredRoot, reportPath);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const appMainSource = fs.readFileSync(appMainPath, "utf8");
  assert.match(appMainSource, /commandGate=!0/);
  assert.match(appMainSource, /workspace_dependencies:!0/);

  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  assert.equal(
    report.patches.filter((patch) => patch.file === "webview/assets/app-main-fixture.js").length,
    3,
  );
});

test("reports a missing gate target as assumed enabled and continues", () => {
  const recoveredRoot = createRecoveredFixture();
  const indexPath = path.join(recoveredRoot, "webview", "assets", "index-fixture.js");
  fs.writeFileSync(
    indexPath,
    `let unrelated=!0;function buildFlags(user,base,remote,rest){return{...base,...remote,workspace_dependencies:!0,[workspaceKey]:isOn(user,flag)&&groupFor(user,group).groupName===\`Test\`,...rest}}${indexFeatureTargets}`,
    "utf8",
  );
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
    `let commandGate=FeatureGate(\`1981165915\`);const unrelated={workspace_dependencies:!0};${indexFeatureTargets}function buildFlags(user,base,remote,rest){return{...base,...remote,[workspaceKey]:isOn(user,flag)&&groupFor(user,group).groupName===\`Test\`,...rest}}`,
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
  const patchedIndexSource = fs.readFileSync(
    path.join(recoveredRoot, "webview", "assets", "index-fixture.js"),
    "utf8",
  );
  for (const [index, id] of enabledDesktopFeatureGateIds.entries()) {
    assert.match(patchedIndexSource, new RegExp("selectedGate" + index + "=true"), id);
    assert.doesNotMatch(patchedIndexSource, new RegExp("FeatureGate\\(\\`" + id + "\\`\\)"), id);
  }
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
    /vM=36/,
  );
  assert.match(
    fs.readFileSync(path.join(recoveredRoot, ".vite", "build", "main-fixture.js"), "utf8"),
    /function D2\(\{appearance:e,isFocused:t,platform:n\}\)\{return!t&&!w2\(e\)&&n===`darwin`\}/,
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
  assert.equal(report.patches.length, 10);
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
    path.join(recoveredRoot, "webview", "assets", "composer-fixture.js"),
    path.join(recoveredRoot, "webview", "assets", "agent-settings-fixture.js"),
    path.join(recoveredRoot, "webview", "assets", "use-model-settings-fixture.js"),
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
  assert.equal(report.patches.length, 10);
  assert.ok(
    report.patches.every((patch) =>
      ["already-applied", "assumed-enabled"].includes(patch.status),
    ),
  );
});
