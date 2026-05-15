import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

type NpmEnvironment = Record<string, string | undefined>;

type BetterSqlite3ElectronRebuildOptions = {
  electronVersion: string;
  nodeModulesRoot: string;
};

function normalizeRuntimeVersion(version: string): string {
  return version.replace(/^v/i, "");
}

function runtimeMajorVersion(runtimeVersion: string): number | undefined {
  const majorText = normalizeRuntimeVersion(runtimeVersion).split(".")[0];
  if (!/^\d+$/.test(majorText)) {
    return undefined;
  }
  return Number.parseInt(majorText, 10);
}

function packageRoot(nodeModulesRoot: string, packageName: string): string {
  return path.join(nodeModulesRoot, ...packageName.split("/"));
}

function electronRebuildDevDir(): string {
  const homeDir = os.homedir();
  if (!homeDir) {
    throw new Error("A user home directory is required to prepare Electron headers.");
  }
  return path.resolve(homeDir, ".electron-gyp");
}

function replaceSourceOnce(filePath: string, needle: string, replacement: string): boolean {
  const source = fs.readFileSync(filePath, "utf8");
  if (source.includes(replacement)) {
    return false;
  }
  if (!source.includes(needle)) {
    throw new Error(
      `Could not find better-sqlite3 V8 external pointer patch needle in ${filePath}`,
    );
  }
  fs.writeFileSync(filePath, source.replace(needle, replacement), "utf8");
  return true;
}

export function patchBetterSqlite3ForV8ExternalPointerApi(
  nodeModulesRoot: string,
  electronVersion: string,
): void {
  const electronMajor = runtimeMajorVersion(electronVersion);
  if (electronMajor === undefined || electronMajor < 42) {
    return;
  }

  const moduleRoot = packageRoot(nodeModulesRoot, "better-sqlite3");
  if (!fs.existsSync(moduleRoot)) {
    throw new Error(`better-sqlite3 source not found at ${moduleRoot}`);
  }

  const mainSource = path.join(moduleRoot, "src", "better_sqlite3.cpp");
  const helpersSource = path.join(moduleRoot, "src", "util", "helpers.cpp");
  const macrosSource = path.join(moduleRoot, "src", "util", "macros.cpp");

  for (const [label, filePath] of [
    ["main", mainSource],
    ["helpers", helpersSource],
    ["macros", macrosSource],
  ] as const) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing better-sqlite3 ${label} source: ${filePath}`);
    }
  }

  let patched = false;
  patched =
    replaceSourceOnce(
      mainSource,
      "v8::Local<v8::External> data = v8::External::New(isolate, addon);",
      "v8::Local<v8::External> data = BETTER_SQLITE3_EXTERNAL_NEW(isolate, addon);",
    ) || patched;

  patched =
    replaceSourceOnce(
      macrosSource,
      `#define EasyIsolate v8::Isolate* isolate = v8::Isolate::GetCurrent()
#define OnlyIsolate info.GetIsolate()
#define OnlyContext isolate->GetCurrentContext()
#define OnlyAddon static_cast<Addon*>(info.Data().As<v8::External>()->Value())`,
      `#if defined(V8_MAJOR_VERSION) && V8_MAJOR_VERSION >= 14
#define BETTER_SQLITE3_EXTERNAL_POINTER_TAG v8::kExternalPointerTypeTagDefault
#define BETTER_SQLITE3_EXTERNAL_NEW(isolate, value) v8::External::New((isolate), (value), BETTER_SQLITE3_EXTERNAL_POINTER_TAG)
#define BETTER_SQLITE3_EXTERNAL_VALUE(external) ((external)->Value(BETTER_SQLITE3_EXTERNAL_POINTER_TAG))
#else
#define BETTER_SQLITE3_EXTERNAL_NEW(isolate, value) v8::External::New((isolate), (value))
#define BETTER_SQLITE3_EXTERNAL_VALUE(external) ((external)->Value())
#endif

#define EasyIsolate v8::Isolate* isolate = v8::Isolate::GetCurrent()
#define OnlyIsolate info.GetIsolate()
#define OnlyContext isolate->GetCurrentContext()
#define OnlyAddon static_cast<Addon*>(BETTER_SQLITE3_EXTERNAL_VALUE(info.Data().As<v8::External>()))`,
    ) || patched;

  patched =
    replaceSourceOnce(
      helpersSource,
      `\t\tfunc,
\t\t0,
\t\tdata`,
      `\t\tfunc,
\t\tnullptr,
\t\tdata`,
    ) || patched;

  console.log(
    patched
      ? "Patched better-sqlite3 source for V8 external pointer API."
      : "better-sqlite3 V8 external pointer source patch already applied.",
  );
}

export function patchElectronCppgcHeapForMsvcHeader(headerPath: string): void {
  if (!fs.existsSync(headerPath)) {
    throw new Error(`Missing Electron cppgc heap header: ${headerPath}`);
  }

  const includeAnchor = '#include "v8config.h"  // NOLINT(build/include_directory)';
  const includeBlock = `${includeAnchor}

#if defined(_MSC_VER) && !defined(__clang__)
#include <intrin.h>
#pragma intrinsic(_AddressOfReturnAddress)
#endif`;
  const constructor =
    "StackStartMarker() : stack_start_(__builtin_frame_address(0)) {}";
  const replacement = `#if defined(_MSC_VER) && !defined(__clang__)
  StackStartMarker() : stack_start_(_AddressOfReturnAddress()) {}
#else
  StackStartMarker() : stack_start_(__builtin_frame_address(0)) {}
#endif`;

  let source = fs.readFileSync(headerPath, "utf8");
  if (source.includes("_AddressOfReturnAddress")) {
    console.log(`Electron cppgc heap header already patched for MSVC: ${headerPath}`);
    return;
  }
  if (!source.includes(includeAnchor)) {
    throw new Error(`Could not find Electron cppgc heap include anchor in ${headerPath}`);
  }
  if (!source.includes(constructor)) {
    throw new Error(`Could not find Electron cppgc heap stack marker in ${headerPath}`);
  }

  source = source.replace(includeAnchor, includeBlock);
  source = source.replace(constructor, replacement);
  fs.writeFileSync(headerPath, source, "utf8");
  console.log(`Patched Electron cppgc heap header for MSVC: ${headerPath}`);
}

export function prepareElectronHeadersForNativeRebuild(
  desktopRoot: string,
  electronVersion: string,
  targetArch: string,
): NpmEnvironment | undefined {
  if (process.platform !== "win32") {
    return undefined;
  }
  const electronMajor = runtimeMajorVersion(electronVersion);
  if (electronMajor === undefined || electronMajor < 42) {
    return undefined;
  }

  const nodeGypCli = path.join(desktopRoot, "node_modules", "node-gyp", "bin", "node-gyp.js");
  if (!fs.existsSync(nodeGypCli)) {
    throw new Error(`Missing node-gyp CLI for Electron header preparation: ${nodeGypCli}`);
  }

  const devDir = electronRebuildDevDir();
  const normalizedElectronVersion = normalizeRuntimeVersion(electronVersion);
  const env = {
    ...process.env,
    npm_config_devdir: devDir,
  };

  execFileSync(
    process.execPath,
    [
      nodeGypCli,
      "install",
      "--target",
      normalizedElectronVersion,
      "--arch",
      targetArch,
      "--dist-url",
      "https://electronjs.org/headers",
      "--devdir",
      devDir,
    ],
    { cwd: desktopRoot, env, stdio: "inherit" },
  );

  patchElectronCppgcHeapForMsvcHeader(
    path.join(devDir, normalizedElectronVersion, "include", "node", "cppgc", "heap.h"),
  );

  return env;
}

export function prepareBetterSqlite3ElectronRebuild(
  options: BetterSqlite3ElectronRebuildOptions,
): void {
  patchBetterSqlite3ForV8ExternalPointerApi(
    options.nodeModulesRoot,
    options.electronVersion,
  );
}
