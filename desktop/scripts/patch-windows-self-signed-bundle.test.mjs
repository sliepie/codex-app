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
const projectsSectionTargets =
  "function Projects(){let u=false;return(0,$.jsx)(ProjectGroups,{label:`sidebarElectron.projectsNavLink`,maxGroups:u?void 0:5,showProjectHoverCard:true,showProjectPinAction:true,maxItems:11,maxThreads:5})}function GenericList(){return{maxGroups:G,maxItems:3,maxThreads:2}}";

function writeFixture(filePath, source) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, source, "utf8");
}

function createRecoveredFixture() {
  const recoveredRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-self-signed-patch-"));

  writeFixture(
    path.join(recoveredRoot, "webview", "assets", "settings-page-fixture.js"),
    "export const settingsPageFixture=true;",
  );
  writeFixture(
    path.join(recoveredRoot, "webview", "assets", "index-fixture.js"),
    `${indexFeatureTargets}${sidebarPixelTargets}`,
  );
  writeFixture(
    path.join(recoveredRoot, "webview", "assets", "projects-section-fixture.js"),
    projectsSectionTargets,
  );
  writeFixture(
    path.join(recoveredRoot, "webview", "assets", "project-hover-card-fixture.js"),
    "const projectHoverCardLabel=`sidebarElectron.projectsNavLink`,showProjectHoverCard=true;",
  );
  writeFixture(
    path.join(recoveredRoot, "webview", "assets", "composer-fixture.js"),
    "const noResults=`composer.slashCommands.noResults`,empty=`requiresEmptyComposer`;function hU(e){let t=(0,$.c)(16),{composerController:n,slashCommands:r,onOpenCommandContent:i}=e,a=F(n,_U),o=F(n,gU),s=(0,Z.useRef)(null),c;if(t[0]!==a||t[1]!==r||t[2]!==o){let e=lx(r,ux(a));c=o?.active?cx(e,o.query):e,t[0]=a,t[1]=r,t[2]=o,t[3]=c}else c=t[3];return c}",
  );
  writeFixture(
    path.join(recoveredRoot, "webview", "assets", "agent-settings-fixture.js"),
    "export const agentSettingsFixture=true;",
  );
  writeFixture(
    path.join(recoveredRoot, "webview", "assets", "product-text-fixture.js"),
    "const Brand={ChatGPT:`chatgpt`};const label=`Open ChatGPT`;const welcome=`Welcome to ChatGPT, ${Brand.ChatGPT}`;const header=`ChatGPT-Account-ID`;const headerAlias=`ChatGPT-Account-Id`;const url=`https://chatgpt.com`;",
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
    "var dM=`#00000000`,vM=36,yM=`#1f1f1f`,bM=`#ffffff`;function xM(){return{color:dM,symbolColor:n.nativeTheme.shouldUseDarkColors?bM:yM,height:vM}}function IM(platform){return platform===`win32`?{titleBarStyle:`hidden`,titleBarOverlay:xM()}:null}function w2(appearance){return appearance===`dark`}function D2({appearance:e,isFocused:t,platform:n}){return!t&&!w2(e)&&(n===`darwin`||n===`win32`)}function applyWindowBackdrop(window,backgroundMaterial){window.setBackgroundMaterial(backgroundMaterial);return{backgroundMaterial}}function createMainWindow(){let M=new n.BrowserWindow({width:b,height:x,...S===void 0||C===void 0?{}:{x:S,y:C},title:q??n.app.getName(),backgroundColor:A,show:l,parent:p,focusable:m,modal:p!=null?E:!1,skipTaskbar:F,transparent:o,trafficLightPosition:v,visualEffectState:_,...process.platform===`win32`||process.platform===`linux`?{autoHideMenuBar:!0}:{},backgroundMaterial:j??void 0,...D,minWidth:T?.width,minHeight:T?.height,webPreferences:k});return M}",
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
      "webview/assets",
      "webview/assets/projects-section-fixture.js",
      ".vite/build/workspace-root-drop-handler-fixture.js",
      ".vite/build/primary-runtime-installer-fixture.js",
      ".vite/build/main-fixture.js",
      ".vite/build/main-fixture.js",
    ],
  );
  assert.ok(report.patches.every((patch) => !path.isAbsolute(patch.file)));
  assert.ok(report.patches.every((patch) => !patch.file.includes("..")));
});

test("replaces ChatGPT renderer text without changing product identifiers or protocol values", () => {
  const recoveredRoot = createRecoveredFixture();
  const productTextPath = path.join(
    recoveredRoot,
    "webview",
    "assets",
    "product-text-fixture.js",
  );
  const reportPath = path.join(recoveredRoot, "patch-report.json");

  const result = runPatcher(recoveredRoot, reportPath);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(
    fs.readFileSync(productTextPath, "utf8"),
    "const Brand={ChatGPT:`chatgpt`};const label=`Open Codex`;const welcome=`Welcome to Codex, ${Brand.ChatGPT}`;const header=`ChatGPT-Account-ID`;const headerAlias=`ChatGPT-Account-Id`;const url=`https://chatgpt.com`;",
  );
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const patch = report.patches.find(
    (candidate) => candidate.name === "replace ChatGPT renderer text with Codex",
  );
  assert.equal(patch?.status, "applied");
  assert.equal(patch?.file, "webview/assets");
  assert.match(patch?.reason, /Replaced 2 product-name occurrence\(s\)/);
});

test("raises only the outer sidebar project limit", () => {
  const recoveredRoot = createRecoveredFixture();
  const projectsPath = path.join(
    recoveredRoot,
    "webview",
    "assets",
    "projects-section-fixture.js",
  );
  const reportPath = path.join(recoveredRoot, "patch-report.json");

  const result = runPatcher(recoveredRoot, reportPath);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(
    fs.readFileSync(projectsPath, "utf8"),
    projectsSectionTargets.replace("maxGroups:u?void 0:5", "maxGroups:u?void 0:9999"),
  );
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const patch = report.patches.find((candidate) => candidate.name === "raise sidebar project limit");
  assert.equal(patch?.status, "applied");
  assert.equal(patch?.file, "webview/assets/projects-section-fixture.js");
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

test("patches non-feature self-signed Windows bundle changes", () => {
  const recoveredRoot = createRecoveredFixture();
  const reportPath = path.join(recoveredRoot, "patch-report.json");

  const result = runPatcher(recoveredRoot, reportPath);

  assert.equal(result.status, 0, result.stderr || result.stdout);
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
    /BrowserWindow\(\{icon:process\.platform===`win32`\?require\("node:path"\)\.join\(process\.resourcesPath,`icon\.ico`\):void 0,width:b/,
  );
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  assert.equal(report.patches.length, 6);
  assert.ok(report.patches.every((patch) => patch.status === "applied"));
});

test("finds the WindowsApps relocation helper after its chunk is renamed", () => {
  const recoveredRoot = createRecoveredFixture();
  const originalPath = path.join(
    recoveredRoot,
    ".vite",
    "build",
    "workspace-root-drop-handler-fixture.js",
  );
  const renamedPath = path.join(recoveredRoot, ".vite", "build", "src-fixture.js");
  fs.renameSync(originalPath, renamedPath);

  const result = runPatcher(recoveredRoot);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(fs.readFileSync(renamedPath, "utf8"), /process\.resourcesPath\?\.replace/);
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

test("accepts desktop feature markers in the recovered main bundle", () => {
  const recoveredRoot = createRecoveredFixture();
  const reportPath = path.join(recoveredRoot, "patch-report.json");

  fs.writeFileSync(
    path.join(recoveredRoot, "webview", "assets", "index-fixture.js"),
    sidebarPixelTargets,
    "utf8",
  );
  fs.writeFileSync(
    path.join(recoveredRoot, ".vite", "build", "main-fixture.js"),
    `${indexFeatureTargets}var dM=\`#00000000\`,vM=36,yM=\`#1f1f1f\`,bM=\`#ffffff\`;function xM(){return{color:dM,symbolColor:n.nativeTheme.shouldUseDarkColors?bM:yM,height:vM}}function IM(platform){return platform===\`win32\`?{titleBarStyle:\`hidden\`,titleBarOverlay:xM()}:null}function w2(appearance){return appearance===\`dark\`}function D2({appearance:e,isFocused:t,platform:n}){return!t&&!w2(e)&&(n===\`darwin\`||n===\`win32\`)}function applyWindowBackdrop(window,backgroundMaterial){window.setBackgroundMaterial(backgroundMaterial);return{backgroundMaterial}}`,
    "utf8",
  );

  const result = runPatcher(recoveredRoot, reportPath);

  assert.equal(result.status, 0, result.stderr || result.stdout);
});
test("does not fail or rewrite when self-signed Windows patches run again", () => {
  const recoveredRoot = createRecoveredFixture();
  const reportPath = path.join(recoveredRoot, "patch-report.json");

  const first = runPatcher(recoveredRoot, reportPath);
  assert.equal(first.status, 0, first.stderr || first.stdout);
  const files = [
    path.join(recoveredRoot, "webview", "assets", "settings-page-fixture.js"),
    path.join(recoveredRoot, "webview", "assets", "index-fixture.js"),
    path.join(recoveredRoot, "webview", "assets", "projects-section-fixture.js"),
    path.join(recoveredRoot, "webview", "assets", "composer-fixture.js"),
    path.join(recoveredRoot, "webview", "assets", "agent-settings-fixture.js"),
    path.join(recoveredRoot, "webview", "assets", "product-text-fixture.js"),
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
  assert.equal(report.patches.length, 6);
  assert.ok(
    report.patches.every((patch) =>
      ["already-applied", "assumed-enabled"].includes(patch.status),
    ),
  );
});
