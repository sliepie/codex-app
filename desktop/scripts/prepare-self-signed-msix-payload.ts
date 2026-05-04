import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

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

function crc32(buffer: Buffer): number {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);

  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function writeSolidPng(outputPath: string, size: number, rgb: [number, number, number]): void {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 2;

  const row = Buffer.alloc(1 + size * 3);
  for (let index = 1; index < row.length; index += 3) {
    row[index] = rgb[0];
    row[index + 1] = rgb[1];
    row[index + 2] = rgb[2];
  }

  const pixels = Buffer.concat(Array.from({ length: size }, () => row));
  fs.writeFileSync(
    outputPath,
    Buffer.concat([
      signature,
      pngChunk("IHDR", header),
      pngChunk("IDAT", zlib.deflateSync(pixels)),
      pngChunk("IEND", Buffer.alloc(0)),
    ]),
  );
}

const options = parseOptions(process.argv.slice(2));
const entryPoint = path.join(options.packageRoot, "Codex.exe");
if (!fs.existsSync(entryPoint)) {
  throw new Error(`Electron Forge did not produce the expected Windows entrypoint: ${entryPoint}`);
}

const appRoot = path.join(options.outputRoot, "app");
copyDirectory(options.packageRoot, appRoot);

const assetsRoot = path.join(options.outputRoot, "assets");
fs.mkdirSync(assetsRoot, { recursive: true });
writeSolidPng(path.join(assetsRoot, "icon.png"), 50, [0x31, 0x43, 0xff]);
writeSolidPng(path.join(assetsRoot, "Square44x44Logo.png"), 44, [0x31, 0x43, 0xff]);
writeSolidPng(path.join(assetsRoot, "Square150x150Logo.png"), 150, [0x31, 0x43, 0xff]);

fs.writeFileSync(
  path.join(options.outputRoot, "AppxManifest.xml"),
  `<?xml version="1.0" encoding="utf-8"?>
<Package xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10" xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10" xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities" xmlns:mp="http://schemas.microsoft.com/appx/2014/phone/manifest" IgnorableNamespaces="uap rescap">
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
      <uap:VisualElements DisplayName="Codex" Description="Codex" Square44x44Logo="assets\\Square44x44Logo.png" Square150x150Logo="assets\\Square150x150Logo.png" BackgroundColor="#3143FF" />
    </Application>
  </Applications>
  <mp:PhoneIdentity PhoneProductId="53bf120e-f20a-474e-892d-d87c803a0e39" PhonePublisherId="7d1e4745-d434-4fde-a9ef-c9c97f199413" />
</Package>
`,
  "utf8",
);

console.log(`Prepared self-signed MSIX payload at ${options.outputRoot}`);
