import { createHash } from "crypto";
import { createWriteStream } from "fs";
import * as fs from "fs";
import * as path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { spawnSync } from "child_process";

type ArchiveFormat = "zip" | "tar.xz";

type PrimaryRuntimeManifest = {
  archiveName?: string;
  archiveSha256?: string;
  archiveSizeBytes?: number;
  archiveUrl?: string;
  bundleFormatVersion?: unknown;
  bundleVersion?: string;
  format?: string;
  generatedDependencies?: unknown;
  latestManifestFileName?: string;
  latestManifestUrl?: string;
  nodeVersion?: string;
  pythonVersion?: string;
  runtimeRootDirectoryName?: string;
  targetArch?: string;
  targetPlatform?: string;
};

type BuildOptions = {
  arm64NodeArchiveUrl?: string;
  arm64PythonArchiveUrl?: string;
  repository: string;
  releaseTag: string;
  outputRoot: string;
};

const runtimeRootDirectoryName = "codex-primary-runtime";
const targetPlatform = "win32";
const targetArch = "arm64";
const manifestFileName = "LATEST.json";
const publicWindowsX64ManifestUrl =
  "https://persistent.oaistatic.com/codex-primary-runtime/latest/win32-x64/LATEST.json";

function resolveDesktopRoot(): string {
  if (path.basename(__dirname) === "scripts" && path.basename(path.dirname(__dirname)) === ".cache") {
    return path.dirname(path.dirname(__dirname));
  }
  return path.dirname(__dirname);
}

const desktopRoot = resolveDesktopRoot();

function readOption(argv: readonly string[], names: readonly string[]): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    for (const name of names) {
      if (arg === name) {
        return argv[index + 1];
      }
      if (arg.startsWith(`${name}=`)) {
        return arg.slice(name.length + 1);
      }
    }
  }
  return undefined;
}

function readOptions(argv: readonly string[]): BuildOptions {
  const repository =
    readOption(argv, ["-Repository", "--repository"]) ??
    process.env.GITHUB_REPOSITORY ??
    "sliepie/codex-app";
  const outputRoot =
    readOption(argv, ["-OutputRoot", "--output-root"]) ??
    path.join(desktopRoot, "out", "primary-runtime", "win32-arm64");

  return {
    arm64NodeArchiveUrl:
      readOption(argv, ["-Arm64NodeArchiveUrl", "--arm64-node-archive-url"]) ??
      process.env.PRIMARY_RUNTIME_ARM64_NODE_ARCHIVE_URL,
    arm64PythonArchiveUrl:
      readOption(argv, ["-Arm64PythonArchiveUrl", "--arm64-python-archive-url"]) ??
      process.env.PRIMARY_RUNTIME_ARM64_PYTHON_ARCHIVE_URL,
    repository,
    releaseTag:
      readOption(argv, ["-ReleaseTag", "--release-tag"]) ??
      "codex-primary-runtime-win32-arm64",
    outputRoot,
  };
}

function isBlank(value: string | undefined): value is undefined {
  return value == null || value.trim() === "";
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

async function cleanDirectory(directory: string): Promise<void> {
  await fs.promises.rm(directory, { recursive: true, force: true });
  await fs.promises.mkdir(directory, { recursive: true });
}

async function saveUrlOrFile(source: string | undefined, destination: string): Promise<void> {
  if (isBlank(source)) {
    throw new Error(`Missing source for ${destination}.`);
  }

  await fs.promises.mkdir(path.dirname(destination), { recursive: true });
  if (isHttpUrl(source)) {
    const response = await fetch(source, {
      headers: { "User-Agent": "codex-primary-runtime-builder" },
    });
    if (!response.ok) {
      throw new Error(`Failed to download ${source}: ${response.status} ${response.statusText}`);
    }
    if (response.body == null) {
      await fs.promises.writeFile(destination, Buffer.from(await response.arrayBuffer()));
      return;
    }
    await pipeline(Readable.fromWeb(response.body as never), createWriteStream(destination));
    return;
  }

  if (path.resolve(source) === path.resolve(destination)) {
    return;
  }
  await fs.promises.copyFile(source, destination);
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.promises.readFile(filePath, "utf8")) as T;
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  await pipeline(fs.createReadStream(filePath), hash);
  return hash.digest("hex");
}

function getArchiveNameFromUrl(archiveUrl: string | undefined): string | undefined {
  if (isBlank(archiveUrl)) {
    return undefined;
  }

  if (isHttpUrl(archiveUrl)) {
    try {
      return path.posix.basename(new URL(archiveUrl).pathname) || undefined;
    } catch {
      return undefined;
    }
  }

  return path.basename(archiveUrl.split("?", 2)[0] ?? archiveUrl) || undefined;
}

function getArchiveExtensionForFormat(format: string | undefined): string | undefined {
  if (isBlank(format)) {
    return undefined;
  }

  switch (format.toLowerCase()) {
    case "zip":
      return ".zip";
    case "tar.xz":
      return ".tar.xz";
    default:
      throw new Error(`Unsupported primary runtime archive format: ${format}`);
  }
}

function getSupportedArchiveExtension(archiveName: string | undefined): string | undefined {
  if (isBlank(archiveName)) {
    return undefined;
  }

  const lowerName = archiveName.toLowerCase();
  if (lowerName.endsWith(".tar.xz")) {
    return ".tar.xz";
  }
  if (lowerName.endsWith(".zip")) {
    return ".zip";
  }
  return undefined;
}

function resolveArchiveName(manifest: PrimaryRuntimeManifest, defaultBaseName: string): string {
  const formatExtension = getArchiveExtensionForFormat(manifest.format);

  if (!isBlank(manifest.archiveName)) {
    const archiveName = path.basename(manifest.archiveName);
    const archiveExtension = getSupportedArchiveExtension(archiveName);
    if (archiveExtension != null) {
      if (formatExtension != null && archiveExtension !== formatExtension) {
        throw new Error(`Manifest archiveName extension ${archiveExtension} does not match format ${manifest.format}.`);
      }
      return archiveName;
    }
    if (formatExtension != null) {
      return `${archiveName}${formatExtension}`;
    }
    throw new Error(
      `Cannot determine primary runtime archive format for archiveName ${archiveName}; manifest must provide format or a supported archive extension.`,
    );
  }

  const archiveName = getArchiveNameFromUrl(manifest.archiveUrl);
  if (!isBlank(archiveName)) {
    const archiveExtension = getSupportedArchiveExtension(archiveName);
    if (archiveExtension != null) {
      if (formatExtension != null && archiveExtension !== formatExtension) {
        throw new Error(`Manifest archiveUrl extension ${archiveExtension} does not match format ${manifest.format}.`);
      }
      return archiveName;
    }
    if (formatExtension != null) {
      return `${archiveName}${formatExtension}`;
    }
    throw new Error(
      `Cannot determine primary runtime archive format for archiveUrl ${manifest.archiveUrl}; manifest must provide format or a supported archive extension.`,
    );
  }

  if (formatExtension != null) {
    return `${defaultBaseName}${formatExtension}`;
  }

  throw new Error("Cannot determine primary runtime archive name; manifest must provide archiveName, an archiveUrl with a file name, or format.");
}

function run(command: string, args: readonly string[], description: string): void {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error != null) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`Failed to ${description}.`);
  }
}

async function expandInputArchive(archivePath: string, destination: string): Promise<void> {
  await cleanDirectory(destination);
  const extension = getSupportedArchiveExtension(archivePath);
  if (extension == null || (extension !== ".zip" && extension !== ".tar.xz")) {
    const lowerPath = archivePath.toLowerCase();
    if (!lowerPath.endsWith(".tgz") && !lowerPath.endsWith(".tar.gz") && !lowerPath.endsWith(".nupkg")) {
      throw new Error(`Unsupported archive format: ${archivePath}`);
    }
  }
  run("tar", ["-xf", archivePath, "-C", destination], `extract archive ${archivePath}`);
}

async function findReplacementRoot(extractRoot: string, name: string): Promise<string> {
  const candidates = [
    path.join(extractRoot, runtimeRootDirectoryName, "dependencies", name),
    path.join(extractRoot, "dependencies", name),
    path.join(extractRoot, name),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
  }

  const directChild = (await fs.promises.readdir(extractRoot, { withFileTypes: true })).find(
    (entry) => entry.isDirectory() && entry.name === name,
  );
  if (directChild != null) {
    return path.join(extractRoot, directChild.name);
  }

  throw new Error(
    `Could not find '${name}' replacement root in ${extractRoot}. Expected ${name}, dependencies/${name}, or ${runtimeRootDirectoryName}/dependencies/${name}.`,
  );
}

function assertRequiredFile(root: string, relativePath: string): void {
  const filePath = path.join(root, ...relativePath.split("/"));
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error(`Replacement tree is missing required file: ${relativePath}`);
  }
}

function assertRequiredDirectory(root: string, relativePath: string): void {
  const directoryPath = path.join(root, ...relativePath.split("/"));
  if (!fs.existsSync(directoryPath) || !fs.statSync(directoryPath).isDirectory()) {
    throw new Error(`Replacement tree is missing required directory: ${relativePath}`);
  }
}

function assertPythonVersionDll(root: string): void {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  const hasVersionDll = entries.some((entry) => entry.isFile() && /^python\d{2,}\.dll$/i.test(entry.name));
  if (!hasVersionDll) {
    throw new Error("Replacement tree is missing a versioned python DLL such as python312.dll.");
  }
}

function assertCompleteReplacementTree(name: string, replacementRoot: string): void {
  if (name === "node") {
    assertRequiredFile(replacementRoot, "bin/node.exe");
    assertRequiredDirectory(replacementRoot, "node_modules");
    assertRequiredFile(replacementRoot, "node_modules/@oai/artifact-tool/package.json");
    return;
  }

  if (name === "python") {
    assertRequiredFile(replacementRoot, "python.exe");
    assertRequiredFile(replacementRoot, "python3.dll");
    assertPythonVersionDll(replacementRoot);
    assertRequiredDirectory(replacementRoot, "DLLs");
    assertRequiredDirectory(replacementRoot, "Lib/site-packages");
    assertRequiredDirectory(replacementRoot, "Lib/site-packages/artifact_tool_v2");
    return;
  }

  throw new Error(`Unsupported replacement dependency: ${name}`);
}

function archivePathForReplacement(workRoot: string, archiveUrl: string, name: string): string {
  const lowerUrl = archiveUrl.toLowerCase();
  const basePath = path.join(workRoot, `${name}-replacement`);
  if (/\.zip($|\?)/.test(lowerUrl)) {
    return `${basePath}.zip`;
  }
  if (/\.tar\.xz($|\?)/.test(lowerUrl)) {
    return `${basePath}.tar.xz`;
  }
  if (/\.tgz($|\?)/.test(lowerUrl)) {
    return `${basePath}.tgz`;
  }
  if (/\.tar\.gz($|\?)/.test(lowerUrl)) {
    return `${basePath}.tar.gz`;
  }
  if (/\.nupkg($|\?)/.test(lowerUrl)) {
    return `${basePath}.nupkg`;
  }
  return `${basePath}.zip`;
}

async function replaceDependencyDirectory(archiveUrl: string, name: string, payloadRoot: string, workRoot: string): Promise<void> {
  const downloadPath = archivePathForReplacement(workRoot, archiveUrl, name);
  await saveUrlOrFile(archiveUrl, downloadPath);

  const extractPath = path.join(workRoot, `${name}-replacement-extract`);
  await expandInputArchive(downloadPath, extractPath);
  const replacementRoot = await findReplacementRoot(extractPath, name);
  assertCompleteReplacementTree(name, replacementRoot);
  const targetPath = path.join(payloadRoot, runtimeRootDirectoryName, "dependencies", name);

  await fs.promises.rm(targetPath, { recursive: true, force: true });
  await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.promises.cp(replacementRoot, targetPath, { recursive: true });
}

function getPortableExecutableMachine(filePath: string): number | undefined {
  const buffer = fs.readFileSync(filePath);
  if (buffer.length < 64 || buffer.readUInt16LE(0) !== 0x5a4d) {
    return undefined;
  }

  const peOffset = buffer.readInt32LE(0x3c);
  if (peOffset < 0 || peOffset + 6 > buffer.length || buffer.readUInt32LE(peOffset) !== 0x00004550) {
    return undefined;
  }

  return buffer.readUInt16LE(peOffset + 4);
}

function getPortableExecutableMachineName(machine: number | undefined): string | undefined {
  switch (machine) {
    case undefined:
      return undefined;
    case 0xaa64:
      return "arm64";
    case 0x8664:
      return "x64";
    case 0x014c:
      return "x86";
    case 0x01c4:
      return "arm";
    default:
      return `0x${machine.toString(16).toUpperCase().padStart(4, "0")}`;
  }
}

function isPythonLauncherTemplate(relativePath: string): boolean {
  const normalized = relativePath.replaceAll(path.sep, "/");
  return (
    /^dependencies\/python\/Lib\/site-packages\/pip\/_vendor\/distlib\/[tw](32|64|64-arm)\.exe$/i.test(normalized) ||
    /^dependencies\/python\/Lib\/site-packages\/setuptools\/(cli|gui)(-32|-64|-arm64)?\.exe$/i.test(normalized)
  );
}

async function listFilesRecursive(root: string): Promise<string[]> {
  const entries = await fs.promises.readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFilesRecursive(entryPath));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
}

function relativeRuntimePath(runtimeRoot: string, filePath: string): string {
  const relativePath = path.relative(runtimeRoot, filePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`Path is outside runtime root: ${filePath}`);
  }
  return relativePath;
}

async function assertNoX64NativePayload(runtimeRoot: string): Promise<void> {
  const files = await listFilesRecursive(runtimeRoot);
  const x64PathFiles = files
    .filter((filePath) => {
      const normalized = relativeRuntimePath(runtimeRoot, filePath).replaceAll(path.sep, "/");
      const extension = path.extname(filePath).toLowerCase();
      return (
        /win32-x64|x64-msvc|libcrypto-3-x64|libssl-3-x64/i.test(normalized) ||
        ([".exe", ".dll", ".node", ".pyd"].includes(extension) && /x64/i.test(path.basename(filePath)))
      );
    })
    .slice(0, 20);

  if (x64PathFiles.length > 0) {
    throw new Error(`Refusing to publish ARM64 runtime bundle because x64 native payloads remain: ${x64PathFiles.join("; ")}`);
  }

  const wrongMachineFiles: string[] = [];
  for (const filePath of files) {
    if (![".exe", ".dll", ".node", ".pyd"].includes(path.extname(filePath).toLowerCase())) {
      continue;
    }

    const relativePath = relativeRuntimePath(runtimeRoot, filePath);
    if (isPythonLauncherTemplate(relativePath)) {
      continue;
    }

    const machineName = getPortableExecutableMachineName(getPortableExecutableMachine(filePath));
    if (machineName == null) {
      wrongMachineFiles.push(`${relativePath} (not a portable executable)`);
    } else if (machineName !== "arm64") {
      wrongMachineFiles.push(`${relativePath} (${machineName})`);
    }
  }

  if (wrongMachineFiles.length > 0) {
    throw new Error(
      `Refusing to publish ARM64 runtime bundle because non-ARM64 native payloads remain: ${wrongMachineFiles.slice(0, 20).join("; ")}`,
    );
  }
}

async function updateRuntimeJson(runtimeRoot: string, manifest: PrimaryRuntimeManifest): Promise<void> {
  const runtimeJsonPath = path.join(runtimeRoot, "runtime.json");
  const runtimeJson = await readJsonFile<Record<string, unknown>>(runtimeJsonPath);
  runtimeJson.targetPlatform = targetPlatform;
  runtimeJson.targetArch = targetArch;
  if (!isBlank(manifest.bundleVersion)) {
    runtimeJson.bundleVersion = manifest.bundleVersion;
  }
  await writeJsonFile(runtimeJsonPath, runtimeJson);
}

function addManifestValue(manifest: Record<string, unknown>, name: string, value: unknown): void {
  if (value == null) {
    return;
  }
  if (typeof value === "string" && value.trim() === "") {
    return;
  }
  manifest[name] = value;
}

async function newReleaseManifest(
  sourceManifest: PrimaryRuntimeManifest,
  archivePath: string,
  options: BuildOptions,
  format = sourceManifest.format,
): Promise<Record<string, unknown>> {
  const archive = await fs.promises.stat(archivePath);
  const archiveName = path.basename(archivePath);
  const githubReleaseBaseUrl = `https://github.com/${options.repository}/releases/download/${options.releaseTag}`;
  const manifest: Record<string, unknown> = {
    archiveName,
    archiveSha256: await sha256File(archivePath),
    archiveSizeBytes: archive.size,
    archiveUrl: `${githubReleaseBaseUrl}/${archiveName}`,
    latestManifestFileName: manifestFileName,
    latestManifestUrl: `${githubReleaseBaseUrl}/${manifestFileName}`,
    runtimeRootDirectoryName,
    targetArch,
    targetPlatform,
  };

  addManifestValue(manifest, "bundleFormatVersion", sourceManifest.bundleFormatVersion);
  addManifestValue(manifest, "bundleVersion", sourceManifest.bundleVersion);
  addManifestValue(manifest, "format", format);
  addManifestValue(manifest, "generatedDependencies", sourceManifest.generatedDependencies);
  addManifestValue(manifest, "nodeVersion", sourceManifest.nodeVersion);
  addManifestValue(manifest, "pythonVersion", sourceManifest.pythonVersion);
  return manifest;
}

async function publishComposedArm64Bundle(options: BuildOptions, workRoot: string): Promise<void> {
  if (isBlank(options.arm64NodeArchiveUrl) || isBlank(options.arm64PythonArchiveUrl)) {
    throw new Error(`Cannot compose a Windows ARM64 primary runtime from the public OAI x64 bundle without complete ARM64 replacements.

Set PRIMARY_RUNTIME_ARM64_NODE_ARCHIVE_URL and PRIMARY_RUNTIME_ARM64_PYTHON_ARCHIVE_URL to archives containing complete dependencies/node and dependencies/python trees.`);
  }

  const sourceManifestPath = path.join(workRoot, "source-LATEST.json");
  await saveUrlOrFile(publicWindowsX64ManifestUrl, sourceManifestPath);
  const sourceManifest = await readJsonFile<PrimaryRuntimeManifest>(sourceManifestPath);

  if (sourceManifest.targetPlatform !== targetPlatform || sourceManifest.targetArch !== "x64") {
    throw new Error(
      `Source manifest target mismatch. Expected ${targetPlatform}-x64, got ${sourceManifest.targetPlatform}-${sourceManifest.targetArch}.`,
    );
  }

  const sourceArchiveName = resolveArchiveName(sourceManifest, "source-primary-runtime");
  const sourceArchivePath = path.join(workRoot, sourceArchiveName);
  await saveUrlOrFile(sourceManifest.archiveUrl, sourceArchivePath);

  const sourceHash = await sha256File(sourceArchivePath);
  if (!isBlank(sourceManifest.archiveSha256) && sourceHash !== sourceManifest.archiveSha256.toLowerCase()) {
    throw new Error(`Source archive hash mismatch. Expected ${sourceManifest.archiveSha256}, got ${sourceHash}.`);
  }

  const payloadRoot = path.join(workRoot, "payload");
  await expandInputArchive(sourceArchivePath, payloadRoot);
  await replaceDependencyDirectory(options.arm64NodeArchiveUrl, "node", payloadRoot, workRoot);
  await replaceDependencyDirectory(options.arm64PythonArchiveUrl, "python", payloadRoot, workRoot);

  const runtimeRoot = path.join(payloadRoot, runtimeRootDirectoryName);
  await updateRuntimeJson(runtimeRoot, sourceManifest);
  await assertNoX64NativePayload(runtimeRoot);

  const archivePath = path.join(options.outputRoot, `codex-primary-runtime-win32-arm64-${sourceManifest.bundleVersion}.tar.xz`);
  await fs.promises.rm(archivePath, { force: true });
  run("tar", ["-c", "-J", "-f", archivePath, "-C", payloadRoot, runtimeRootDirectoryName], `create ${archivePath}`);

  const releaseManifest = await newReleaseManifest(sourceManifest, archivePath, options, "tar.xz");
  await writeJsonFile(path.join(options.outputRoot, manifestFileName), releaseManifest);
}

async function main(): Promise<void> {
  const options = readOptions(process.argv.slice(2));
  const workRoot = path.join(options.outputRoot, "work");
  await cleanDirectory(options.outputRoot);
  await cleanDirectory(workRoot);

  try {
    await publishComposedArm64Bundle(options, workRoot);
  } finally {
    await fs.promises.rm(workRoot, { recursive: true, force: true });
  }

  for (const entry of await fs.promises.readdir(options.outputRoot, { withFileTypes: true })) {
    if (!entry.isFile()) {
      continue;
    }
    const filePath = path.join(options.outputRoot, entry.name);
    const stat = await fs.promises.stat(filePath);
    console.log(`${filePath}\t${stat.size}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
