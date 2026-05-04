import fs from "node:fs";
import path from "node:path";

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

const outputPath = readOption(process.argv.slice(2), "--output");
if (!outputPath) {
  throw new Error("Missing required option: --output");
}

const pfxBase64 = process.env.SELF_SIGNED_PFX_BASE64;
if (!pfxBase64?.trim()) {
  throw new Error("Missing required secret: SELF_SIGNED_PFX_BASE64");
}

if (!process.env.SELF_SIGNED_PFX_PASSWORD?.trim()) {
  throw new Error("Missing required secret: SELF_SIGNED_PFX_PASSWORD");
}

const resolvedOutputPath = path.resolve(outputPath);
fs.mkdirSync(path.dirname(resolvedOutputPath), { recursive: true });
fs.writeFileSync(resolvedOutputPath, Buffer.from(pfxBase64.replace(/\s/g, ""), "base64"));
console.log(`Wrote ${resolvedOutputPath}`);
