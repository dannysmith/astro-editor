# Astro Editor: instructions for AI agents

## Current status

@CLAUDE.local.md

## The project

Astro Editor is a native macOS markdown editor for Astro content collections, built with Tauri v2 (Rust) and React. It reads a project's collections and schemas and gives writers a calm, iA Writer-style place to write, with frontmatter edited in a form generated from the schema. Windows and Linux builds exist but aren't officially supported.

Product principles (from `website/src/content/docs/getting-started/philosophy.mdx`), which decide what gets built:

- **It's an interface for content files on disk,** like a terminal or VS Code is. It reads and writes the same files.
- **Writer mode only.** Every feature has to make writing and editing easier. Coder-mode work (syntax-highlighted code blocks, committing, publishing, deploying, previewing the site) is out of scope.
- **Simplicity.** The UI is opinionated; settings exist only to make it work with a project's structure, not to customise its look. It's meant to become finished software.
- **Native, instant, and it never loses work.** Auto-save and data safety come before features (see `docs/developer/editor.md`).

`website/` is a separate project (the docs and marketing site) with its own `website/AGENTS.md`. It's not part of the app's dependency tree.

## Working here

These are for AI agents working with Danny.

- **Start of a session:** check `docs/tasks-todo/` for the current task, and `git status`. Read `docs/developer/architecture-guide.md` before changing anything structural, and the area doc for what you're touching.
- **Never start a dev server.** Danny keeps `bun run tauri:dev` running. To see the app, use `bun run app` (the `app-control` skill). If it isn't running, ask.
- **Commit only when asked.** Delete files with `rm -f` (`rm` is interactive in Danny's shell).
- **Before finishing significant work:** check it against the architecture guide, remove debug code and leftovers from abandoned approaches, run `bun run check:all` and fix everything it reports.
- **Use current docs.** Context7 first, then the web. Tauri **v2** only (v1 APIs differ and models default to them). Versions: React 19, TypeScript 7, Zustand 5, TanStack Query 5, Tailwind 4, shadcn 4 on Base UI, CodeMirror 6, Vite 8, Vitest 5.
- **Rust:** modern formatting, `format!("{variable}")`. Clippy runs with `-D warnings` on all targets, tests included.
- **Keep docs current.** When a change adds a pattern or invalidates one, update the doc in `docs/developer/`. Docs hold what the code can't say (reasons, constraints, gotchas); knowledge about one module goes in a comment next to it.

## Rules

Breaking any of these causes bugs or wasted work. The reasons are in the architecture guide or the area doc a rule names. Rules tagged *(ast-grep)* or *(Oxlint)* fail `check:all`.

- **Never destructure a Zustand store** (`const { a } = useStore()`). Select each value: `useStore(s => s.a)`. Destructuring subscribes to the whole store, which caused 15+ re-renders per keystroke. Use `useShallow` when a selector builds an object or array. *(ast-grep)*
- **Use `getState()` in callbacks, effects and async code** to read store state without subscribing, so callbacks stay stable and never go stale.
- **No React Hook Form.** Frontmatter fields read and write the store directly (the Direct Store Pattern). Hook Form and Zustand together looped infinitely, and auto-save needs every change in the store at once.
- **Hooks go in `hooks/`; `lib/` stays free of React** and reads stores only with `getState()`. *(ast-grep)*
- **Colours only through the tokens in `src/App.css`.** No Tailwind palette classes or literal colours; tokens use `light-dark()`, so one change covers both themes. See `color-system.md`. *(ast-grep)*
- **Log through `@tauri-apps/plugin-log`, not `console`.** Release builds strip `console.*`, so it never reaches a user's log. Release builds also log at debug level, so anything that fires per keystroke or per save goes behind `import.meta.env.DEV`. *(Oxlint)*
- **Keep stateful panels mounted** and hide them instead. Unmounting loses panel sizes, scroll position and editor state.
- **Don't add `useMemo`, `useCallback` or `React.memo` by default.** The React Compiler handles memoisation; it doesn't change the Zustand rules.
- **One copy of each `@lezer/*` and `@codemirror/*` package.** Duplicates break highlighting at runtime and typecheck. After `bun update`, `grep -E '"[^"]+/@(codemirror|lezer)/' bun.lock` must print nothing; if it doesn't, run `rm -rf node_modules bun.lock && bun install`.
- **Keep `@babel/core` on 7.** `babel-plugin-react-compiler` is built against Babel 7, and nothing else pins it, so dependency updates will offer 8.
- **Test in the app, not Chrome.** macOS runs WebKit, so CSS and behaviour that work in Chrome DevTools can fail. For example, `field-sizing: content` isn't supported (use `AutoExpandingTextarea`).
- **Unsaved edits are never overwritten** by a reload from disk, and reading a saved file back must give exactly the text the editor holds, or the view jumps. See `editor.md` before touching saving, file loading or the Rust parser.

## Where things live

- `src/components/`: UI by feature (`layout/`, `editor/`, `frontmatter/`, `preferences/`, `command-palette/`, …), shadcn in `ui/`
- `src/hooks/`: hooks, including queries and mutations (`queries/`, `mutations/`) and actions (`editor/useEditorActions.ts`)
- `src/store/`: Zustand stores
- `src/lib/`: logic without React: `editor/` (CodeMirror extensions and commands), `commands/` (command palette), `project-registry/` (settings), `files/`, `schema.ts`, `query-keys.ts`, `dates.ts` (always use these for dates; `new Date('YYYY-MM-DD')` shifts days by timezone), `toast.ts`, `ide.ts`
- `src/lib/bindings.ts`: generated Tauri command bindings
- `src/App.css`: colour tokens and global styles
- `src/styleguide/`: the component styleguide (`localhost:1420/styleguide.html`), dev only
- `src-tauri/src/`: Rust: `commands/` (one file per area), `parser.rs` and `schema_merger.rs` (schemas), `agent_bridge/` (dev only)
- `test/`: Astro projects for manual and agent testing. Work in the gitignored copy, `temp-dummy-astro-project`, which `bun run reset:testdata` recreates from `test/dummy-astro-project`
- `scripts/`: the `app` CLI, release script and dev launcher

Naming: `kebab-case` directories, `PascalCase` components, `index.ts` barrel exports.

## Tauri commands

Commands are typed end to end with tauri-specta. To add one:

1. Define it in Rust with `#[tauri::command]` and `#[specta::specta]`.
2. Add it to `collect_commands![]` in `src-tauri/src/bindings.rs`.
3. Regenerate the bindings: `cd src-tauri && cargo test export_bindings -- --ignored` (no app launch needed; `tauri:dev` also regenerates them).
4. Commit the updated `src/lib/bindings.ts`.
5. If it exposes a new type, add JSDoc for it in `src/types/domain.ts`.

Call commands through `commands` from `@/lib/bindings`. They return a `Result` instead of throwing:

```typescript
const result = await commands.scanProject(path)
if (result.status === 'error') throw new Error(result.error)
```

## Scripts

```bash
bun run check:all       # typecheck, Oxlint, ast-grep, Oxfmt, cargo fmt, Clippy, all tests. Run before finishing
bun run fix:all         # auto-fix lint and formatting
bun run test            # Vitest in watch mode (test:run once; rust:test for cargo). `bun test` is bun's own runner and won't work
bun run app help        # drive, inspect and screenshot the running dev app
bun run app logs        # recent warnings and errors from Rust, the webview and tauri:dev
bun run reset:testdata  # reset temp-dummy-astro-project from test/
bun run tauri:dev       # the dev app (agents: Danny keeps it running; never start it)
```

Dev builds run as a separate app (`is.danny.astroeditor.dev`, "Astro Editor Dev") with their own settings, data and logs, so they never touch the installed app. See `docs/developer/agent-tooling.md`.

## Skills

Project skills in `.claude/skills/`:

- **app-control:** see and drive the running dev app: screenshots in light and dark, the UI outline, clicks and typing, the test project, the styleguide, logs. Use it whenever a change affects the UI.
- **deps-update:** an interactive dependency update session across the repo, tracked in a task doc.
- **codebase-hygiene:** find unused code and dependencies (knip) and duplication (jscpd), then clean up what Danny approves.

## Developer docs

In `docs/developer/`. Read the ones for the area you're working in.

- `architecture-guide.md`: how the app fits together and why: state, the Zustand rules, boundaries, events, logging, deliberate choices
- `editor.md`: CodeMirror integration, highlighting, auto-save and data safety
- `schema-system.md`: how collection schemas are found, parsed and merged, what Astro generates, and why fields go missing
- `commands-and-shortcuts.md`: the editor and palette command systems, native menus, keyboard shortcuts
- `ui-patterns.md`: design principles, Base UI and shadcn, forms, notifications
- `color-system.md`: colour tokens and dark mode
- `editor-styles.md`: the editor's colour and typography spec
- `app-data.md`: preferences, the project registry and recovery files
- `cross-platform.md`: webview versions, platform config, window behaviour
- `testing.md`: where tests go and the test setup's mocks
- `ast-grep-linting.md`: the architecture lint rules
- `optimization.md`: build and bundle settings
- `releases.md`: cutting a release, CI, updates and signing
- `agent-tooling.md`: the dev identity, agent bridge, styleguide and logs

## Tasks

Tasks live in `docs/tasks-todo/` as `task-[number]-[name].md` (lowest number is next; `x` means unprioritised). When one is done, move it to `docs/tasks-done/` renamed `task-YYYY-MM-DD-[number]-[name].md` with the completion date. `docs/tasks-done/` is history, and often out of date.
