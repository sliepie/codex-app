import fs from "node:fs";
import path from "node:path";
import { parseDocument } from "yaml";

type SkillFrontmatter = {
  description?: unknown;
  name?: unknown;
};

export type VerifySkillsOptions = {
  repoRoot?: string;
};

export type VerifySkillsResult = {
  checked: string[];
};

const frontmatterDelimiter = "---";

function toRepoPath(repoRoot: string, filePath: string): string {
  return path.relative(repoRoot, filePath).replaceAll(path.sep, "/");
}

function listSkillFiles(skillsRoot: string): string[] {
  if (!fs.existsSync(skillsRoot)) {
    return [];
  }

  const results: string[] = [];

  function walk(currentPath: string): void {
    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath);
        continue;
      }

      if (entry.name === "SKILL.md") {
        results.push(entryPath);
      }
    }
  }

  walk(skillsRoot);
  return results.sort((left, right) => left.localeCompare(right));
}

function readFrontmatter(source: string, fileLabel: string): string {
  const normalized = source.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  if (!normalized.startsWith(`${frontmatterDelimiter}\n`)) {
    throw new Error(`${fileLabel}: missing YAML frontmatter delimiter.`);
  }

  const endIndex = normalized.indexOf(`\n${frontmatterDelimiter}\n`, frontmatterDelimiter.length + 1);
  if (endIndex < 0) {
    throw new Error(`${fileLabel}: missing closing YAML frontmatter delimiter.`);
  }

  return normalized.slice(frontmatterDelimiter.length + 1, endIndex);
}

function assertNonEmptyString(value: unknown, fieldName: string, fileLabel: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fileLabel}: frontmatter ${fieldName} must be a non-empty string.`);
  }

  return value;
}

function assertSingleLineScalar(frontmatter: string, fieldName: string, fileLabel: string): void {
  const lines = frontmatter.split("\n");
  const fieldLineIndex = lines.findIndex((line) => new RegExp(`^${fieldName}:\\s*`).test(line));
  if (fieldLineIndex < 0) {
    throw new Error(`${fileLabel}: missing frontmatter ${fieldName} field.`);
  }

  const match = lines[fieldLineIndex].match(new RegExp(`^${fieldName}:\\s*(.*)$`));
  if (!match) {
    throw new Error(`${fileLabel}: missing frontmatter ${fieldName} field.`);
  }

  const value = match[1].trim();
  if (!value) {
    throw new Error(`${fileLabel}: frontmatter ${fieldName} must be set on the same line.`);
  }

  if (value.startsWith(">") || value.startsWith("|")) {
    throw new Error(`${fileLabel}: frontmatter ${fieldName} must be a single-line scalar, not a block scalar.`);
  }

  const nextLine = lines[fieldLineIndex + 1];
  if (nextLine !== undefined && /^[ \t]/.test(nextLine)) {
    throw new Error(`${fileLabel}: frontmatter ${fieldName} must be a single-line scalar without continuation lines.`);
  }
}

function verifySkillFile(repoRoot: string, filePath: string): string {
  const fileLabel = toRepoPath(repoRoot, filePath);
  const frontmatter = readFrontmatter(fs.readFileSync(filePath, "utf8"), fileLabel);
  assertSingleLineScalar(frontmatter, "name", fileLabel);
  assertSingleLineScalar(frontmatter, "description", fileLabel);

  const document = parseDocument(frontmatter, { prettyErrors: true });
  if (document.errors.length > 0) {
    throw new Error(
      [`${fileLabel}: invalid YAML frontmatter.`, ...document.errors.map((error) => error.message)].join("\n"),
    );
  }

  const parsed = document.toJSON() as SkillFrontmatter;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${fileLabel}: YAML frontmatter must be a mapping.`);
  }

  assertNonEmptyString(parsed.name, "name", fileLabel);
  assertNonEmptyString(parsed.description, "description", fileLabel);
  return fileLabel;
}

export function verifySkills({
  repoRoot = path.resolve(process.cwd(), ".."),
}: VerifySkillsOptions = {}): VerifySkillsResult {
  const skillFiles = listSkillFiles(path.join(repoRoot, ".agents", "skills"));
  if (skillFiles.length === 0) {
    throw new Error("No repo-local skills found under .agents/skills.");
  }

  return {
    checked: skillFiles.map((filePath) => verifySkillFile(repoRoot, filePath)),
  };
}

function main(): void {
  const result = verifySkills();
  console.log(`Verified ${result.checked.length} skill file(s): ${result.checked.join(", ")}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error: unknown) {
    console.error(error);
    process.exitCode = 1;
  }
}
