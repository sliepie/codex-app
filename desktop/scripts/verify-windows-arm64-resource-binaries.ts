import fs from "node:fs";
import path from "node:path";
import {
  formatPeMachine,
  matchWindowsArm64ResourceBinaryException,
  peMachine,
  readPeMachine,
  validateVendoredResourceBinaryProvenanceForDesktop,
  windowsArm64ResourceBinaryExceptions,
} from "./resource-binary-exceptions";

type Options = {
  desktopRoot: string;
  packageRoot: string;
};

export type ResourceBinaryVerificationResult = {
  allowedExceptions: string[];
  checkedPeFiles: number;
};

function resolveDesktopRoot(): string {
  return path.basename(__dirname) === "scripts" && path.basename(path.dirname(__dirname)) === ".cache"
    ? path.resolve(__dirname, "..", "..")
    : path.resolve(__dirname, "..");
}

function readOption(argv: string[], ...names: string[]): string | undefined {
  for (const name of names) {
    const index = argv.indexOf(name);
    if (index !== -1) {
      const value = argv[index + 1];
      if (!value || value.startsWith("-")) {
        throw new Error("Missing value for " + name);
      }
      return value;
    }
  }
  return undefined;
}

function parseOptions(argv: string[]): Options {
  const desktopRoot = resolveDesktopRoot();
  return {
    desktopRoot,
    packageRoot: readOption(argv, "--package-root", "-PackageRoot") ??
      path.join(desktopRoot, "out", "Codex-win32-arm64"),
  };
}

function isPeCandidate(filePath: string): boolean {
  return [".dll", ".exe", ".node"].includes(path.extname(filePath).toLowerCase());
}

function walkFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(entryPath));
      continue;
    }
    files.push(entryPath);
  }
  return files;
}

export function verifyWindowsArm64ResourceBinaries(options: Options): ResourceBinaryVerificationResult {
  if (!fs.existsSync(options.packageRoot)) {
    throw new Error("Missing Windows ARM64 package root: " + options.packageRoot);
  }

  validateVendoredResourceBinaryProvenanceForDesktop(options.desktopRoot);

  let checkedPeFiles = 0;
  const matchedExceptionIds = new Set<string>();
  for (const filePath of walkFiles(options.packageRoot)) {
    if (!isPeCandidate(filePath)) {
      continue;
    }

    checkedPeFiles += 1;
    const packageRelativePath = path.relative(options.packageRoot, filePath).replaceAll(path.sep, "/");
    const machine = readPeMachine(filePath);
    if (machine === peMachine.arm64) {
      continue;
    }

    const exception = matchWindowsArm64ResourceBinaryException(packageRelativePath);
    if (!exception || exception.expectedMachine !== machine) {
      throw new Error(
        "Unexpected non-ARM64 Resource binary " + packageRelativePath + ": " +
          formatPeMachine(machine) + ".",
      );
    }
    matchedExceptionIds.add(exception.id);
  }

  for (const exception of windowsArm64ResourceBinaryExceptions) {
    if (exception.requiredInPackage && !matchedExceptionIds.has(exception.id)) {
      throw new Error("Missing required Resource binary exception in package: " + exception.label);
    }
  }

  return {
    allowedExceptions: [...matchedExceptionIds].sort(),
    checkedPeFiles,
  };
}

async function main(): Promise<void> {
  const result = verifyWindowsArm64ResourceBinaries(parseOptions(process.argv.slice(2)));
  console.log(
    "Verified Windows ARM64 Resource binaries: " +
      result.checkedPeFiles +
      " PE files, exceptions: " +
      result.allowedExceptions.join(", "),
  );
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
