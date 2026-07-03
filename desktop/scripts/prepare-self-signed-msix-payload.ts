import fs from "node:fs";
import path from "node:path";
import { stageStoreOwlMsixRoot, stageStoreOwlShellAppRoot } from "./stage-store-owl-shell.js";

type Options = {
  packageRoot: string;
  outputRoot: string;
};

function readOption(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }

  const value = argv[index + 1];
  if (!value || value.startsWith("-")) {
    throw new Error(`Missing value for ${name}`);
  }
  return value;
}

function parseOptions(argv: string[]): Options {
  const packageRoot = readOption(argv, "--package-root");
  const outputRoot = readOption(argv, "--output-root");
  if (!packageRoot) {
    throw new Error("Missing required option: --package-root");
  }
  if (!outputRoot) {
    throw new Error("Missing required option: --output-root");
  }

  return {
    packageRoot: path.resolve(packageRoot),
    outputRoot: path.resolve(outputRoot),
  };
}

function copyDirectory(source: string, destination: string): void {
  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(destination, { recursive: true });
  fs.cpSync(source, destination, { recursive: true });
}

// Avoid AppX hard-linking this shared Chromium file to unrelated packages.
function rewriteSwiftShaderIcdMetadata(appRoot: string): void {
  const icdPath = path.join(appRoot, "vk_swiftshader_icd.json");
  if (!fs.existsSync(icdPath)) {
    return;
  }

  const swiftShaderIcd = JSON.parse(fs.readFileSync(icdPath, "utf8"));
  fs.writeFileSync(icdPath, `${JSON.stringify(swiftShaderIcd, null, 2)}\n`, "utf8");
}

const options = parseOptions(process.argv.slice(2));
const entryPoint = path.join(options.packageRoot, "Codex.exe");
if (!fs.existsSync(entryPoint)) {
  throw new Error(`Electron Forge did not produce the expected Windows entrypoint: ${entryPoint}`);
}

stageStoreOwlShellAppRoot(options.packageRoot);
stageStoreOwlMsixRoot(options.outputRoot);

const appRoot = path.join(options.outputRoot, "app");
copyDirectory(options.packageRoot, appRoot);
rewriteSwiftShaderIcdMetadata(appRoot);

fs.writeFileSync(
  path.join(options.outputRoot, "AppxManifest.xml"),
  `<?xml version="1.0" encoding="utf-8"?>
<Package xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10" xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10" xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities" IgnorableNamespaces="uap rescap">
  <Identity Name="OpenAI.Codex" ProcessorArchitecture="arm64" Version="0.0.0.0" Publisher="CN=Codex" />
  <Properties>
    <DisplayName>Codex</DisplayName>
    <PublisherDisplayName>OpenAI</PublisherDisplayName>
    <Logo>assets\\icon.png</Logo>
  </Properties>
  <Dependencies>
    <TargetDeviceFamily Name="Windows.Desktop" MinVersion="10.0.19041.0" MaxVersionTested="10.0.19041.0" />
  </Dependencies>
  <Resources>
    <Resource Language="en-US" />
  </Resources>
  <Capabilities>
    <rescap:Capability Name="runFullTrust" />
    <Capability Name="internetClient" />
  </Capabilities>
  <Applications>
    <Application Id="App" Executable="app\\Codex.exe" EntryPoint="Windows.FullTrustApplication">
      <uap:VisualElements DisplayName="Codex" Description="Codex" Square44x44Logo="assets\\Square44x44Logo.png" Square150x150Logo="assets\\Square150x150Logo.png" BackgroundColor="transparent" />
    </Application>
  </Applications>
</Package>
`,
  "utf8",
);

console.log(`Prepared self-signed MSIX payload at ${options.outputRoot}`);
