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
const windowsMenuBarSyncAlreadyApplied =
  "function menuSync(){localStorage.setItem(`codex.windowsMenuBarVisible`,`1`);window.dispatchEvent(new Event(`codex-windows-menu-bar-visibility-changed`))}";
const indexFeatureTargets =
  "var YA=[`apps`,`memories`,`plugins`,`tool_call_mcp_elicitation`,`tool_search`,`tool_suggest`,kr];function QA(){J.dispatchMessage(`electron-desktop-features-changed`,{avatarOverlay:n,ambientSuggestions:r,artifactsPane:!0,browserAgent:a.available,browserAgentAvailable:a.available,browserPane:i,computerUse:c.available,computerUseNodeRepl:c.available&&l,control:u,multiWindow:d})}";

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
    `let commandGate=FeatureGate(\`1981165915\`);function buildFlags(user,base,remote,rest){return{...base,...remote,[workspaceKey]:isOn(user,flag)&&groupFor(user,group).groupName===\`Test\`,...rest}}${indexFeatureTargets}function Ok(){let e=(0,Z.c)(4),{data:t,isLoading:n}=mc(ii.MAC_MENU_BAR_ENABLED),r=t!==!1,i,a;return e[0]!==n||e[1]!==r?(i=()=>{n||J.dispatchMessage(\`mac-menu-bar-enabled-changed\`,{enabled:r})},a=[n,r],e[0]=n,e[1]=r,e[2]=i,e[3]=a):(i=e[2],a=e[3]),(0,Q.useEffect)(i,a),null}function Ub(){let A=C.formatMessage({id:\`sidebarElectron.recentChats\`,defaultMessage:\`Chats\`}),At={chats:!1},rr=(0,$.jsx)(\`div\`,{className:\`flex min-w-0 flex-1\`,children:(0,$.jsx)(av,{collapsed:At.chats,onToggle:()=>{ec(e,\`chats\`,!At.chats)},children:A})}),ir=(0,$.jsx)(G_,{items:on,ariaLabel:A,currentThreadKey:y,onActivateThread:x,itemClassName:\`after:block\`});return[rr,ir]}`,
  );
  writeFixture(
    path.join(recoveredRoot, "webview", "assets", "composer-fixture.js"),
    "const noResults=`composer.slashCommands.noResults`,empty=`requiresEmptyComposer`;function hU(e){let t=(0,$.c)(16),{composerController:n,slashCommands:r,onOpenCommandContent:i}=e,a=F(n,_U),o=F(n,gU),s=(0,Z.useRef)(null),c;if(t[0]!==a||t[1]!==r||t[2]!==o){let e=lx(r,ux(a));c=o?.active?cx(e,o.query):e,t[0]=a,t[1]=r,t[2]=o,t[3]=c}else c=t[3];return c}",
  );
  writeFixture(
    path.join(recoveredRoot, "webview", "assets", "general-settings-fixture.js"),
    "function ir(){let e=(0,Q.c)(11),t=x(u),n=L(),{platform:r}=ge(),{data:i,isLoading:a}=V(y.MAC_MENU_BAR_ENABLED);if(r!==`macOS`)return null;let o,s;e[0]===Symbol.for(`react.memo_cache_sentinel`)?(o=(0,$.jsx)(I,{id:`settings.general.macMenuBar.label`,defaultMessage:`Show in menu bar`,description:`Label for the macOS menu bar setting`}),s=(0,$.jsx)(I,{id:`settings.general.macMenuBar.description`,defaultMessage:`Keep Codex in the macOS menu bar when the main window is closed`,description:`Description for the macOS menu bar setting`}),e[0]=o,e[1]=s):(o=e[0],s=e[1]);let c=i!==!1,l;e[2]===t?l=e[3]:(l=e=>{ie(t,y.MAC_MENU_BAR_ENABLED,e)},e[2]=t,e[3]=l);let d;e[4]===n?d=e[5]:(d=n.formatMessage({id:`settings.general.macMenuBar.ariaLabel`,defaultMessage:`Show Codex in the menu bar`,description:`Aria label for the macOS menu bar setting toggle`}),e[4]=n,e[5]=d);let f;return e[6]!==a||e[7]!==c||e[8]!==l||e[9]!==d?(f=(0,$.jsx)(J,{label:o,description:s,control:(0,$.jsx)(q,{checked:c,disabled:a,onChange:l,ariaLabel:d})}),e[6]=a,e[7]=c,e[8]=l,e[9]=d,e[10]=f):f=e[10],f}",
  );
  writeFixture(
    path.join(recoveredRoot, "webview", "assets", "general-settings-unused.js"),
    "export{};",
  );
  writeFixture(
    path.join(recoveredRoot, "webview", "assets", "app-shell-fixture.js"),
    "function Jt(){let e=Ee(),t=Gt(),[n,r]=(0,$.useState)(null),i=(0,$.useRef)(0);if(!t)return null;let a=async(e,t)=>{let n=window.electronBridge?.showApplicationMenu;if(!n)return;let a=i.current+1;i.current=a,r(e);let o=t.currentTarget.getBoundingClientRect();try{await n(e,Math.round(o.left),Math.round(o.bottom))}finally{i.current===a&&r(null)}};return(0,Q.jsx)(`div`,{className:`flex items-center gap-0.5 pr-2 pl-1`,children:qt.map(({id:t,message:r})=>(0,Q.jsx)(`button`,{type:`button`,\"aria-expanded\":n===t,\"aria-haspopup\":`menu`,\"aria-label\":e.formatMessage(r),className:Y(`no-drag rounded-md border border-transparent px-2.5 py-1 text-base font-normal leading-none outline-none transition-colors`,n===t?`bg-[var(--color-token-menubar-selection-background)] text-[var(--color-token-menubar-selection-foreground)]`:`text-token-text-tertiary hover:bg-token-foreground/5 hover:text-token-description-foreground focus-visible:bg-token-foreground/5 focus-visible:text-token-description-foreground`),onClick:e=>{a(t,e)},children:(0,Q.jsx)(Ce,{...r})},t))})}function On(){return(0,Q.jsxs)(`div`,{className:`app-header-tint draggable group/windows-top-bar z-40 flex h-toolbar-sm items-center ps-(--spacing-token-safe-header-left) pe-(--spacing-token-safe-header-right)`,children:[]})}function Nt(){return(0,Q.jsx)(Lt,{viewTransitionName:`sidebar-trigger`})}function Lt(){let c=`sidebar-trigger`,u=c==null?void 0:{viewTransitionName:c};return u}var Kt={file:{id:`windowsMenuBar.file`}};",
  );
  writeFixture(
    path.join(recoveredRoot, "webview", "assets", "app-shell-bottom-panel-scroll-sync.js"),
    "export{};",
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
      "webview/assets/index-fixture.js",
      "webview/assets/index-fixture.js",
      "webview/assets/general-settings-fixture.js",
      "webview/assets/app-shell-fixture.js",
      "webview/assets/app-shell-fixture.js",
      "webview/assets/app-shell-fixture.js",
      "webview/assets/agent-settings-fixture.js",
      ".vite/build/workspace-root-drop-handler-fixture.js",
      ".vite/build/main-fixture.js",
      ".vite/build/main-fixture.js",
    ],
  );
  assert.ok(report.patches.every((patch) => !path.isAbsolute(patch.file)));
  assert.ok(report.patches.every((patch) => !patch.file.includes("..")));
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
  assert.match(appMainSource, /codex\.windowsMenuBarVisible/);
  assert.match(appMainSource, /className:`flex min-w-0 flex-1 translate-x-px`/);
  assert.match(appMainSource, /onActivateThread:x,className:`-translate-x-px`,itemClassName:/);

  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  assert.equal(
    report.patches.filter((patch) => patch.file === "webview/assets/app-main-fixture.js").length,
    5,
  );
});

test("reports a missing gate target as assumed enabled and continues", () => {
  const recoveredRoot = createRecoveredFixture();
  const indexPath = path.join(recoveredRoot, "webview", "assets", "index-fixture.js");
  fs.writeFileSync(
    indexPath,
    `let unrelated=!0;function buildFlags(user,base,remote,rest){return{...base,...remote,workspace_dependencies:!0,[workspaceKey]:isOn(user,flag)&&groupFor(user,group).groupName===\`Test\`,...rest}}${indexFeatureTargets}${windowsMenuBarSyncAlreadyApplied}`,
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

test("fails when the Windows menu bar visibility sync target is missing", () => {
  const recoveredRoot = createRecoveredFixture();
  fs.writeFileSync(
    path.join(recoveredRoot, "webview", "assets", "index-fixture.js"),
    `let commandGate=FeatureGate(\`1981165915\`),unrelatedMenuKey=\`codex.windowsMenuBarVisible\`;function buildFlags(user,base,remote,rest){return{...base,...remote,[workspaceKey]:isOn(user,flag)&&groupFor(user,group).groupName===\`Test\`,...rest}}${indexFeatureTargets}`,
    "utf8",
  );
  const reportPath = path.join(recoveredRoot, "patch-report.json");

  const result = runPatcher(recoveredRoot, reportPath);

  assert.notEqual(result.status, 0);
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const patch = report.patches.find(
    (patch) => patch.name === "sync Windows menu bar visibility setting",
  );
  assert.ok(patch);
  assert.equal(patch.status, "failed-required");
  assert.match(patch.reason, /Required patch target was not found/);
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
    `let commandGate=FeatureGate(\`1981165915\`);const unrelated={workspace_dependencies:!0};${indexFeatureTargets}${windowsMenuBarSyncAlreadyApplied}function buildFlags(user,base,remote,rest){return{...base,...remote,[workspaceKey]:isOn(user,flag)&&groupFor(user,group).groupName===\`Test\`,...rest}}`,
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
    fs.readFileSync(path.join(recoveredRoot, "webview", "assets", "index-fixture.js"), "utf8"),
    /codex\.windowsMenuBarVisible/,
  );
  assert.match(
    fs.readFileSync(path.join(recoveredRoot, "webview", "assets", "index-fixture.js"), "utf8"),
    /className:`flex min-w-0 flex-1 translate-x-px`/,
  );
  assert.match(
    fs.readFileSync(path.join(recoveredRoot, "webview", "assets", "index-fixture.js"), "utf8"),
    /onActivateThread:x,className:`-translate-x-px`,itemClassName:/,
  );
  assert.match(
    fs.readFileSync(
      path.join(recoveredRoot, "webview", "assets", "general-settings-fixture.js"),
      "utf8",
    ),
    /settings\.general\.windowsMenuBar\.label/,
  );
  assert.match(
    fs.readFileSync(path.join(recoveredRoot, "webview", "assets", "app-shell-fixture.js"), "utf8"),
    /codex-windows-menu-bar-visibility-changed/,
  );
  assert.match(
    fs.readFileSync(path.join(recoveredRoot, "webview", "assets", "app-shell-fixture.js"), "utf8"),
    /group\/windows-top-bar z-40 flex h-toolbar-sm items-center ps-\(--spacing-token-safe-header-left\) ms-2/,
  );
  assert.match(
    fs.readFileSync(path.join(recoveredRoot, "webview", "assets", "app-shell-fixture.js"), "utf8"),
    /viewTransitionName:c,transform:`translateX\(2px\)`/,
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
  assert.equal(report.patches.length, 14);
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
    path.join(recoveredRoot, "webview", "assets", "general-settings-fixture.js"),
    path.join(recoveredRoot, "webview", "assets", "app-shell-fixture.js"),
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
  assert.equal(report.patches.length, 14);
  assert.ok(
    report.patches.every((patch) =>
      ["already-applied", "assumed-enabled"].includes(patch.status),
    ),
  );
});
