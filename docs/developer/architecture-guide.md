# Architecture Guide

How the app fits together, and why it's built the way it is. AGENTS.md states the rules in one line each; this doc gives the reasoning behind them. Area docs go deeper: `editor.md`, `schema-system.md`, `commands-and-shortcuts.md`, `ui-patterns.md`, `app-data.md`.

## Shape

- **Rust (`src-tauri/`)** does everything that touches the filesystem: scanning projects, reading and writing files, parsing schemas, watching for changes, building native menus, and writing preferences. Commands are typed end to end with tauri-specta; `src/lib/bindings.ts` is generated, and every command returns a `Result` (`{ status: 'ok', data }` or `{ status: 'error', error }`) rather than throwing.
- **React (`src/`)** renders the UI and holds editing state. `components/layout/Layout.tsx` wires things together: it renders the panels, registers the auto-save callback and sets up the app-wide listeners.

## State

State lives in one of three places, chosen by where the data comes from:

- **TanStack Query** for anything read from disk: collections and their schemas, directory listings, file content. Keys come from `src/lib/query-keys.ts` and are hierarchical, so invalidating a prefix (a project, or a collection's directories) refreshes everything under it.
- **Zustand** for app state that several components share. The stores are split by how often they change: `editorStore` on every keystroke, `projectStore` (project, settings, watcher) rarely, `uiStore` (panels, modes) occasionally, plus small stores for single features. Splitting them is what stops typing from re-rendering the sidebar.
- **`useState`** for state one component owns: hover, open/closed, a draft value.

### Zustand rules

- **Select each value; never destructure the store.** `const { a } = useStore()` subscribes to the whole store, so the component re-renders on every change to anything in it. In the editor that meant 15 or more re-renders per keystroke. ast-grep enforces this for every `use…Store` hook.
- **Use `useShallow` when a selector builds a new object or array.** Zustand compares selector results by reference, so a selector that returns a fresh object re-renders on every store update (or loops). A plain slice like `state.currentFile` keeps its reference until it changes, so `useShallow` there is harmless but not needed.
- **Use `getState()` in callbacks, effects and async code.** It reads the current value without subscribing, so callbacks stay stable and never read stale state. Commands, keyboard handlers and `lib/` code all work this way.

### Hybrid Action Hooks

Stores can't call hooks, but some actions need query data (the save needs the collection's schema for field order). So:

- **User-triggered actions** live in hooks that can reach the query client, like `useEditorActions` (save, open, create).
- **State-triggered actions** live in the store. Auto-save is scheduled by `editorStore` and runs a callback that Layout registers from `useEditorActions`.

This replaced an earlier design where stores fired events and hooks polled for them. `projectStore` does import the `queryClient` singleton to invalidate queries when settings change; that's a one-way call, which is fine.

### Direct Store Pattern

Frontmatter fields each take a field `name`, read their value with a selector and write it with `updateFrontmatterField`. There's no form library. React Hook Form and Zustand together looped infinitely (the form watched values, store updates re-triggered the watch), and auto-save needs every change in the store immediately anyway. Don't lift field values or `onChange` up into a parent form.

## Directory boundaries

- **`hooks/`** holds everything that exports a `use*` function.
- **`lib/`** is plain TypeScript: business logic, utilities, classes. It may read a store with `getState()` (a one-way call with no React coupling) but never subscribe. The one exception is `lib/theme-provider.tsx`, a context provider kept with its hook.
- **`store/`** holds the Zustand stores.
- **`components/ui/`** is shadcn (see `ui-patterns.md`); **`components/tauri/`** holds reusable components that call Tauri APIs.

ast-grep enforces the first two (`hooks-in-hooks-dir`, `no-store-subscription-in-lib`), because `lib/` code that subscribes to a store can't be used or tested outside React.

## How parts talk

- **Tauri commands** for request and response, through `@/lib/bindings`.
- **Tauri events** from Rust: native menu items (`menu-*`, handled in `useMenuEvents`), the file watcher, schema changes and `rust-toast`.
- **DOM custom events** for actions that need a hook when the caller can't use one, such as the command palette or a store asking for a new file or a reload. `useDOMEventListeners` (mounted by Layout) handles them.
- **`useEditorStore.subscribe`** to push store changes into CodeMirror without re-rendering (see `editor.md`).

Commands, menus and shortcuts are covered in `commands-and-shortcuts.md`.

## Keep stateful panels mounted

The sidebar and frontmatter panel are collapsed and expanded through `react-resizable-panels`' `collapse()` and `expand()`, not unmounted, and the same goes for anything else that's expensive to rebuild or holds state. Unmounting loses the panel sizes, the scroll position, the CodeMirror view and any local state. Prefer hiding with CSS over `{visible && <Thing />}` for those.

## React Compiler

The React Compiler (1.0) compiles everything in `src/`, so don't add `useMemo`, `useCallback` or `React.memo` unless profiling shows a need. It doesn't change the Zustand rules: selectors and `getState()` still decide what re-renders.

- **A component that breaks the Rules of React is silently left uncompiled.** `Editor`, `FrontmatterField`, `useCommandPalette` and `ContentLinkerDialog` currently aren't compiled (tracked in #347). A lint suppression hides the violation, not the bailout.
- **Lint names:** the rules are configured as `react/*` in `.oxlintrc.json`, but suppression comments use the `react-hooks/*` alias.
- **Async effects** use a `cancelled` flag in their cleanup, so a slow result never lands after the component has moved on.

## Logging

Log through `@tauri-apps/plugin-log` (`error as logError`, `warn as logWarn`, `info`, `debug`), usually fire-and-forget with `void`. Release builds strip `console.*`, so a `console.error` never reaches a user's log; `no-console` is a lint error in `src/` for that reason. Release builds log at debug level too, so anything that fires on every keystroke, save or event goes behind `import.meta.env.DEV`. Prefix messages with `Astro Editor [TAG]` where an area has a tag. Where the logs end up is in `agent-tooling.md`.

## Security boundaries

- **CSP** (`src-tauri/tauri.conf.json`): a frontend `fetch` to a new origin needs adding to `connect-src` (origin only); images may load from `https:`. Requests made from Rust aren't affected.
- **File access:** the asset protocol scope is `**`, because projects can live anywhere, so the Rust commands are the boundary. They check paths with `validate_project_path` before reading or writing.

## Deliberate choices

Decisions that look reversible but aren't, or that a newcomer might "fix":

- **Vanilla CodeMirror, not a React wrapper.** Custom decorations, transactions and the store sync need direct access to the view.
- **No form library** for frontmatter (above).
- **Stores split by how often they change** (above).
- **Astro's generated JSON schemas are the source of truth** for frontmatter fields; parsing Zod is limited to what the JSON loses. See `schema-system.md`.
- **shadcn on Base UI, not Radix.** It's shadcn's default, and its Combobox needs Base UI anyway. See `ui-patterns.md`.
- **Every colour is a `light-dark()` token** in `App.css`. See `color-system.md`.
- **Native menus and context menus** come from Tauri, not HTML, so they behave like macOS menus.
- **Writer mode only.** No git, publishing, previews or code-editing features; see the product principles in AGENTS.md.
