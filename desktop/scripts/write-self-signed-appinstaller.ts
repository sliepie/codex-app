import fs from "node:fs";
import path from "node:path";

type Options = {
  packageName: string;
  publisher: string;
  version: string;
  architecture: string;
  packageUri: string;
  appInstallerUri: string;
  outputPath: string;
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

function requireOption(argv: string[], name: string, envName?: string): string {
  const value = readOption(argv, name) ?? (envName ? process.env[envName] : undefined);
  if (!value) {
    throw new Error(`Missing required option: ${name}`);
  }
  return value;
}

function parseOptions(argv: string[]): Options {
  return {
    packageName: requireOption(argv, "--package-name", "PACKAGE_NAME"),
    publisher: requireOption(argv, "--publisher", "PACKAGE_PUBLISHER"),
    version: requireOption(argv, "--version", "PACKAGE_VERSION"),
    architecture: requireOption(argv, "--architecture"),
    packageUri: requireOption(argv, "--package-uri", "PACKAGE_URI"),
    appInstallerUri: requireOption(argv, "--appinstaller-uri", "APPINSTALLER_URI"),
    outputPath: path.resolve(requireOption(argv, "--output")),
  };
}

function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

const options = parseOptions(process.argv.slice(2));
if (!/^\d+\.\d+\.\d+\.\d+$/.test(options.version)) {
  throw new Error(`Version '${options.version}' must be a four-part MSIX version, for example 26.429.20946.0.`);
}

new URL(options.packageUri);
new URL(options.appInstallerUri);
fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
fs.writeFileSync(
  options.outputPath,
  `<?xml version="1.0" encoding="utf-8"?>
<AppInstaller
  xmlns="http://schemas.microsoft.com/appx/appinstaller/2021"
  Version="${xmlEscape(options.version)}"
  Uri="${xmlEscape(options.appInstallerUri)}">
  <MainPackage
    Name="${xmlEscape(options.packageName)}"
    Publisher="${xmlEscape(options.publisher)}"
    Version="${xmlEscape(options.version)}"
    ProcessorArchitecture="${xmlEscape(options.architecture)}"
    Uri="${xmlEscape(options.packageUri)}" />
  <UpdateSettings>
    <OnLaunch HoursBetweenUpdateChecks="0" ShowPrompt="true" UpdateBlocksActivation="false" />
    <AutomaticBackgroundTask />
  </UpdateSettings>
</AppInstaller>
`,
  "utf8",
);
console.log(`Wrote ${options.outputPath}`);
