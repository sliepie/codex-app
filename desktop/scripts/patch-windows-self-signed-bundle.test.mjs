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
const alreadyPatchedMenuBarMainProcessTargets =
  "class AlreadyPatchedMenuBar{isWindowsMenuBarHidden(e){return process.platform===`win32`&&this.options.getGlobalStateForHost(e).get(`hideWindowsMenuBar`)!==!1}setWindowsMenuBarHiddenForHost(e,t){if(process.platform!==`win32`)return;for(let r of n.BrowserWindow.getAllWindows()){if(r.isDestroyed()||this.windowHostIds.get(r.id)!==e)continue;t?(r.setAutoHideMenuBar(!0),r.setMenuBarVisibility(!1),r.removeMenu()):(r.setMenu(n.Menu.getApplicationMenu()),r.setAutoHideMenuBar(!1),r.setMenuBarVisibility(!0))}}createWindow(){let codexWindowsMenuBarHidden=this.isWindowsMenuBarHidden(e),M=new BrowserWindow({autoHideMenuBar:codexWindowsMenuBarHidden});codexWindowsMenuBarHidden&&M.removeMenu()}}const alreadyPatchedHandlers={\"set-configuration\":async({key,value})=>(key===`hideWindowsMenuBar`&&this.windowManager.setWindowsMenuBarHiddenForHost(this.hostConfig.id,value!==!1),{success:!0})};";

function writeFixture(filePath, source) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, source, "utf8");
}

function createRecoveredFixture() {
  const recoveredRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-self-signed-patch-"));

  writeFixture(
    path.join(recoveredRoot, "webview", "assets", "general-settings-fixture.js"),
    "function Jn(){let themeRow,pointerRow,sizeRow,fontRow;themeRow=(0,jsxKit.jsxs)(Shell,{electron:!0,children:[(0,jsxKit.jsx)(PointerCursorFixture,{}),(0,jsxKit.jsx)(FontSmoothingFixture,{})]});return(0,jsxKit.jsx)(Wrapper,{children:(0,jsxKit.jsx)(Wrapper.Content,{children:(0,jsxKit.jsxs)(List,{children:[themeRow,pointerRow,sizeRow,fontRow]})})})}function PointerCursorFixture(){return(0,jsxKit.jsx)(Message,{id:\x60settings.general.appearance.usePointerCursors.label\x60})}function FontSmoothingFixture(){let cache=(0,reactCache.c)(13),intl=useIntl();let{platform:platform}=usePlatform(),mac=platform===\x60macOS\x60,options;let state=(0,settingsStore.useSettings)(settingsAtom);cache[0]===mac?options=cache[1]:(options={enabled:mac},cache[0]=mac,cache[1]=options);let{data:value,isLoading:loading}=useSetting(settingsKeys.USE_FONT_SMOOTHING,options),checked=value??!0;if(!mac)return null;let label,description;cache[2]===Symbol.for(\x60react.memo_cache_sentinel\x60)?(label=(0,jsxKit.jsx)(Message,{id:\x60settings.general.appearance.fontSmoothing.label\x60,defaultMessage:\x60Font Smoothing\x60}),description=(0,jsxKit.jsx)(Message,{id:\x60settings.general.appearance.fontSmoothing.description\x60,defaultMessage:\x60Use native macOS font anti-aliasing\x60}),cache[2]=label,cache[3]=description):(label=cache[2],description=cache[3]);let onChange;cache[4]===state?onChange=cache[5]:(onChange=value=>{saveSetting(state,settingsKeys.USE_FONT_SMOOTHING,value)},cache[4]=state,cache[5]=onChange);let aria;cache[6]===intl?aria=cache[7]:(aria=intl.formatMessage({id:\x60settings.general.appearance.fontSmoothing.label\x60,defaultMessage:\x60Font Smoothing\x60}),cache[6]=intl,cache[7]=aria);let row;return cache[8]!==checked||cache[9]!==loading||cache[10]!==onChange||cache[11]!==aria?(row=(0,jsxKit.jsx)(SettingRow,{label:label,description:description,control:(0,jsxKit.jsx)(Toggle,{checked:checked,disabled:loading,onChange:onChange,ariaLabel:aria})}),cache[8]=checked,cache[9]=loading,cache[10]=onChange,cache[11]=aria,cache[12]=row):row=cache[12],row}",
  );
  writeFixture(
    path.join(recoveredRoot, "webview", "assets", "settings-page-fixture.js"),
    "let shortcutGate=Gate(`1981165915`);export{shortcutGate};",
  );
  writeFixture(
    path.join(recoveredRoot, "webview", "assets", "index-fixture.js"),
    `let commandGate=FeatureGate(\`1981165915\`);function buildFlags(user,base,remote,rest){return{...base,...remote,[workspaceKey]:isOn(user,flag)&&groupFor(user,group).groupName===\`Test\`,...rest}}${indexFeatureTargets}${sidebarPixelTargets}`,
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
    "var runtimeRoot=`codex-primary-runtime`,latestFile=`LATEST.json`,publicBase=`https://persistent.oaistatic.com`;function targetKey(target){return`${platformName(target.platform)}-${archName(target.arch)}`}function manifestUrl(target,config,release){return[(config.baseUrl??(release===`latest`?publicBase:`https://oaisidekickupdates.blob.core.windows.net/owl`)).replace(/\\/+$/,``),runtimeRoot,...release===`latest-alpha`?[`alpha`]:[],`latest`,targetKey(target),latestFile].join(`/`)}function localBin(parts){return(0,path.join)(process.env.LOCALAPPDATA??(0,path.join)((0,os.homedir)(),`AppData`,`Local`),...parts)}",
  );
  writeFixture(
    path.join(recoveredRoot, ".vite", "build", "main-fixture.js"),
    "var dM=`#00000000`,vM=36,yM=`#1f1f1f`,bM=`#ffffff`;function xM(){return{color:dM,symbolColor:n.nativeTheme.shouldUseDarkColors?bM:yM,height:vM}}function IM(platform){return platform===`win32`?{titleBarStyle:`hidden`,titleBarOverlay:xM()}:null}function zx(config){return typeof config!=`object`||!config?!1:Object.entries(config).some(([name,value])=>name===`workspace_dependencies`&&value===!0)}async function qp(client){let load=async cursor=>{let response=await client.sendAppServerRequest(`experimentalFeature/list`,{cursor,limit:100});return response.data.some(feature=>feature.name===`workspace_dependencies`&&feature.enabled===!0)?!0:response.nextCursor==null?!1:load(response.nextCursor)};return load(null)}",
  );

  fs.appendFileSync(
    path.join(recoveredRoot, ".vite", "build", "main-fixture.js"),
    "class WindowManagerFixture{refreshWindowBackdrops(){let e=new Set(this.windowHostIds.values());for(let t of e)this.refreshWindowBackdropForHost(t)}refreshWindowBackdropForHost(e){let t=this.isOpaqueWindowsEnabled(e);for(let r of n.BrowserWindow.getAllWindows()){}}async createWindow(r={}){let{appearance:l=\x60primary\x60,hostId:f=t.m}=r,_=l===\x60primary\x60?t.m:f,v=this.isOpaqueWindowsEnabled(_),y=Oq({appearance:l,opaqueWindowsEnabled:v,platform:process.platform}),M=new n.BrowserWindow({...process.platform===\x60win32\x60?{autoHideMenuBar:true}:{}});let ee=this.installWindowsTitleBarOverlaySync(M,l);process.platform===\x60win32\x60&&M.removeMenu()}}const handlers={\"set-configuration\":async({key:configKey,value:configValue})=>(this.globalState.set(configKey,configValue),configKey===e.Nr.APPEARANCE_THEME&&QE(configValue),(configKey===e.Nr.APPEARANCE_THEME||configKey===e.Nr.APPEARANCE_LIGHT_CHROME_THEME||configKey===e.Nr.APPEARANCE_DARK_CHROME_THEME)&&this.windowManager.refreshWindowBackdropForHost(this.hostConfig.id),{success:!0})};",
    "utf8",
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
      "webview/assets/general-settings-fixture.js",
      "webview/assets/index-fixture.js",
      "webview/assets/index-fixture.js",
      "webview/assets/agent-settings-fixture.js",
      ".vite/build/workspace-root-drop-handler-fixture.js",
      ".vite/build/workspace-root-drop-handler-fixture.js",
      ".vite/build/main-fixture.js",
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
  const workspaceRootDropHandlerPath = path.join(
    recoveredRoot,
    ".vite",
    "build",
    "workspace-root-drop-handler-fixture.js",
  );
  const reportPath = path.join(recoveredRoot, "patch-report.json");

  const result = runPatcher(recoveredRoot, reportPath);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const bundle = fs.readFileSync(workspaceRootDropHandlerPath, "utf8");
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
    2,
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
  assert.equal(report.patches[2].name, "enable keyboard shortcuts command menu entries");
  assert.equal(report.patches[2].status, "assumed-enabled");
  assert.equal(report.patches[2].file, "webview/assets/index-fixture.js");
  assert.match(report.patches[2].reason, /Gate target was not found/);
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
    "function zx(config){let text=\"{not code\";let pattern=/\\{not-code\\}/;return typeof config!=`object`||!config?!1:Object.entries(config).some(([name,value])=>name===`workspace_dependencies`&&value===!0)}async function qp(client){let ignored=`literal ${\"{still string}\"}`;let load=async cursor=>{let response=await client.sendAppServerRequest(`experimentalFeature/list`,{cursor,limit:100});return response.data.some(feature=>feature.name===`workspace_dependencies`&&feature.enabled===!0)?!0:response.nextCursor==null?!1:load(response.nextCursor)};return load(null)}" +
      alreadyPatchedMenuBarMainProcessTargets,
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
    "function zx(config){return /}/.test(`}`)||typeof config!=`object`||!config?!1:Object.entries(config).some(([name,value])=>name===`workspace_dependencies`&&value===!0)}async function qp(client){return!0}" +
      alreadyPatchedMenuBarMainProcessTargets,
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
    "function zx(config){return!0}async function qp(client){let load=async cursor=>{let response=await client.sendAppServerRequest(`experimentalFeature/list`,{cursor,limit:100});return response.data.some(feature=>feature.name===`workspace_dependencies`&&feature.enabled===!0)?!0:response.nextCursor==null?!1:load(response.nextCursor)};return load(null)}" +
      alreadyPatchedMenuBarMainProcessTargets,
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

test("fails required menu bar patch when only partial main-process markers remain", () => {
  const recoveredRoot = createRecoveredFixture();
  fs.writeFileSync(
    path.join(recoveredRoot, ".vite", "build", "main-fixture.js"),
    "const leftover={autoHideMenuBar:!0};function zx(config){return!0}async function qp(client){return!0}",
    "utf8",
  );
  const reportPath = path.join(recoveredRoot, "patch-report.json");

  const result = runPatcher(recoveredRoot, reportPath);

  assert.notEqual(result.status, 0);
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const patch = report.patches.find(
    (patch) => patch.name === "add Windows menu bar visibility main-process behavior",
  );
  assert.equal(patch?.status, "failed-required");
  assert.match(patch?.reason ?? "", /Required patch target was not found/);
});

test("recognizes independently already-applied menu bar main-process behavior", () => {
  const recoveredRoot = createRecoveredFixture();
  const mainPath = path.join(recoveredRoot, ".vite", "build", "main-fixture.js");
  fs.writeFileSync(
    mainPath,
    `${alreadyPatchedMenuBarMainProcessTargets}function zx(config){return!0}async function qp(client){return!0}`,
    "utf8",
  );
  const reportPath = path.join(recoveredRoot, "patch-report.json");
  const before = fs.readFileSync(mainPath, "utf8");

  const result = runPatcher(recoveredRoot, reportPath);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.readFileSync(mainPath, "utf8"), before);
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const patch = report.patches.find(
    (patch) => patch.name === "add Windows menu bar visibility main-process behavior",
  );
  assert.equal(patch?.status, "already-applied");
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
    fs.readFileSync(
      path.join(recoveredRoot, "webview", "assets", "general-settings-fixture.js"),
      "utf8",
    ),
    /hideWindowsMenuBar/,
  );
  assert.match(
    fs.readFileSync(
      path.join(recoveredRoot, "webview", "assets", "general-settings-fixture.js"),
      "utf8",
    ),
    /a=i===\x60windows\x60/,
  );
  assert.match(
    fs.readFileSync(
      path.join(recoveredRoot, "webview", "assets", "general-settings-fixture.js"),
      "utf8",
    ),
    /o=\{enabled:a\}/,
  );
  assert.match(
    fs.readFileSync(
      path.join(recoveredRoot, "webview", "assets", "general-settings-fixture.js"),
      "utf8",
    ),
    /useSetting\(\x60hideWindowsMenuBar\x60,o\)/,
  );
  assert.match(
    fs.readFileSync(
      path.join(recoveredRoot, "webview", "assets", "general-settings-fixture.js"),
      "utf8",
    ),
    /l=s!==!1/,
  );
  assert.match(
    fs.readFileSync(
      path.join(recoveredRoot, "webview", "assets", "general-settings-fixture.js"),
      "utf8",
    ),
    /if\(!a\)return null/,
  );
  assert.match(
    fs.readFileSync(
      path.join(recoveredRoot, "webview", "assets", "general-settings-fixture.js"),
      "utf8",
    ),
    /saveSetting\(t,\x60hideWindowsMenuBar\x60,e\)/,
  );
  assert.match(
    fs.readFileSync(
      path.join(recoveredRoot, "webview", "assets", "general-settings-fixture.js"),
      "utf8",
    ),
    /t=\(0,settingsStore\.useSettings\)\(settingsAtom\)/,
  );
  assert.match(
    fs.readFileSync(
      path.join(recoveredRoot, "webview", "assets", "general-settings-fixture.js"),
      "utf8",
    ),
    /\(0,jsxKit\.jsx\)\(CodexWindowsMenuBarSetting,\{\}\),\(0,jsxKit\.jsx\)\(FontSmoothingFixture,\{\}\)/,
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
    /setWindowsMenuBarHiddenForHost/,
  );
  assert.match(
    fs.readFileSync(path.join(recoveredRoot, ".vite", "build", "main-fixture.js"), "utf8"),
    /codexWindowsMenuBarHidden/,
  );
  assert.match(
    fs.readFileSync(path.join(recoveredRoot, ".vite", "build", "main-fixture.js"), "utf8"),
    /get\(\x60hideWindowsMenuBar\x60\)!==!1/,
  );
  assert.match(
    fs.readFileSync(path.join(recoveredRoot, ".vite", "build", "main-fixture.js"), "utf8"),
    /if\(r\.isDestroyed\(\)\|\|this\.windowHostIds\.get\(r\.id\)!==e\)continue/,
  );
  assert.match(
    fs.readFileSync(path.join(recoveredRoot, ".vite", "build", "main-fixture.js"), "utf8"),
    /r\.setAutoHideMenuBar\(!0\),r\.setMenuBarVisibility\(!1\),r\.removeMenu\(\)/,
  );
  assert.match(
    fs.readFileSync(path.join(recoveredRoot, ".vite", "build", "main-fixture.js"), "utf8"),
    /autoHideMenuBar:codexWindowsMenuBarHidden/,
  );
  assert.match(
    fs.readFileSync(path.join(recoveredRoot, ".vite", "build", "main-fixture.js"), "utf8"),
    /codexWindowsMenuBarHidden&&M\.removeMenu\(\)/,
  );
  assert.match(
    fs.readFileSync(path.join(recoveredRoot, ".vite", "build", "main-fixture.js"), "utf8"),
    /r\.setMenu\(n\.Menu\.getApplicationMenu\(\)\),r\.setAutoHideMenuBar\(!1\),r\.setMenuBarVisibility\(!0\)/,
  );
  assert.match(
    fs.readFileSync(path.join(recoveredRoot, ".vite", "build", "main-fixture.js"), "utf8"),
    /configKey===\x60hideWindowsMenuBar\x60&&this\.windowManager\.setWindowsMenuBarHiddenForHost\(this\.hostConfig\.id,configValue!==!1\)/,
  );
  assert.match(
    fs.readFileSync(path.join(recoveredRoot, ".vite", "build", "main-fixture.js"), "utf8"),
    /vM=36/,
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
  assert.equal(report.patches.length, 11);
  assert.equal(
    report.patches.find(
      (patch) => patch.name === "add Windows menu bar visibility appearance setting",
    )?.status,
    "applied",
  );
  assert.ok(
    report.patches.every((patch) =>
      patch.name === "restore Windows title bar overlay controls height"
        ? patch.status === "already-applied"
        : patch.status === "applied",
    ),
  );
});

test("restores oversized Windows title bar overlay controls", () => {
  const recoveredRoot = createRecoveredFixture();
  const mainPath = path.join(recoveredRoot, ".vite", "build", "main-fixture.js");
  fs.writeFileSync(
    mainPath,
    fs.readFileSync(mainPath, "utf8").replace("vM=36", "vM=96"),
    "utf8",
  );
  const reportPath = path.join(recoveredRoot, "patch-report.json");

  const result = runPatcher(recoveredRoot, reportPath);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(fs.readFileSync(mainPath, "utf8"), /vM=36/);
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const patch = report.patches.find(
    (patch) => patch.name === "restore Windows title bar overlay controls height",
  );
  assert.equal(patch?.status, "applied");
});

test("patches menu bar behavior when backdrop methods are not adjacent", () => {
  const recoveredRoot = createRecoveredFixture();
  const mainPath = path.join(recoveredRoot, ".vite", "build", "main-fixture.js");
  fs.writeFileSync(
    mainPath,
    fs
      .readFileSync(mainPath, "utf8")
      .replace(
        "}refreshWindowBackdropForHost(e){let",
        "}debugBackdropRefresh(){return!0}refreshWindowBackdropForHost(e){let",
      ),
    "utf8",
  );
  const reportPath = path.join(recoveredRoot, "patch-report.json");

  const result = runPatcher(recoveredRoot, reportPath);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const bundle = fs.readFileSync(mainPath, "utf8");
  assert.match(bundle, /debugBackdropRefresh\(\)\{return!0\}/);
  assert.match(bundle, /setWindowsMenuBarHiddenForHost/);
  assert.match(bundle, /get\(\x60hideWindowsMenuBar\x60\)!==!1/);
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const patch = report.patches.find(
    (patch) => patch.name === "add Windows menu bar visibility main-process behavior",
  );
  assert.equal(patch?.status, "applied");
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
    path.join(recoveredRoot, "webview", "assets", "general-settings-fixture.js"),
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
  assert.equal(report.patches.length, 11);
  assert.equal(
    report.patches.find(
      (patch) => patch.name === "add Windows menu bar visibility appearance setting",
    )?.status,
    "already-applied",
  );
  assert.equal(
    report.patches.find(
      (patch) => patch.name === "add Windows menu bar visibility main-process behavior",
    )?.status,
    "already-applied",
  );
  assert.ok(
    report.patches.every((patch) =>
      ["already-applied", "assumed-enabled"].includes(patch.status),
    ),
  );
});
