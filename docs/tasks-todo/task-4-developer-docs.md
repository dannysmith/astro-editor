# Developer Docs and AGENTS.md

Rework AGENTS.md and `docs/developer/` around one question: what does someone coming into this project, human or agent, need to know that the code can't tell them? That means the why, the principles, and the non-obvious constraints and gotchas. Anything that only describes what the code visibly does can go. That knowledge isn't lost: the code itself, short comments next to it, or git history cover it.

This comes after the toolchain, Base UI and colour token work (all in `docs/tasks-done/`), so the docs describe the final toolchain, component library and colour system, and get rewritten once. It also includes a few small code changes found during the inventory (comments, the log limit, test locations, logging imports), so it goes up as a PR with one commit per change.

## Already done in the colour token work

These were written or updated around the why in October 2026, so they need checking for fit, not rewriting:

- **`color-system.md`:** rewritten. It covers the single token block in `App.css`, `light-dark()` and oklch, how the theme is applied, the rules and gotchas, shadcn components, and adding a token.
- **`cross-platform.md`:** gained "Webview Versions", which explains why the app needs macOS 12.
- **`ast-grep-linting.md`:** documents why `src/` is parsed as tsx, and the `no-palette-colours` rule.
- **`editor-styles.md`:** Danny's hand-compiled editor spec, including values the code doesn't use yet. Keep it as it is; it now points at the tokens in `App.css`.

## Principles

- Keep the reasoning behind every hard-won pattern, even when the doc around it is cut. Examples:
  - why the Direct Store Pattern exists (React Hook Form + Zustand infinite loops);
  - why we never destructure from stores, and why we use `getState()`;
  - why there must be a single `@lezer/common`;
  - CSS visibility over conditional rendering;
  - the WebKit quirks;
  - the auto-save data-loss fixes;
  - the schema parsing edge cases;
  - why every colour is a token and palette classes are banned, and the `light-dark()` gotchas (no `@property`, `.dark` overrides placed after the `:root` rule);
  - why ast-grep parses `src/` as tsx (the typescript grammar can't read JSX, which hid rule violations);
  - why text selection outside the editor is left to the system.
- Prefer a short comment next to the code over a doc section when the knowledge is about one module.
- Don't spend effort polishing the preferences or state docs. #82 will rework the settings and project model, so capture the reasoning and leave the details.
- AGENTS.md is the entry point. It states the non-negotiable rules with a one-line reason each, and points to the docs for depth. It doesn't repeat them.

## Steps

### 1. Inventory

- [x] Read AGENTS.md, `docs/README.md` and every file in `docs/developer/`. Write `docs/tasks-todo/temporary/docs-inventory.md` listing each piece of knowledge that isn't obvious from the code: the rule or fact, why it matters, and where it lives now
- [x] Flag anything stale along the way: versions, removed tools, ESLint/Prettier/pnpm references, Radix-specific guidance, the line-count targets in `docs/README.md`, and the docs index in AGENTS.md
- [x] Danny reviews the inventory before anything is cut

### 2. Decide per doc

- [x] For each doc, decide whether to keep and rewrite around the why, merge into another doc, move its knowledge into code comments, or delete. Recorded in the inventory's "Decisions" section: 24 docs become 14, including a new `commands-and-shortcuts.md` and `preferences-system.md` renamed to `app-data.md`
- [x] Decide on `docs/archive/`: keep only `initial-requirement-notes.md`

### 3. Rewrite

- [ ] AGENTS.md: what the project is (product principles from the website's `getting-started/philosophy.mdx`), the non-negotiable rules with reasons, where things live, the commands, the skills, and pointers to the docs. The rules include "colours only through tokens in `App.css`", which the colour work added and AGENTS.md doesn't mention yet
- [ ] `docs/developer/`: rewrite according to the decisions
- [ ] Code comments for module-specific knowledge (inventory §7 and the form behaviours), evergreen
- [ ] Update the doc links in the ast-grep rules and `App.css` (inventory §8)
- [ ] Light cleanup of the app-control skill's overlap with `agent-tooling.md`; the skill must still stand on its own
- [ ] Trim `docs/archive/` to `initial-requirement-notes.md`

### Code changes found during the inventory

Each its own commit.

- [ ] Release log limit: release builds keep the plugin's default 40 KB with `KeepOne`, which deletes the file. Give it a sensible size and rotation that keeps something
- [ ] Logging imports: find out why 12 files import `@tauri-apps/plugin-log` directly while 2 use `safeLog`, pick the better rule, change the code if it's clearly better, and document the rule with its reason
- [ ] Test layout: move the four unit tests in `__tests__/` (`focus-mode`, `sentence-detection`, `addCursorsToLineEnds`, `updateStore`) next to their source; `__tests__/` keeps only integration tests
- [ ] CSP: add `https:` to `img-src` in `tauri.conf.json` so remote image previews load (Danny checks in a build)
- [ ] Recovery toast: show the "Recovery data has been saved" message only after `saveRecoveryData` succeeds (`useEditorActions.ts`)
- [ ] ast-grep: add `useContentLinkerStore` and `useUpdateStore` to `zustand/no-destructure` and `no-store-subscription-in-lib`; make `hooks-in-hooks-dir` catch `export const useX = () =>` too, with an explicit exception for `lib/theme-provider.tsx`
- [ ] Dead code: remove `useSaveFileMutation` (and its test mock), `exportMenuCommands`/`cleanupMenuCommands`' `globalThis.editorCommands`, the unused `CommandOptions` type, and the `test:ui` script (`@vitest/ui` isn't installed). Check with knip first

The larger findings (schema parsing gaps with Zod 4, project settings bugs, React Compiler bailouts, double-bound shortcuts) are in #347.
- [ ] `docs/README.md`: a short index and a statement of what belongs in developer docs
- [ ] `README.md` and `docs/CONTRIBUTING.md`: check the setup instructions are current
- [ ] Out of scope: `website/AGENTS.md`

### 4. Check it cold

- [ ] A fresh agent that hasn't seen the old docs reads only the new AGENTS.md and docs, and answers questions drawn from the inventory, e.g.:
  - why can't frontmatter fields use React Hook Form?
  - what breaks if two `@lezer/common` versions get installed?
  - how does auto-save avoid data loss?
  - how are nullable Zod types parsed?
  - where do I change a colour, and how do I make it different in dark mode?

  Anything it gets wrong or can't find is a gap to fix.
- [ ] Delete `docs/tasks-todo/temporary/docs-inventory.md`
