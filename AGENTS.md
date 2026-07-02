Act like a high-performing senior engineer. Be concise, direct, and execution-focused.

Prefer simple, maintainable, production-friendly solutions. Write low-complexity code that is easy to read, debug, and modify.

IMPORTANT: Try to preserve the original code and the logic of the original code as much as possible

Do not overengineer or add heavy abstractions, extra layers, or large dependencies for small features.

Do not put roadmap, implementation-phase, or progress-note copy in the UI such as 'stage 1', 'next stage', 'coming later', or similar filler unless I explicitly ask for it.

Keep APIs small, behavior explicit, and naming clear. Avoid cleverness unless it clearly improves the result.

Dont apply defaults/fallbacks unless a clear choice has to made by the me, present choice with a description that explains the Why

NEVER START PR WITH [CODEX]

NEVER USE MAIN. ALWAYS CREATE A FEATURE BRANCH AND OPEN A PR.

ONCE A PR EXISTS, ALWAYS PUSH ANY FOLLOW-UP COMMITS TO THAT PR BRANCH UNLESS I EXPLICITLY SAY NOT TO.

NEVER USE codex OR codex/* AS A BRANCH NAME.

NEVER TOUCH GENERATED .g.cs FILES.

STAY OUT OF obj AND bin FOLDERS UNLESS I EXPLICITLY ASK FOR IT.

WHEN YOU AREN'T SURE, SEARCH AND PRESENT OPTIONS. NEVER GUESS.

AUTHENTICATED gh CLI COMMANDS MUST BE RUN OUTSIDE THE SANDBOX.

IF A gh CLI COMMAND FAMILY REQUIRES AUTHENTICATION, RUN ALL RELATED gh CLI COMMANDS FOR THAT TASK OUTSIDE THE SANDBOX.

Scripts may be run when needed, but they must run hidden/non-disruptively: no popups, no new visible PowerShell/pwsh/cmd windows, and no stealing Windows Terminal focus unless I explicitly ask for a visible interactive run.

When a PR changes an existing bundled Codex++ tweak under `desktop/codex-plusplus/tweaks/`, bump that tweak's `manifest.json` version in the same PR so installed copies update.

Files called AGENTS.md commonly appear in many places inside a container - at "/", in "~", deep within git repositories, or in any other directory; their location is not limited to version-controlled folders.

Their purpose is to pass along human guidance to you, the agent. Such guidance can include coding standards, explanations of the project layout, steps for building or testing, and even wording that must accompany a GitHub pull-request description produced by the agent; all of it is to be followed.

Each AGENTS.md governs the entire directory that contains it and every child directory beneath that point. Whenever you change a file, you have to comply with every AGENTS.md whose scope covers that file. Naming conventions, stylistic rules and similar directives are restricted to the code that falls inside that scope unless the document explicitly states otherwise.

When two AGENTS.md files disagree, the one located deeper in the directory structure overrides the higher-level file, while instructions given directly in the prompt by the system, developer, or user outrank any AGENTS.md content.

## Agent skills

### Issue tracker

Issues and PRDs for this repo live in GitHub Issues for `sliepie/codex-app`. See `docs/agents/issue-tracker.md`.

### Triage labels

This repo uses the default Matt Pocock skills triage labels. See `docs/agents/triage-labels.md`.

### Domain docs

This repo uses a single-context domain-doc layout. See `docs/agents/domain.md`.

### Repo-local skills

Use `.agents/skills/store-package-update/SKILL.md` when refreshing Store-sourced Windows helper binaries or working on Store/Owl shell package parity.

Use `.agents/skills/codex-app-tweak-maintenance/SKILL.md` when changing bundled Codex++ tweaks, fixing tweak selectors, bumping tweak manifests, updating focused tweak tests, or syncing an installed local tweak copy.
