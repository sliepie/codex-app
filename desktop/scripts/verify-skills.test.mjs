import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.dirname(scriptsRoot);
const require = createRequire(import.meta.url);
const { verifySkills } = require(path.join(desktopRoot, ".cache", "scripts", "verify-skills.js"));

function withSkillRepo(skillSource, callback) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-skill-"));
  const skillRoot = path.join(repoRoot, ".agents", "skills", "example");
  fs.mkdirSync(skillRoot, { recursive: true });
  fs.writeFileSync(path.join(skillRoot, "SKILL.md"), skillSource, "utf8");

  try {
    callback(repoRoot);
  } finally {
    fs.rmSync(repoRoot, { force: true, recursive: true });
  }
}

test("skill verifier accepts single-line metadata scalars", () => {
  withSkillRepo(
    [
      "---",
      "name: example",
      'description: "Example skill description."',
      "---",
      "",
      "# Example",
      "",
    ].join("\n"),
    (repoRoot) => {
      assert.deepEqual(verifySkills({ repoRoot }).checked, [".agents/skills/example/SKILL.md"]);
    },
  );
});

test("skill verifier rejects multiline quoted metadata scalars", () => {
  withSkillRepo(
    [
      "---",
      "name: example",
      'description: "first',
      '  second"',
      "---",
      "",
      "# Example",
      "",
    ].join("\n"),
    (repoRoot) => {
      assert.throws(
        () => verifySkills({ repoRoot }),
        /frontmatter description must be a single-line scalar without continuation lines/,
      );
    },
  );
});
