# Commands and shortcuts

How the editor commands, the command palette, the native menu and the keyboard shortcuts fit together. There are two command systems that share nothing, and shortcuts live in two places.

## Two command systems

- **Editor commands** (`src/lib/editor/commands/`): `globalCommandRegistry` holds the live `EditorView` and a set of CodeMirror commands with camelCase names (`toggleBold`, `formatHeading`, `toggleFocusMode`, …). `useEditorSetup` registers it when the editor mounts and unregisters it when it unmounts. With no editor, `execute()` returns `false` and does nothing, so menu items and shortcuts that go through it are silently inert when no file is open. The native menu's formatting items and a few editor keymaps use it.
- **Palette commands** (`src/lib/commands/app-commands.ts`): `AppCommand`s with kebab-case ids, a `group`, an `isAvailable(context)` filter and an `execute(context)`. `getAllCommands(context)` returns the ones available right now. The `CommandContext` comes from `useCommandContext` (`src/hooks/commands/useCommandContext.ts`), which gathers store state, query data and actions. Commands that only touch a store may call its `getState()` directly, as `content-linker` (Find Content) does.

The agent bridge lists and runs palette commands through `getAllCommands` too (`bun run app run --list`, `bun run app run <id>`), so a palette command can be tested from the terminal.

## Native menu

The menu is built in Rust in `src-tauri/src/lib.rs` with `MenuItem::with_id`. `on_menu_event` turns each id into a `menu-*` event (`menu-save`, `menu-format-bold`, …), and `src/hooks/useMenuEvents.ts` listens for them and calls stores, actions or the editor registry (formatting events go through `FORMAT_EVENT_MAP`). Adding a menu item means touching both files. On Windows, the title bar's overflow menu (`WindowsMenu.tsx`) emits the same `menu-*` events from JS, so `useMenuEvents` handles both. Accelerators use `CmdOrCtrl`, never `Cmd` (see `cross-platform.md`).

**Formatting items are enabled only while the editor has focus and a file is open.** They're created disabled, and `useEditorFocusTracking` calls the `update_format_menu_state` command whenever editor focus or the current file changes. Menu accelerators fire wherever focus is, so without this, Cmd+B while typing in a frontmatter field would bold text in the editor.

## Actions that need hooks

Some actions need a query or mutation hook (creating a file needs `useCreateFile`), which neither a command context function nor a store can call. These dispatch a DOM `CustomEvent` instead (`create-new-file`, …), and `src/hooks/useDOMEventListeners.ts`, mounted once in `Layout`, handles them with the hook's function. Cmd+N uses the same event. Some store-only actions (focus mode, the highlight toggles) also go through events; a new one doesn't need to.

## The palette's command list

`useCommandPalette` builds the command list from the `CommandContext` on render, and the React Compiler memoises it on the context, which `useCommandContext` builds from store selectors and query data. **A command's `isAvailable` and label must read what they need from the context.** One that reads a store's `getState()` there goes stale in the palette until something in the context changes.

Save is deliberately not in the palette. Everyone uses Cmd+S, and it would make the list depend on `isDirty`, so it would be rebuilt on every edit and every save.

## Adding a palette command

1. Add an `AppCommand` to the right array in `src/lib/commands/app-commands.ts`. A new array needs adding to `getAllCommands`; a new group needs adding to the `group` union in `src/lib/commands/types.ts` and to `GROUP_ORDER` in `useCommandPalette.ts`, or it won't show.
2. If it needs state or an action the context doesn't have, add it to `CommandContext` in `types.ts` and to `useCommandContext`, read with a selector. If the action needs a hook, dispatch a DOM event and handle it in `useDOMEventListeners`.
3. Update the user-facing list in `website/src/content/docs/reference/commands.mdx`.

## Shortcuts

- **App shortcuts** are `useHotkeys` calls in `src/hooks/useKeyboardShortcuts.ts`, plus Cmd+P in `useCommandPalette`. They use `enableOnFormTags` and `enableOnContentEditable` (`DEFAULT_HOTKEY_OPTS`): the editor is a contenteditable and the frontmatter fields are inputs, so without them Cmd+S and the rest would do nothing while you type, which is most of the time.
- **Editor shortcuts** (formatting, headings, focus and typewriter mode, Tab) are CodeMirror keymaps in `src/lib/editor/extensions/keymap.ts`. They only fire while the editor has focus. The file's header lists them and their precedence. CodeMirror's `Mod-/` comment toggle is removed from the defaults and rebound to the component builder, which falls back to toggling a comment.
- **Several keys are bound both as native menu accelerators and as JS shortcuts** (Cmd+S, Cmd+N, Cmd+Shift+O, Cmd+B/I/K, Option+Cmd+1–4). Only one fires. WebKit gives the page a key before the menu, and a hotkey or CodeMirror keymap that handles it calls `preventDefault`, so the menu never sees it; when nothing on the page handles it (Cmd+B outside the editor), the menu does. On Windows the native accelerators don't fire while the webview has focus, so the JS bindings are the only path there (see `cross-platform.md`). Keep both.
- **Cmd+W closes the window on macOS** (`getCurrentWindow().close()`, which `lib.rs` turns into a hide, like the red button) **and the current file on Windows and Linux**, where closing the only window would quit. Close File is in the palette on every platform.

The user-facing list is `website/src/content/docs/reference/keyboard-shortcuts.mdx` (Help → Keyboard Shortcuts opens it). Update it whenever a shortcut changes.
