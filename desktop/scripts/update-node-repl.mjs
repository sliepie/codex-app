import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const STORE_PRODUCT_ID = "9PLM9XGG6VKS";
const EXPECTED_PUBLISHER = "CN=50BDFD77-8903-4850-9FFE-6E8522F64D5B";
const EXPECTED_PE_MACHINE_X64 = 0x8664;

const scriptDir = dirname(fileURLToPath(import.meta.url));
const desktopDir = resolve(scriptDir, "..");
const repoRoot = resolve(desktopDir, "..");
const resourceDir = join(desktopDir, "resources");
const targetExe = join(resourceDir, "node_repl.exe");
const targetMetadata = join(resourceDir, "node_repl.json");

function run(command, args, options = {}) {
  const output = execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });

  return typeof output === "string" ? output.trim() : "";
}

function runPowerShell(script) {
  return run("powershell.exe", [
    "-NoLogo",
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    script,
  ]);
}

function readOfficialStorePackages() {
  const script = `
$packages = Get-AppxPackage |
  Where-Object {
    $nodeReplPath = Join-Path $_.InstallLocation 'app\\resources\\node_repl.exe'
    $legacyNodeReplPath = Join-Path $_.InstallLocation 'resources\\node_repl.exe'
    $_.InstallLocation -and
    $_.Name -like 'OpenAI.Codex*' -and
    $_.Publisher -eq '${EXPECTED_PUBLISHER}' -and
    ((Test-Path $nodeReplPath) -or (Test-Path $legacyNodeReplPath))
  } |
  Sort-Object Version -Descending |
  Select-Object Name, PackageFullName, PackageFamilyName, Version, Publisher, SignatureKind, InstallLocation, @{
    Name = 'NodeReplPath'
    Expression = {
      $nodeReplPath = Join-Path $_.InstallLocation 'app\\resources\\node_repl.exe'
      if (Test-Path $nodeReplPath) {
        $nodeReplPath
      } else {
        Join-Path $_.InstallLocation 'resources\\node_repl.exe'
      }
    }
  }
$packages | ConvertTo-Json -Depth 4
`;
  const output = runPowerShell(script);

  if (!output) {
    return [];
  }

  const parsed = JSON.parse(output);
  return Array.isArray(parsed) ? parsed : [parsed];
}

function ensureWingetStoreMetadata() {
  const output = run("winget", [
    "show",
    "--id",
    STORE_PRODUCT_ID,
    "--source",
    "msstore",
    "--accept-source-agreements",
  ]);

  if (!output.includes(`Found Codex [${STORE_PRODUCT_ID}]`) || !output.includes("Publisher: OpenAI")) {
    throw new Error(`winget did not return the expected Store Codex package for ${STORE_PRODUCT_ID}`);
  }
}

function installStorePackage() {
  run("winget", [
    "install",
    "--id",
    STORE_PRODUCT_ID,
    "--source",
    "msstore",
    "--accept-source-agreements",
    "--accept-package-agreements",
    "--disable-interactivity",
  ], { stdio: "inherit" });
}

function uninstallStorePackage() {
  run("winget", [
    "uninstall",
    "--id",
    STORE_PRODUCT_ID,
    "--source",
    "msstore",
    "--disable-interactivity",
  ], { stdio: "inherit" });
}

function assertPeX64(filePath) {
  const buffer = readFileSync(filePath);
  if (buffer.length < 0x40 || buffer.toString("ascii", 0, 2) !== "MZ") {
    throw new Error(`${filePath} is not a PE file`);
  }

  const peOffset = buffer.readUInt32LE(0x3c);
  if (buffer.toString("ascii", peOffset, peOffset + 4) !== "PE\u0000\u0000") {
    throw new Error(`${filePath} has an invalid PE header`);
  }

  const machine = buffer.readUInt16LE(peOffset + 4);
  if (machine !== EXPECTED_PE_MACHINE_X64) {
    throw new Error(`${filePath} PE machine is 0x${machine.toString(16)}, expected x64`);
  }
}

function sha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

ensureWingetStoreMetadata();

const packagesBeforeInstall = readOfficialStorePackages();
const installedByScript = packagesBeforeInstall.length === 0;

try {
  if (installedByScript) {
    installStorePackage();
  }

  const packages = readOfficialStorePackages();
  if (packages.length === 0) {
    throw new Error("The official Store Codex package is installed, but resources/node_repl.exe was not found.");
  }

  const sourcePackage = packages[0];
  const sourceExe = sourcePackage.NodeReplPath;

  mkdirSync(resourceDir, { recursive: true });
  copyFileSync(sourceExe, targetExe);
  assertPeX64(targetExe);

  const metadata = {
    source: {
      kind: "microsoft-store",
      productId: STORE_PRODUCT_ID,
      wingetSource: "msstore",
    },
    packageIdentity: {
      name: sourcePackage.Name,
      fullName: sourcePackage.PackageFullName,
      familyName: sourcePackage.PackageFamilyName,
      version: String(sourcePackage.Version),
      publisher: sourcePackage.Publisher,
      signatureKind: sourcePackage.SignatureKind,
    },
    sourceRelativePath: sourceExe.slice(sourcePackage.InstallLocation.length + 1).replaceAll("\\", "/"),
    vendoredRelativePath: "resources/node_repl.exe",
    sha256: sha256(targetExe),
  };

  writeFileSync(targetMetadata, `${JSON.stringify(metadata, null, 2)}\n`);
  JSON.parse(readFileSync(targetMetadata, "utf8"));

  console.log(`Updated ${targetExe}`);
  console.log(`Source package: ${sourcePackage.PackageFullName}`);
  console.log(`SHA-256: ${metadata.sha256}`);
} finally {
  if (installedByScript) {
    uninstallStorePackage();
  }
}
