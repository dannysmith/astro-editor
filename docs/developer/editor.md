# Editor

The writing surface is vanilla CodeMirror 6 (no React wrapper), parsed by Lezer's markdown grammar. This doc covers the rules for touching `Editor.tsx`, how highlighting works and where it doesn't, and how edits get to disk without losing anything. Each extension in `src/lib/editor/extensions/` has a header comment explaining what it does and why; read those for detail.

## One Lezer, one CodeMirror

Only one copy of `@lezer/common` and of each `@codemirror/*` package may be installed. Lezer's `Tag` and tree objects from different versions aren't compatible, so a duplicate breaks highlighting at runtime without an error, and a duplicate `@codemirror/view` breaks typecheck. `package.json` pins `@lezer/common` with `overrides`, but `bun update` can still leave older copies nested under other packages. AGENTS.md has the check and the fix.

## Editor.tsx

`Editor.tsx` owns the `EditorView` by hand, and the store mirrors it rather than driving it:

- **The view is created once** (an effect with empty dependencies). Recreating it would lose undo history, selection and scroll.
- **Typing flows editor → store.** The update listener writes `editorContent` to the store, which marks the file dirty and schedules auto-save.
- **Everything else flows store → editor through `useEditorStore.subscribe`,** not a React subscription, so typing never re-renders the component. It's wrapped in `React.memo` with a comparator that always returns `true` for the same reason.
- **Store-to-editor writes set `isProgrammaticUpdate`** so the update listener doesn't mistake them for typing. Without it, loading a file would mark it dirty and save it straight back.
- **A store write that differs from the document replaces the whole document.** That loses the scroll position (and typewriter mode re-centres on any `docChanged`), so it should only happen when a file is opened or changed on disk. See the round trip below.
- **Modes** (focus, typewriter, the Alt key for URL and image hover) are toggled with state effects, not by recreating extensions.

## Highlighting

Highlighting runs through custom tags rather than `@lezer/highlight`'s built-in `tags.*`, so headings, emphasis and their syntax marks can be styled separately:

- `syntax/markdownTags.ts` defines the tags;
- `syntax/styleExtension.ts` maps Lezer nodes to them with `styleTags`;
- `syntax/highlightStyle.ts` maps tags to styles.

**Contextual mark rules don't fire.** Since `@lezer/highlight` 1.2.3, `@lezer/markdown`'s built-in rule (every mark → `tags.processingInstruction`) is checked before ours, so a rule like `'ATXHeading1/HeaderMark'` in `styleExtension.ts` is silently ignored. `extensions/syntax-mark-decorations.ts` works around this by walking the tree and decorating heading, emphasis and strong marks directly, and `theme.ts` gives those classes `inherit !important` to beat the inner highlight spans. Style any new contextual mark the same way.

`styleTags` also only applies to the exact node, not its children, which is why whole-blockquote styling is a line decoration (`blockquote-style.ts`).

Colours and type come from `editor-styles.md` and the `--editor-color-*` tokens in `App.css` (see `color-system.md`).

## Auto-save and data safety

Never losing work is a product principle, and most of these rules were written after a data-loss bug.

- **When it saves:** `scheduleAutoSave` in `editorStore.ts` debounces by the `autoSaveDelay` setting (2 seconds by default). Debouncing alone never fires during continuous typing, so a save is also forced once 10 seconds have passed since the last one (`MAX_AUTO_SAVE_DELAY_MS`). `openFile` sets `lastSaveTimestamp` so that clock starts when a file opens.
- **Who saves:** the store can't call hooks, so Layout registers `useEditorActions().saveFile` as the store's auto-save callback (the Hybrid Action Hooks pattern, see `architecture-guide.md`). Auto-save never shows the success toast (it saves with `showToast` false); a failed save still shows an error.
- **Switching files saves first.** `openFile` runs the save for a dirty file before replacing the store's state, and re-opening the open file while it's dirty does nothing. A save that finishes after the switch only updates the store if its file is still open; if it fails, the recovery data is the outgoing file's. Quitting with unsaved edits doesn't save yet (#347).
- **Edits during a save survive.** After writing, `saveFile` marks the file clean only if the content and frontmatter in the store still match what it wrote. Anything typed while the save was in flight stays dirty and is saved next time.
- **Body-only edits keep the user's YAML.** If the frontmatter wasn't touched (`isFrontmatterDirty`), the save sends the original `rawFrontmatter` text, so formatting, comments and key order are preserved. Only an edited frontmatter is re-serialised, in schema field order.
- **Unsaved edits win over disk.** When the file content query refetches, `useEditorFileContent` only copies it into the store if the file isn't dirty. `useFileChangeHandler` ignores watcher events for a dirty file and for 3 seconds after our own save, because one save can produce several events.
- **The save round trip must be byte-identical.** After a save, the content query refetches the file. If parsing it back gives even slightly different text than the editor holds, the store write replaces the whole document and the view jumps. Trailing newlines did exactly this: the save added one and the parser dropped one, so the view jumped every few seconds. The round-trip tests in `src-tauri/src/commands/files.rs` (`test_roundtrip_*`) cover it; any change to parsing or serialising must keep them passing.
- **If a save fails,** the file stays dirty and recovery files are written (see `app-data.md`). There's no crash recovery.
