# Agent Tooling Cleanup

Remove agent tooling that no longer helps, and turn the parts worth keeping into skills. No app code changes, so this happens on `main`.

AGENTS.md only gets the edits needed to stop it being wrong. The full rewrite happens in task 4, once the toolchain has changed.

## Context

- AGENTS.md describes six specialised agents, but only two exist (`macos-ui-engineer`, `tauri-v2-expert`). Both are generic persona prompts that current models plus Context7 cover.
- `.claude/commands/` holds four commands:
  - `check` is three instructions.
  - `deps-update` is a real multi-session workflow and worth keeping.
  - `knip-cleanup` and `review-duplicates` overlap in purpose. knip has also been misconfigured since the pnpm workspace setup; task 2 fixes that.
- `docs/tasks.md` and `scripts/complete-task.js` duplicate the task conventions in the global CLAUDE.md.
- The sandbox blocks agent writes to `.claude/skills/`, so Danny needs to approve or make those writes.

## Steps

### 1. Agents

- [ ] Check `macos-ui-engineer.md` for project-specific guidance that isn't already in `docs/developer/ui-patterns.md`, e.g. the `[&_svg]:transform-gpu [&_svg]:scale-100` icon button fix and the native-feel principles (keyboard-first, subtle motion, vibrancy). Move anything missing into `ui-patterns.md`
- [ ] Delete `.claude/agents/`

### 2. Commands → skills

- [ ] `deps-update` → `.claude/skills/deps-update/SKILL.md`. Rewrite it shorter: keep the workflow (task doc as state, research → main app → fixtures → telemetry worker → finalise, per-step commits, merge commit, holds table) and drop the step-by-step shell detail a current model doesn't need. Write it package-manager-neutral or for bun, since task 2 changes that
- [ ] `knip-cleanup` + `review-duplicates` → one `.claude/skills/codebase-hygiene/SKILL.md`. Keep the judgement rules (never remove exports called from Rust/Tauri, every removal or refactor is user-approved, judge whether duplication is intentional) and drop the rest
- [ ] Delete `check`. Its content becomes a line in AGENTS.md: before finishing significant work, check against the architecture guide, remove leftover debug code and failed approaches, and run `check:all`
- [ ] Delete `.claude/commands/`

### 3. Task management

- [ ] Delete `docs/tasks.md`, `scripts/complete-task.js`, and the `task:complete` / `task:rename-done` scripts in `package.json`
- [ ] Replace the AGENTS.md "Task Management" section and the `@docs/TASKS.md` reference with one line pointing at `docs/tasks-todo/` and the global naming convention
- [ ] Update the "Task Management" section of `docs/README.md`

### 4. AGENTS.md (minimal)

- [ ] Remove the "Specialized Agents" section
- [ ] Replace "Custom Commands" with a short list of the skills
- [ ] Leave everything else for task 4

### 5. Small leftovers

- [ ] `.vscode/extensions.json`: drop `ms-vscode.vscode-typescript-tslint-plugin` (dead) and the duplicate Tailwind entry. Task 2 swaps the ESLint/Prettier extensions for oxc
- [ ] Remove the empty `.playwright-mcp/` directory
- [ ] Serena: decide whether to turn the MCP server off; that's user config, outside the repo. If it goes, also drop the `.serena/` cache, its `.gitignore` entry and the `mcp__serena__*` permissions in `.claude/settings.local.json`
- [ ] `.coderabbit.yml` stays

## Done when

No references to non-existent agents or commands remain, the skills are listed in AGENTS.md, and `docs/README.md` doesn't mention `tasks.md`.
