import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.dirname(scriptsRoot);
const repoRoot = path.dirname(desktopRoot);
const require = createRequire(import.meta.url);
const {
  commandForWindowsArm64PlanStep,
  environmentForWindowsArm64PlanStep,
  expandWindowsArm64Plan,
  windowsArm64HydratedCacheInputPaths,
  windowsArm64NativeModuleCacheInputPaths,
} = require(path.join(desktopRoot, ".cache", "scripts", "windows-arm64-package-plan.js"));

function stepIds(target) {
  return expandWindowsArm64Plan(target).map((step) => step.id);
}

test("Windows ARM64 package plan owns target ordering", () => {
  assert.deepEqual(stepIds("prepare"), [
    "build-windows-updater",
    "hydrate-app",
    "hydrate-cli",
    "verify-browser-client-runtime",
  ]);
  assert.deepEqual(stepIds("make"), [
    "build-windows-updater",
    "hydrate-app",
    "hydrate-cli",
    "verify-browser-client-runtime",
    "make-win-arm64",
    "verify-windows-arm64-resource-binaries",
  ]);
  assert.deepEqual(stepIds("package"), [
    "build-windows-updater",
    "hydrate-app",
    "hydrate-cli",
    "verify-browser-client-runtime",
    "package-win-arm64",
    "verify-windows-arm64-resource-binaries",
  ]);
});

test("Windows ARM64 package plan scopes GitHub tokens to hydration steps", () => {
  for (const step of expandWindowsArm64Plan("make")) {
    const env = environmentForWindowsArm64PlanStep(step, {
      GH_TOKEN: "gh",
      GITHUB_TOKEN: "github",
    });
    if (step.id === "hydrate-app" || step.id === "hydrate-cli") {
      assert.equal(env.GH_TOKEN, "gh");
      assert.equal(env.GITHUB_TOKEN, "github");
    } else {
      assert.equal(env.GH_TOKEN, undefined);
      assert.equal(env.GITHUB_TOKEN, undefined);
    }
  }
});

test("Windows ARM64 package plan passes appcast feed only to app hydration", () => {
  const hydrateApp = expandWindowsArm64Plan("hydrate").find((step) => step.id === "hydrate-app");
  const hydrateCli = expandWindowsArm64Plan("hydrate").find((step) => step.id === "hydrate-cli");

  assert.ok(hydrateApp);
  assert.ok(hydrateCli);
  assert.deepEqual(
    commandForWindowsArm64PlanStep(hydrateApp, { CODEX_APPCAST_FEED: "beta" }).slice(-3),
    ["--", "--appcast-feed", "beta"],
  );
  assert.doesNotMatch(commandForWindowsArm64PlanStep(hydrateCli, { CODEX_APPCAST_FEED: "beta" }).join(" "), /appcast-feed/);
});

test("Windows ARM64 package scripts delegate to the package plan", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(desktopRoot, "package.json"), "utf8"));

  assert.equal(packageJson.scripts["prepare:win:arm64"], "npm run build:scripts && npm run plan:win:arm64:compiled -- prepare");
  assert.equal(packageJson.scripts["package:win:arm64"], "npm run build:scripts && npm run plan:win:arm64:compiled -- package");
  assert.equal(packageJson.scripts["make:win:arm64"], "npm run build:scripts && npm run plan:win:arm64:compiled -- make");
  assert.equal(packageJson.scripts["make:win:arm64:ci"], "npm run build:scripts && npm run plan:win:arm64:compiled -- make");
});

test("Windows ARM64 workflows use the package plan adapter", () => {
  for (const workflowName of ["windows-arm64-pr-build.yml", "windows-arm64-release.yml"]) {
    const workflowSource = fs.readFileSync(path.join(repoRoot, ".github", "workflows", workflowName), "utf8");

    assert.match(workflowSource, /npm run plan:win:arm64:compiled -- make/);
    assert.doesNotMatch(workflowSource, /npm run hydrate:app:compiled -- --appcast-feed/);
    assert.doesNotMatch(workflowSource, /npm run build:windows-oai-update-checker -- -Architecture arm64/);
    assert.match(workflowSource, /CODEX_APPCAST_FEED: \$\{\{ steps\.upstream\.outputs\.codex_appcast_feed \}\}/);
    assert.match(workflowSource, /GH_TOKEN: \$\{\{ github\.token \}\}/);
  }
});

test("Windows ARM64 cache input lists include the executable plan and hydrators", () => {
  assert.ok(windowsArm64HydratedCacheInputPaths.includes("scripts/windows-arm64-package-plan.ts"));
  assert.ok(windowsArm64HydratedCacheInputPaths.includes("scripts/hydrate-codex-cli.ts"));
  assert.ok(windowsArm64HydratedCacheInputPaths.includes("scripts/resource-binary-exceptions.ts"));
  assert.ok(windowsArm64NativeModuleCacheInputPaths.includes("scripts/patch-better-sqlite3-electron.ts"));
});

test("Windows ARM64 package plan is safe to import before npm ci", () => {
  const source = fs.readFileSync(path.join(desktopRoot, "scripts", "windows-arm64-package-plan.ts"), "utf8");

  assert.match(source, /Keep this file dependency-light/);
  assert.match(source, /typeof require !== "undefined" && require\.main === module/);
});
