---
name: codebase-hygiene
description: Find unused code and dependencies (knip) and duplicated code (jscpd), then review the findings with the user and clean up what they approve. Use when the user asks to clean up dead code, unused dependencies or exports, or to review duplication.
---

# Codebase Hygiene

Two tools, run together or separately depending on the request:

- **knip** (`knip` script): unused files, dependencies and exports
- **jscpd** (`jscpd` script): duplicated code in `src/` and `src-tauri/src/`. It writes `jscpd-report/jscpd-report.json`, which is gitignored; delete it afterwards

Both produce false positives. Treat their output as leads to investigate, not a list of things to delete. **Nothing is removed or refactored without the user's approval**, except dependencies with zero usage anywhere.

## knip: what not to remove

- **Code reached from Rust**: toast and event handlers wired up in `src/lib/rust-toast-bridge.ts`, listeners for Tauri events, anything named in `src-tauri/` `emit(…)` calls. Grep `src-tauri/src` for the name before calling something unused
- **`@tauri-apps/*` packages**: each JS plugin pairs with a Rust crate. Remove a plugin from both sides or neither, and check `src-tauri/capabilities/`
- **Barrel files** (`index.ts`, e.g. `src/lib/editor/index.ts`): they export their directory's public API on purpose
- **Unused shadcn components in `src/components/ui/`**: ask the user. They're cheap to re-add through the shadcn CLI, so removing them is fine once confirmed

If knip reports live code as unused (for example editor modes or `compromise`), the config is wrong. Fix `knip.json` before trusting anything else it says.

## jscpd: judging duplication

Duplication is only worth removing when one copy changing without the other would be a bug.

- **Usually extract**: business logic or data transformation over ~15 lines, anything in 3+ places, and duplicated logic in `src/lib/` or Rust command handlers
- **Usually keep**: short patterns, React lifecycle and component boilerplate, test setup, Rust error-handling idioms, deliberately parallel code (e.g. the copyedit-mode highlighters), and type definitions kept separate for decoupling

Put extracted code where the architecture guide says: pure logic in `src/lib/`, hooks in `src/hooks/`, shared Rust helpers next to their callers or in `src-tauri/src/utils/`.

## Process

1. Run the tool(s) and read the surrounding code for every finding. Don't judge from the report alone
2. Present the findings grouped by confidence: what you'd remove or extract and why, what's probably intentional, and what you can't tell
3. Make only the changes the user approves. For duplication they decide to keep, add a short comment explaining why, if the reason isn't obvious
4. Run `check:all`
