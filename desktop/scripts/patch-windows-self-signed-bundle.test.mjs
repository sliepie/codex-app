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
const browserDownloadsFeatureTargets =
  "function _Go(e){let t=(0,vGo.c)(15),{hostId:n}=e,r;t[0]===n?r=t[1]:(r={featureName:`in_app_browser`,hostId:n},t[0]=n,t[1]=r);let i=ufi(r),a=ko(vPo,cOe),o=uh(`2177625257`),s=i.enabled&&!i.isLoading,c;t[2]!==i.isLoading||t[3]!==s?(c={enabled:s,isLoading:i.isLoading},t[2]=i.isLoading,t[3]=s,t[4]=c):c=t[4];let l=c,u=l.enabled&&a.data===!0,d=i.isLoading||a.isLoading,f;t[5]!==u||t[6]!==d?(f={enabled:u,isLoading:d},t[5]=u,t[6]=d,t[7]=f):f=t[7];let p=l.enabled&&o,m;t[8]!==i.isLoading||t[9]!==p?(m={enabled:p,isLoading:i.isLoading},t[8]=i.isLoading,t[9]=p,t[10]=m):m=t[10];let h;return t[11]!==l||t[12]!==f||t[13]!==m?(h={contactInfo:l,downloads:l,extensions:f,history:m,passwordManager:l,siteSettings:l},t[11]=l,t[12]=f,t[13]=m,t[14]=h):h=t[14],h}";
const sidebarPixelTargets =
  "function Sidebar(){let A=C.formatMessage({id:`sidebarElectron.recentChats`,defaultMessage:`Chats`}),rr=(0,$.jsx)(`div`,{className:`flex min-w-0 flex-1`,children:(0,$.jsx)(av,{collapsed:At.chats,onToggle:()=>{},children:A})}),ir=(0,$.jsx)(G_,{items:on,ariaLabel:A,currentThreadKey:y,onActivateThread:x,className:`-translate-x-px`,itemClassName:`after:block after:h-px after:content-[''] last:after:hidden`,itemWrapper:ke?Tg:void 0,emptyState:(0,$.jsx)(Y,{id:`sidebarElectron.noRecentChats`,defaultMessage:`No chats`,description:`Empty state for projectless chats in the sidebar`}),emptyStateClassName:`text-token-description-foreground p-2 text-base opacity-50`,rowOptions:{hideRemoteHostEnvIcon:!1,showPinActionOnHover:!0,getSectionContextMenuItems:Kt}}),ar=bt?(0,$.jsx)(`div`,{className:`px-row-x`,...ne.sidebarSection({collapsed:At.chats,heading:`Chats`}),children:(0,$.jsx)(Zd,{title:rr})}):null;return[rr,ir,ar]}function Row(){return(0,$.jsx)(L_,{conversationId:N,isAutomationRun:i,hasPendingChildApproval:c,isActive:u,forceLoadingIndicator:t&&l,className:s?`opacity-50`:void 0,rowContentClassName:Dc(t&&(D?`ml-10`:`ml-5`),g&&`pr-3 group-focus-within:[mask-image:linear-gradient(to_right,transparent_0,transparent_21px,black_26px)] group-hover:[mask-image:linear-gradient(to_right,transparent_0,transparent_21px,black_26px)]`),envIconLocation:`end`,dataAttributes:ne.sidebarThreadRow({kind:`local`,title:H})})}function vy(){let C=(0,$.jsx)(`div`,{className:`min-w-0 flex-1`,children:(0,$.jsx)(cn,{triggerButton:(0,$.jsx)(Qd,{icon:b,label:x,onClick:yy,trailing:S,iconClassName:`icon-sm`})})});return C}let settingsLabel={id:`codex.profileFooter.signedInFallback`};";
const projectsSectionTargets =
  "function Projects(){let u=false;return(0,$.jsx)(ProjectGroups,{label:`sidebarElectron.projectsNavLink`,maxGroups:u?void 0:5,showProjectHoverCard:true,showProjectPinAction:true,maxItems:11,maxThreads:5})}function GenericList(){return{maxGroups:G,maxItems:3,maxThreads:2}}";
const realtimeVoiceFeatureGateTargets =
  "function $ps(){let e=uh(`2380644311`),t=uh(`1697652030`);return e&&!t}var ems=n((()=>{gh()}));function tms(){let e=$ps(),t=J(iCn),n=J(zdr);return e&&t&&!n}";
const usageRemainingTargets =
  "function n1l(e){let heading=(0,u7.jsx)(Z,{id:`composer.mode.rateLimit.heading`,defaultMessage:`Usage remaining`,description:`Rate limit summary heading`}),resets=(0,u7.jsx)(Z,{id:`composer.mode.rateLimit.resetsAvailable`,defaultMessage:`# available resets`}),loading=(0,u7.jsx)(Z,{id:`composer.mode.rateLimit.loading`,defaultMessage:`Loading usage…`,description:`Loading state for the rate limit summary submenu`}),k=(0,u7.jsx)(v,{LeftIcon:E,RightIcon:D,tooltipSide:S,children:O});let A=(0,u7.jsx)(V,{children:heading});return(0,u7.jsx)(y,{trigger:k,children:A})}";
const usageRemainingCompilerShapeTargets =
  "function jn(e){let j;t[0]?(j=(0,Z.jsx)(Item,{LeftIcon:O,RightIcon:k,tooltipSide:C,children:A}),t[1]=j):j=t[1];let M;t[2]?(M=(0,Z.jsxs)(`div`,{className:`flex flex-col text-sm`,children:[(0,Z.jsx)(w,{id:`composer.mode.rateLimit.heading`,children:A}),(0,Z.jsx)(w,{id:`composer.mode.rateLimit.resetsAvailable`,children:A}),(0,Z.jsx)(w,{id:`composer.mode.rateLimit.loading`,children:A})]}),t[3]=M):M=t[3];return(0,Z.jsx)(Submenu,{trigger:j,children:M})}";
const browserRuntimeRelocationTargets =
  "function tP({executableName:e,runtimeRoot:t}){let n=dP([`OpenAI`,`Codex`,`runtimes`,RN]),r=VN.get(t);if(r!=null){let n=(0,i.join)(r,`bin`,e);if(yP(n)&&pP((0,i.join)(r,`bin`,`node_modules`)))return n;VN.delete(t)}let a=[`manifest.json`,`bin/node.exe`,`bin/node_repl.exe`].map(e=>aP({destinationPath:n,executableName:e,sourcePath:(0,i.join)(t,e)})),o=oP(a).slice(0,16),s=(0,i.join)(n,o),l=(0,i.join)(s,`bin`,e);if(sP(s,a)&&pP((0,i.join)(s,`bin`,`node_modules`)))return uP({currentHash:o,destinationRoot:n,executableName:(0,i.join)(`bin`,e)}),VN.set(t,s),l;(0,c.existsSync)(s)&&hP({destinationPath:s,executableName:e,operation:`remove_destination`,sourcePath:t},()=>(0,c.rmSync)(s,{force:!0,recursive:!0})),hP({destinationPath:n,executableName:e,operation:`mkdir_destination`,sourcePath:t},()=>(0,c.mkdirSync)(n,{recursive:!0}));let u=hP({destinationPath:n,executableName:e,operation:`mkdir_staging`,sourcePath:t},()=>(0,c.mkdtempSync)((0,i.join)(n,`.staging-${o}-`)));try{hP({destinationPath:u,executableName:e,operation:`copy_directory`,sourcePath:t},()=>nP(t,u)),hP({destinationPath:u,executableName:e,operation:`rename_staging`,sourcePath:u},()=>(0,c.renameSync)(u,s))}catch(e){try{(0,c.rmSync)(u,{force:!0,recursive:!0})}catch{}if(sP(s,a)&&pP((0,i.join)(s,`bin`,`node_modules`)))return VN.set(t,s),l;throw e}return uP({currentHash:o,destinationRoot:n,executableName:(0,i.join)(`bin`,e)}),VN.set(t,s),l}";

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
    path.join(recoveredRoot, "webview", "assets", "realtime-voice-feature-gate-fixture.js"),
    realtimeVoiceFeatureGateTargets,
  );
  writeFixture(
    path.join(recoveredRoot, "webview", "assets", "usage-remaining-fixture.js"),
    usageRemainingTargets,
  );
  writeFixture(
    path.join(recoveredRoot, "webview", "assets", "browser-downloads-feature-fixture.js"),
    browserDownloadsFeatureTargets,
  );
  writeFixture(
    path.join(recoveredRoot, "webview", "assets", "browser-downloads-marker-distractor-fixture.js"),
    "function browserSettings(){let l={enabled:false,isLoading:false};return{contactInfo:l,downloads:l,extensions:f,history:m,passwordManager:l,siteSettings:l}}",
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
    path.join(recoveredRoot, ".vite", "build", "browser-runtime-relocation-fixture.js"),
    browserRuntimeRelocationTargets,
  );
  writeFixture(
    path.join(recoveredRoot, ".vite", "build", "drop-handler-marker-distractor-fixture.js"),
    "var localAppData=process.env.LOCALAPPDATA??(0,path.join)((0,os.homedir)(),`AppData`,`Local`),windowsApps=(0,path.join)(localAppData,`Microsoft`,`WindowsApps`);",
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

function assertRequiredPatchFailure(result, reportPath, patchName) {
  assert.notEqual(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const patch = report.patches.find((candidate) => candidate.name === patchName);
  assert.equal(patch?.status, "failed-required");
  return patch;
}

function createBrowserRuntimeHarness(bundle) {
  const harnessRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-browser-runtime-"));
  const runtimeRoot = path.join(harnessRoot, "runtime");
  const cacheRoot = path.join(harnessRoot, "cache");
  const deterministicTarget = path.join(
    cacheRoot,
    "OpenAI",
    "Codex",
    "runtimes",
    "runtime",
    "runtime-hash",
  );
  fs.mkdirSync(path.join(runtimeRoot, "bin", "node_modules"), { recursive: true });
  fs.writeFileSync(path.join(runtimeRoot, "manifest.json"), "{}", "utf8");
  fs.writeFileSync(path.join(runtimeRoot, "bin", "node.exe"), "node", "utf8");
  fs.writeFileSync(path.join(runtimeRoot, "bin", "node_repl.exe"), "repl", "utf8");
  fs.writeFileSync(path.join(runtimeRoot, "bin", "node_modules", "package.json"), "{}", "utf8");
  fs.mkdirSync(deterministicTarget, { recursive: true });

  const logs = [];
  const runtime = new Function(
    "pathModule",
    "fsModule",
    "cacheRoot",
    "lockedTarget",
    "logs",
    `
      const i={join:pathModule.join};
      const c={
        existsSync:target=>fsModule.existsSync(target),
        rmSync:(target,options)=>{
          if(target===lockedTarget){const error=new Error("locked");error.code="EPERM";throw error}
          return fsModule.rmSync(target,options)
        },
        mkdirSync:(target,options)=>fsModule.mkdirSync(target,options),
        mkdtempSync:prefix=>fsModule.mkdtempSync(prefix),
        renameSync:(source,destination)=>fsModule.renameSync(source,destination),
      };
      const RN="runtime";
      const VN=new Map();
      function dP(parts){return pathModule.join(cacheRoot,...parts)}
      function yP(target){return fsModule.existsSync(target)}
      function pP(target){return fsModule.existsSync(target)}
      function aP(value){return value}
      function oP(){return "runtime-hash"}
      function sP(){return false}
      function uP(){return undefined}
      function nP(source,destination){return fsModule.cpSync(source,destination,{recursive:true})}
      function hP(operation,callback){logs.push(operation.operation);return callback()}
      ${bundle}
      return {relocate:tP,cache:VN};
    `,
  )(path, fs, cacheRoot, deterministicTarget, logs);

  return { cache: runtime.cache, cacheRoot, logs, relocate: runtime.relocate, runtimeRoot };
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
      "webview/assets/usage-remaining-fixture.js",
      "webview/assets/realtime-voice-feature-gate-fixture.js",
      "webview/assets/browser-downloads-feature-fixture.js",
      "webview/assets/projects-section-fixture.js",
      ".vite/build/workspace-root-drop-handler-fixture.js",
      ".vite/build/browser-runtime-relocation-fixture.js",
      ".vite/build/primary-runtime-installer-fixture.js",
      ".vite/build/main-fixture.js",
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

test("enables Codex Voice without runtime gates", () => {
  const recoveredRoot = createRecoveredFixture();
  const reportPath = path.join(recoveredRoot, "patch-report.json");

  const result = runPatcher(recoveredRoot, reportPath);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const bundle = fs.readFileSync(
    path.join(recoveredRoot, "webview", "assets", "realtime-voice-feature-gate-fixture.js"),
    "utf8",
  );
  assert.match(bundle, /function \$ps\(\)\{let e=uh\(`2380644311`\),t=uh\(`1697652030`\);return e&&!t\}var ems=n\(\(\(\)=>\{gh\(\)\}\)\);function tms\(\)\{let e=\$ps\(\),t=J\(iCn\),n=J\(zdr\);return!0\}/);
  assert.doesNotMatch(bundle, /return e&&t&&!n/);

  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const patch = report.patches.find(
    (candidate) => candidate.name === "enable Codex Voice rollout gate",
  );
  assert.equal(patch?.status, "applied");
});

test("keeps Usage remaining expanded in the rate-limit summary", () => {
  const recoveredRoot = createRecoveredFixture();
  const reportPath = path.join(recoveredRoot, "patch-report.json");

  const result = runPatcher(recoveredRoot, reportPath);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const bundle = fs.readFileSync(
    path.join(recoveredRoot, "webview", "assets", "usage-remaining-fixture.js"),
    "utf8",
  );
  assert.match(bundle, /children:O,onSelect:e=>e\.preventDefault\(\)/);
  assert.match(bundle, /children:A,isDefaultOpen:!0/);

  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const patch = report.patches.find(
    (candidate) => candidate.name === "keep Usage remaining expanded",
  );
  assert.equal(patch?.status, "applied");
});

test("handles the compiler memo-cache shape of the rate-limit summary", () => {
  const recoveredRoot = createRecoveredFixture();
  const usagePath = path.join(
    recoveredRoot,
    "webview",
    "assets",
    "usage-remaining-fixture.js",
  );
  const reportPath = path.join(recoveredRoot, "patch-report.json");
  fs.writeFileSync(usagePath, usageRemainingCompilerShapeTargets, "utf8");

  const result = runPatcher(recoveredRoot, reportPath);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const bundle = fs.readFileSync(usagePath, "utf8");
  assert.match(bundle, /children:A,onSelect:e=>e\.preventDefault\(\)/);
  assert.match(bundle, /trigger:j,children:M,isDefaultOpen:!0/);
});

test("accepts Usage remaining prop reordering and additional props", () => {
  const recoveredRoot = createRecoveredFixture();
  const usagePath = path.join(
    recoveredRoot,
    "webview",
    "assets",
    "usage-remaining-fixture.js",
  );
  const reportPath = path.join(recoveredRoot, "patch-report.json");
  fs.writeFileSync(
    usagePath,
    usageRemainingTargets
      .replace(
        "(0,u7.jsx)(v,{LeftIcon:E,RightIcon:D,tooltipSide:S,children:O})",
        "(0,u7.jsxs)(v,{ children: O, className: T, tooltipSide: S, RightIcon: D, LeftIcon: E })",
      )
      .replace(
        "(0,u7.jsx)(y,{trigger:k,children:A})",
        "(0,u7.jsxs)(y,{ children: A, trigger: k, className: T })",
      ),
    "utf8",
  );

  const result = runPatcher(recoveredRoot, reportPath);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const bundle = fs.readFileSync(usagePath, "utf8");
  assert.match(
    bundle,
    /children:\s*O\s*,\s*className:\s*T\s*,\s*tooltipSide:\s*S\s*,\s*RightIcon:\s*D\s*,\s*LeftIcon:\s*E\s*,\s*onSelect:e=>e\.preventDefault\(\)/,
  );
  assert.match(
    bundle,
    /children:\s*A\s*,\s*trigger:\s*k\s*,\s*className:\s*T\s*,\s*isDefaultOpen:!0/,
  );
});

test("preserves a compatible Usage remaining trigger handler", () => {
  const recoveredRoot = createRecoveredFixture();
  const usagePath = path.join(
    recoveredRoot,
    "webview",
    "assets",
    "usage-remaining-fixture.js",
  );
  const reportPath = path.join(recoveredRoot, "patch-report.json");
  const original = fs.readFileSync(usagePath, "utf8");
  const conflictedSource = original.replace(
    "(0,u7.jsx)(v,{LeftIcon:E,RightIcon:D,tooltipSide:S,children:O})",
    "(0,u7.jsx)(v,{LeftIcon:E,RightIcon:D,tooltipSide:S,children:O,onSelect:evt=>evt.preventDefault()})",
  );
  fs.writeFileSync(usagePath, conflictedSource, "utf8");

  const result = runPatcher(recoveredRoot, reportPath);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const bundle = fs.readFileSync(usagePath, "utf8");
  assert.equal((bundle.match(/onSelect:evt=>evt\.preventDefault\(\)/g) ?? []).length, 1);
  assert.match(bundle, /children:A,isDefaultOpen:!0/);
});

test("accepts benign Codex Voice bundle formatting changes", () => {
  const recoveredRoot = createRecoveredFixture();
  const voiceGatePath = path.join(
    recoveredRoot,
    "webview",
    "assets",
    "realtime-voice-feature-gate-fixture.js",
  );
  fs.writeFileSync(
    voiceGatePath,
    "function $ps(){const e = uh( `2380644311` ), t = uh( `1697652030` ); return e && ! t }var ems = n((()=>{gh()}));function tms(){const e=$ps(),t=J(iCn),n=J(zdr);return e&&t&&!n}",
    "utf8",
  );
  const reportPath = path.join(recoveredRoot, "patch-report.json");

  const result = runPatcher(recoveredRoot, reportPath);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(fs.readFileSync(voiceGatePath, "utf8"), /return\s*!0/);
});

test("accepts Codex Voice minifier identifier changes", () => {
  const recoveredRoot = createRecoveredFixture();
  const voiceGatePath = path.join(
    recoveredRoot,
    "webview",
    "assets",
    "realtime-voice-feature-gate-fixture.js",
  );
  fs.writeFileSync(
    voiceGatePath,
    "function Xln(){let a=kh(`2380644311`),b=kh(`1697652030`);return a&&!b}var $9n=n((()=>{gh()}));function yer(){let a=Xln(),b=Y(jln),c=Y(zer);return a&&b&&!c}",
    "utf8",
  );
  const reportPath = path.join(recoveredRoot, "patch-report.json");

  const result = runPatcher(recoveredRoot, reportPath);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(fs.readFileSync(voiceGatePath, "utf8"), /return\s*!0/);
});

test("is idempotent after enabling Codex Voice without runtime gates", () => {
  const recoveredRoot = createRecoveredFixture();
  const voiceGatePath = path.join(
    recoveredRoot,
    "webview",
    "assets",
    "realtime-voice-feature-gate-fixture.js",
  );
  fs.writeFileSync(
    voiceGatePath,
    "function mts(){let e=kh(`2380644311`),t=kh(`1697652030`);return e&&!t}var $9n=n((()=>{gh()}));function nms(){let e=mts(),t=Y(Xln),n=Y(yer);return!0}",
    "utf8",
  );
  const reportPath = path.join(recoveredRoot, "patch-report.json");

  const result = runPatcher(recoveredRoot, reportPath);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(fs.readFileSync(voiceGatePath, "utf8"), /return\s*!0/);
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const patch = report.patches.find(
    (candidate) => candidate.name === "enable Codex Voice rollout gate",
  );
  assert.equal(patch?.status, "already-applied");
});

test("enables Browser downloads in the Electron bundle", () => {
  const recoveredRoot = createRecoveredFixture();
  const browserDownloadsPath = path.join(
    recoveredRoot,
    "webview",
    "assets",
    "browser-downloads-feature-fixture.js",
  );
  const browserDownloadsSource = fs.readFileSync(browserDownloadsPath, "utf8");
  const sharedStateObject =
    "{contactInfo:l,downloads:l,extensions:f,history:m,passwordManager:l,siteSettings:l}";
  fs.writeFileSync(
    browserDownloadsPath,
    `const before=${sharedStateObject};${browserDownloadsSource}const after=${sharedStateObject};`,
    "utf8",
  );
  const reportPath = path.join(recoveredRoot, "patch-report.json");

  const result = runPatcher(recoveredRoot, reportPath);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const bundle = fs.readFileSync(browserDownloadsPath, "utf8");
  assert.match(
    bundle,
    /h=\{contactInfo:l,downloads:\{enabled:!0,isLoading:!1\},extensions:f,history:m,passwordManager:l,siteSettings:l\}/,
  );
  assert.match(bundle, /const before=\{contactInfo:l,downloads:l,extensions:f,history:m,passwordManager:l,siteSettings:l\}/);
  assert.match(bundle, /const after=\{contactInfo:l,downloads:l,extensions:f,history:m,passwordManager:l,siteSettings:l\}/);
  assert.doesNotMatch(bundle, /contactInfo:\{enabled:!0,isLoading:!1\}/);
  assert.doesNotMatch(bundle, /passwordManager:\{enabled:!0,isLoading:!1\}/);

  const repeatResult = runPatcher(recoveredRoot, reportPath);
  assert.equal(repeatResult.status, 0, repeatResult.stderr || repeatResult.stdout);
  const repeatedBundle = fs.readFileSync(browserDownloadsPath, "utf8");
  assert.match(repeatedBundle, /const before=\{contactInfo:l,downloads:l,extensions:f,history:m,passwordManager:l,siteSettings:l\}/);
  assert.match(repeatedBundle, /const after=\{contactInfo:l,downloads:l,extensions:f,history:m,passwordManager:l,siteSettings:l\}/);

  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const patch = report.patches.find(
    (candidate) => candidate.name === "enable Electron Browser downloads",
  );
  assert.equal(patch?.status, "already-applied");
});

test("replaces product text only in JavaScript string and template text", () => {
  const recoveredRoot = createRecoveredFixture();
  const productTextPath = path.join(
    recoveredRoot,
    "webview",
    "assets",
    "product-text-fixture.js",
  );
  const reportPath = path.join(recoveredRoot, "patch-report.json");
  const source = [
    "const ChatGPT={name:`chatgpt`};",
    "const regex=/ChatGPT/g;",
    "// ChatGPT",
    "/* ChatGPT */",
    'const quoted="ChatGPT";',
    'const template=`ChatGPT ${"ChatGPT"} ${ChatGPT}`;',
    "const header=`ChatGPT-Account-ID`;",
    "const headerAlias=`ChatGPT-Account-Id`;",
  ].join("\n");
  const expected = source
    .replace('const quoted="ChatGPT";', 'const quoted="Codex";')
    .replace('const template=`ChatGPT ${"ChatGPT"} ${ChatGPT}`;', 'const template=`Codex ${"Codex"} ${ChatGPT}`;');
  fs.writeFileSync(productTextPath, source, "utf8");

  const result = runPatcher(recoveredRoot, reportPath);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.readFileSync(productTextPath, "utf8"), expected);
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const patch = report.patches.find(
    (candidate) => candidate.name === "replace ChatGPT renderer text with Codex",
  );
  assert.match(patch?.reason, /Replaced 3 product-name occurrence\(s\)/);
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

test("fails without changing a drifted sidebar project limit target", () => {
  const recoveredRoot = createRecoveredFixture();
  const projectsPath = path.join(
    recoveredRoot,
    "webview",
    "assets",
    "projects-section-fixture.js",
  );
  const reportPath = path.join(recoveredRoot, "patch-report.json");
  const driftedSource = fs.readFileSync(projectsPath, "utf8").replace(
    "maxGroups:u?void 0:5",
    "maxGroups:u?void 0:6",
  );
  fs.writeFileSync(projectsPath, driftedSource, "utf8");

  const result = runPatcher(recoveredRoot, reportPath);
  assertRequiredPatchFailure(result, reportPath, "raise sidebar project limit");

  assert.equal(fs.readFileSync(projectsPath, "utf8"), driftedSource);
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

test("fails when the primary runtime manifest bundle is absent", () => {
  const recoveredRoot = createRecoveredFixture();
  fs.unlinkSync(
    path.join(recoveredRoot, ".vite", "build", "primary-runtime-installer-fixture.js"),
  );
  const reportPath = path.join(recoveredRoot, "patch-report.json");

  const result = runPatcher(recoveredRoot, reportPath);

  const patch = assertRequiredPatchFailure(
    result,
    reportPath,
    "route Windows ARM64 primary runtime manifest to GitHub release",
  );
  assert.equal(patch?.file, ".vite/build");
  assert.match(patch?.reason, /Required primary runtime manifest bundle was not found/);
});

test("fails when the WindowsApps LocalCache relocation target drifts", () => {
  const recoveredRoot = createRecoveredFixture();
  const workspaceRootDropHandlerPath = path.join(
    recoveredRoot,
    ".vite",
    "build",
    "workspace-root-drop-handler-fixture.js",
  );
  const reportPath = path.join(recoveredRoot, "patch-report.json");

  fs.writeFileSync(
    workspaceRootDropHandlerPath,
    "function localBin(parts){return (0,path.join)(process.env.LOCALAPPDATA??(0,path.join)((0,os.homedir)(),`AppData`,`Local`),...parts)}",
    "utf8",
  );

  const result = runPatcher(recoveredRoot, reportPath);
  const patch = assertRequiredPatchFailure(
    result,
    reportPath,
    "relocate WindowsApps helper executables into package LocalCache",
  );

  assert.match(patch?.reason, /Required patch target was not found/);
});

test("fails when the inactive Windows Mica target drifts", () => {
  const recoveredRoot = createRecoveredFixture();
  const mainBundlePath = path.join(recoveredRoot, ".vite", "build", "main-fixture.js");
  const reportPath = path.join(recoveredRoot, "patch-report.json");

  fs.writeFileSync(
    mainBundlePath,
    fs.readFileSync(mainBundlePath, "utf8").replace(
      "function D2({appearance:e,isFocused:t,platform:n}){return!t&&!w2(e)&&(n===`darwin`||n===`win32`)}",
      "function D2({appearance:e,isFocused:t,platform:n}){return !t&&!w2(e)&&(n===`darwin`||n===`win32`)}",
    ),
    "utf8",
  );

  const result = runPatcher(recoveredRoot, reportPath);
  const patch = assertRequiredPatchFailure(
    result,
    reportPath,
    "keep Mica enabled for inactive Windows windows",
  );

  assert.match(patch?.reason, /Required patch target was not found/);
});

test("fails when the Windows primary window icon target drifts", () => {
  const recoveredRoot = createRecoveredFixture();
  const mainBundlePath = path.join(recoveredRoot, ".vite", "build", "main-fixture.js");
  const reportPath = path.join(recoveredRoot, "patch-report.json");

  fs.writeFileSync(
    mainBundlePath,
    fs.readFileSync(mainBundlePath, "utf8").replace("width:b,height:x", "width:b, height:x"),
    "utf8",
  );

  const result = runPatcher(recoveredRoot, reportPath);
  const patch = assertRequiredPatchFailure(
    result,
    reportPath,
    "set Windows primary window taskbar icon",
  );

  assert.match(patch?.reason, /Required patch target was not found/);
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
    /vM=46/,
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
  assert.equal(report.patches.length, 11);
  assert.ok(report.patches.every((patch) => patch.status === "applied"));
});

test("uses a collision-free Browser runtime destination when cleanup is locked", () => {
  const recoveredRoot = createRecoveredFixture();
  const reportPath = path.join(recoveredRoot, "patch-report.json");

  const result = runPatcher(recoveredRoot, reportPath);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const bundlePath = path.join(
    recoveredRoot,
    ".vite",
    "build",
    "browser-runtime-relocation-fixture.js",
  );
  const bundle = fs.readFileSync(bundlePath, "utf8");
  assert.match(bundle, /codex-runtime-relocation-fallback/);

  const harness = createBrowserRuntimeHarness(bundle);
  const first = harness.relocate({ executableName: "node.exe", runtimeRoot: harness.runtimeRoot });
  const fallbackRoot = path.join(
    harness.cacheRoot,
    "OpenAI",
    "Codex",
    "runtimes",
    "runtime",
    "runtime-hash-1",
  );
  assert.equal(first, path.join(fallbackRoot, "bin", "node.exe"));
  assert.equal(fs.existsSync(path.join(fallbackRoot, "manifest.json")), true);
  assert.equal(fs.existsSync(path.join(fallbackRoot, "bin", "node_repl.exe")), true);
  assert.equal(harness.cache.get(harness.runtimeRoot), fallbackRoot);
  assert.ok(harness.logs.includes("remove_destination"));

  harness.logs.length = 0;
  const second = harness.relocate({ executableName: "node.exe", runtimeRoot: harness.runtimeRoot });
  assert.equal(second, first);
  assert.deepEqual(harness.logs, []);
});

test("finds Browser runtime relocation after its bundle and local names drift", () => {
  const recoveredRoot = createRecoveredFixture();
  const originalPath = path.join(
    recoveredRoot,
    ".vite",
    "build",
    "browser-runtime-relocation-fixture.js",
  );
  const renamedPath = path.join(recoveredRoot, ".vite", "build", "runtime-source.js");
  const namedSource = browserRuntimeRelocationTargets
    .replace("function tP(", "function relocateRuntime(")
    .replace(/\be\b/g, "executable")
    .replace(/\bt\b/g, "runtimeRoot")
    .replace(/\bn\b/g, "cacheRoot")
    .replace(/\br\b/g, "cacheEntry")
    .replace(/\ba\b/g, "sourceFiles")
    .replace(/\bo\b/g, "currentHash")
    .replace(/\bs\b/g, "destinationRoot")
    .replace(/\bl\b/g, "executablePath")
    .replace(/\bu\b/g, "stagingRoot");
  fs.renameSync(originalPath, renamedPath);
  fs.writeFileSync(renamedPath, namedSource, "utf8");
  const reportPath = path.join(recoveredRoot, "patch-report.json");

  const result = runPatcher(recoveredRoot, reportPath);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(fs.readFileSync(renamedPath, "utf8"), /codex-runtime-relocation-fallback/);
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const patch = report.patches.find(
    (candidate) => candidate.name === "use a collision-free Browser runtime cache target",
  );
  assert.equal(patch?.status, "applied");
  assert.equal(patch?.file, ".vite/build/runtime-source.js");
});

test("fails without changing a drifted Browser runtime relocation target", () => {
  const recoveredRoot = createRecoveredFixture();
  const runtimePath = path.join(
    recoveredRoot,
    ".vite",
    "build",
    "browser-runtime-relocation-fixture.js",
  );
  const reportPath = path.join(recoveredRoot, "patch-report.json");
  const driftedSource = fs
    .readFileSync(runtimePath, "utf8")
    .replace("operation:`remove_destination`", "operation:`remove_runtime_destination`");
  fs.writeFileSync(runtimePath, driftedSource, "utf8");

  const result = runPatcher(recoveredRoot, reportPath);
  const patch = assertRequiredPatchFailure(
    result,
    reportPath,
    "use a collision-free Browser runtime cache target",
  );

  assert.equal(fs.readFileSync(runtimePath, "utf8"), driftedSource);
  assert.match(patch?.reason, /Unable to identify Browser runtime relocation cleanup/);
});

test("fails when the Browser runtime relocation bundle is missing", () => {
  const recoveredRoot = createRecoveredFixture();
  fs.unlinkSync(
    path.join(recoveredRoot, ".vite", "build", "browser-runtime-relocation-fixture.js"),
  );
  const reportPath = path.join(recoveredRoot, "patch-report.json");

  const result = runPatcher(recoveredRoot, reportPath);
  const patch = assertRequiredPatchFailure(
    result,
    reportPath,
    "use a collision-free Browser runtime cache target",
  );

  assert.equal(patch?.file, ".vite/build");
  assert.match(patch?.reason, /Expected exactly one recovered bundle file containing/);
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
    `${indexFeatureTargets}var dM=\`#00000000\`,vM=36,yM=\`#1f1f1f\`,bM=\`#ffffff\`;function xM(){return{color:dM,symbolColor:n.nativeTheme.shouldUseDarkColors?bM:yM,height:vM}}function IM(platform){return platform===\`win32\`?{titleBarStyle:\`hidden\`,titleBarOverlay:xM()}:null}function w2(appearance){return appearance===\`dark\`}function D2({appearance:e,isFocused:t,platform:n}){return!t&&!w2(e)&&(n===\`darwin\`||n===\`win32\`)}function applyWindowBackdrop(window,backgroundMaterial){window.setBackgroundMaterial(backgroundMaterial);return{backgroundMaterial}}function createMainWindow(){return new n.BrowserWindow({width:b,height:x,title:q??n.app.getName(),webPreferences:k})}`,
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
    path.join(recoveredRoot, "webview", "assets", "usage-remaining-fixture.js"),
    path.join(recoveredRoot, "webview", "assets", "projects-section-fixture.js"),
    path.join(recoveredRoot, "webview", "assets", "composer-fixture.js"),
    path.join(recoveredRoot, "webview", "assets", "agent-settings-fixture.js"),
    path.join(recoveredRoot, "webview", "assets", "product-text-fixture.js"),
    path.join(recoveredRoot, "webview", "assets", "realtime-voice-feature-gate-fixture.js"),
    path.join(recoveredRoot, "webview", "assets", "use-model-settings-fixture.js"),
    path.join(recoveredRoot, ".vite", "build", "workspace-root-drop-handler-fixture.js"),
    path.join(recoveredRoot, ".vite", "build", "browser-runtime-relocation-fixture.js"),
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
  assert.ok(report.patches.every((patch) => patch.status === "already-applied"));
});
