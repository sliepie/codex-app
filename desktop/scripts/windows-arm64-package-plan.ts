import { execFileSync } from "node:child_process";

export type WindowsArm64PlanTarget = "hydrate" | "make" | "package" | "prepare" | "verify";

export type WindowsArm64PlanStepId =
  | "build-windows-updater"
  | "hydrate-app"
  | "hydrate-cli"
  | "make-win-arm64"
  | "package-win-arm64"
  | "verify-browser-client-runtime"
  | "verify-windows-arm64-resource-binaries";

export type WindowsArm64PlanStep = {
  forwardsGitHubToken: boolean;
  id: WindowsArm64PlanStepId;
  label: string;
};

export const windowsArm64HydratedCacheKeyVersion = "v6";
export const windowsArm64NativeModulesCacheKeyVersion = "v1";

export const windowsArm64HydratedCacheInputPaths = [
  "package-lock.json",
  "scripts/bundled-plugin-windows-payloads.ts",
  "scripts/github-release-assets.ts",
  "scripts/hydrate-codex-app.ts",
  "scripts/hydrate-codex-cli.ts",
  "scripts/resource-binary-exceptions.ts",
  "scripts/windows-arm64-package-plan.ts",
  "resources/extension-host.json",
  "resources/node_repl.json",
] as const;

export const windowsArm64NativeModuleCacheInputPaths = [
  "package-lock.json",
  "scripts/hydrate-codex-app.ts",
  "scripts/patch-better-sqlite3-electron.ts",
] as const;

export const windowsArm64PackagePlan: WindowsArm64PlanStep[] = [
  {
    forwardsGitHubToken: false,
    id: "build-windows-updater",
    label: "Build Windows updater",
  },
  {
    forwardsGitHubToken: true,
    id: "hydrate-app",
    label: "Hydrate Codex app resources",
  },
  {
    forwardsGitHubToken: true,
    id: "hydrate-cli",
    label: "Hydrate Codex CLI resources",
  },
  {
    forwardsGitHubToken: false,
    id: "verify-browser-client-runtime",
    label: "Verify browser client runtime",
  },
  {
    forwardsGitHubToken: false,
    id: "package-win-arm64",
    label: "Package Windows ARM64 app",
  },
  {
    forwardsGitHubToken: false,
    id: "make-win-arm64",
    label: "Make Windows ARM64 ZIP",
  },
  {
    forwardsGitHubToken: false,
    id: "verify-windows-arm64-resource-binaries",
    label: "Verify Windows ARM64 Resource binaries",
  },
];

const stepById = new Map(windowsArm64PackagePlan.map((step) => [step.id, step]));

const targetSteps: Record<WindowsArm64PlanTarget, WindowsArm64PlanStepId[]> = {
  hydrate: ["hydrate-app", "hydrate-cli"],
  prepare: ["build-windows-updater", "hydrate-app", "hydrate-cli", "verify-browser-client-runtime"],
  package: [
    "build-windows-updater",
    "hydrate-app",
    "hydrate-cli",
    "verify-browser-client-runtime",
    "package-win-arm64",
    "verify-windows-arm64-resource-binaries",
  ],
  make: [
    "build-windows-updater",
    "hydrate-app",
    "hydrate-cli",
    "verify-browser-client-runtime",
    "make-win-arm64",
    "verify-windows-arm64-resource-binaries",
  ],
  verify: ["verify-browser-client-runtime", "verify-windows-arm64-resource-binaries"],
};

export function expandWindowsArm64Plan(target: WindowsArm64PlanTarget): WindowsArm64PlanStep[] {
  const ids = targetSteps[target];
  if (!ids) {
    throw new Error("Unknown Windows ARM64 package plan target: " + target);
  }

  return ids.map((id) => {
    const step = stepById.get(id);
    if (!step) {
      throw new Error("Unknown Windows ARM64 package plan step: " + id);
    }
    return step;
  });
}

function npmCommand(): string {
  return "npm";
}

function quoteWindowsShellArg(value: string): string {
  if (/^[A-Za-z0-9_./:=+-]+$/.test(value)) {
    return value;
  }

  return '"' + value.replaceAll('"', '\\"') + '"';
}

export function commandForWindowsArm64PlanStep(step: WindowsArm64PlanStep, env = process.env): string[] {
  switch (step.id) {
    case "build-windows-updater":
      return [npmCommand(), "run", "build:windows-oai-update-checker", "--", "-Architecture", "arm64"];
    case "hydrate-app": {
      const command = [npmCommand(), "run", "hydrate:app:compiled"];
      if (env.CODEX_APPCAST_FEED) {
        command.push("--", "--appcast-feed", env.CODEX_APPCAST_FEED);
      }
      return command;
    }
    case "hydrate-cli":
      return [npmCommand(), "run", "hydrate:cli:compiled"];
    case "verify-browser-client-runtime":
      return [npmCommand(), "run", "verify:browser-client-runtime:compiled"];
    case "package-win-arm64":
      return [npmCommand(), "run", "package:win:arm64:compiled"];
    case "make-win-arm64":
      return [npmCommand(), "run", "make:win:arm64:compiled"];
    case "verify-windows-arm64-resource-binaries":
      return [npmCommand(), "run", "verify:windows-arm64-resource-binaries:compiled"];
  }
}

export function processInvocationForWindowsArm64PlanStep(
  step: WindowsArm64PlanStep,
  env = process.env,
): string[] {
  const logicalCommand = commandForWindowsArm64PlanStep(step, env);
  if (process.platform !== "win32") {
    return logicalCommand;
  }

  return [
    process.env.ComSpec ?? "cmd.exe",
    "/d",
    "/s",
    "/c",
    logicalCommand.map(quoteWindowsShellArg).join(" "),
  ];
}

export function environmentForWindowsArm64PlanStep(
  step: WindowsArm64PlanStep,
  env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const nextEnv = { ...env };
  if (!step.forwardsGitHubToken) {
    delete nextEnv.GH_TOKEN;
    delete nextEnv.GITHUB_TOKEN;
  }
  return nextEnv;
}

function parseTarget(argv: string[]): WindowsArm64PlanTarget {
  const target = argv[0] ?? "prepare";
  if (!Object.prototype.hasOwnProperty.call(targetSteps, target)) {
    throw new Error("Unknown Windows ARM64 package plan target: " + target);
  }
  return target as WindowsArm64PlanTarget;
}

function runStep(step: WindowsArm64PlanStep): void {
  const [command, ...args] = processInvocationForWindowsArm64PlanStep(step);
  const inActions = process.env.GITHUB_ACTIONS === "true";
  if (inActions) {
    console.log("::group::" + step.label);
  } else {
    console.log(step.label);
  }
  try {
    execFileSync(command, args, {
      env: environmentForWindowsArm64PlanStep(step),
      stdio: "inherit",
    });
  } finally {
    if (inActions) {
      console.log("::endgroup::");
    }
  }
}

function main(): void {
  const target = parseTarget(process.argv.slice(2));
  for (const step of expandWindowsArm64Plan(target)) {
    runStep(step);
  }
}

if (typeof require !== "undefined" && require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

// Keep this file dependency-light; resolve-codex-releases.ts imports its cache input lists before npm ci.
