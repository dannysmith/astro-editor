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
- **Loading a document starts the undo history afresh** (`loadDocument` in `lib/editor/load-document.ts`). Undo can't reach the previous file, or back across a reload from disk, where undoing an earlier edit could insert stale text.
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

Never losing work is a product principle, and each of these rules guards against a way of losing it.

- **When it saves:** `scheduleAutoSave` in `editorStore.ts` debounces by the `autoSaveDelay` setting (2 seconds by default). Debouncing alone never fires during continuous typing, so a save is also forced once 10 seconds have passed since the last one (`MAX_AUTO_SAVE_DELAY_MS`). `openFile` sets `lastSaveTimestamp` so that clock starts when a file opens.
- **Who saves:** the store can't call hooks, so Layout registers `useEditorActions().saveFile` as the store's auto-save callback (the Hybrid Action Hooks pattern, see `architecture-guide.md`). Auto-save never shows the success toast (it saves with `showToast` false); a failed save still shows an error.
- **Saves write in the order they were asked for.** Saves can overlap (Cmd+S during an auto-save), so each disk write waits for the one before (`writeUnderWay` in `useEditorActions.ts`) and an older one can't land last. Each save still reads the store when it's asked for, which switching files relies on.
- **Saves write the file in place,** not to a temporary file renamed over it. An editor should write the file itself, as VS Code does, so it keeps its inode, and with it hard links, permissions and anything watching it. Files with CRLF line endings are written back with LF: CodeMirror and `parse_frontmatter` both normalise them.
- **Switching files saves first.** `openFile` runs the save for a dirty file before replacing the store's state, and re-opening the open file while it's dirty does nothing. A save that finishes after the switch only updates the store if its file is still open; if it fails, the recovery data is the outgoing file's.
- **Closing a file saves first.** `editorStore.closeFile` (Close File, Ctrl+W on Windows and Linux) saves a dirty file and leaves it open if the save fails. `closeCurrentFile` is the plain reset, for callers that have saved already or whose file is gone.
- **Deleting the open file closes it without saving** (`lib/files/delete.ts`), since the next save would write it back.
- **Async inserts check the file is still open.** An image drop copies the image before inserting its path, and the component builder plans imports before inserting; if another file was opened meanwhile, the insert is dropped rather than put in the wrong file.
- **Quitting saves first.** Every way of quitting (Cmd+Q, the Dock, logout and shutdown on macOS; closing the window or Exit on Windows and Linux) makes Rust emit `quit-requested` instead of exiting. `answerQuitRequest` in `lib/quit.ts` saves the open file and calls `quit_app`. If the save fails it calls `cancel_quit` and asks whether to quit anyway, since recovery files can't be restored from the app. Rust quits by itself if the frontend doesn't answer within 5 seconds, so a hung webview can't make the app unquittable. Restarting to install an update calls `saveUnsavedEdits` first too. The Rust side, including the macOS hook, is `src-tauri/src/commands/quit.rs`.
- **Renaming the open file never leaves a copy behind,** whether it's renamed from its pattern (`renameOpenFile`) or in the sidebar (`renameFile`), both in `lib/files/rename.ts`. A dirty file is saved first, and the rename is given up if that fails or another file was opened meanwhile. While Rust renames it, a save of the old path waits (`renameUnderWay`) and then writes to the new one, since writing to the old path would bring the old file back. The store gets the new path as soon as the rename is done, then the file's new id. Renames never replace another file: `rename_file` and `rename_entry` refuse if the new name is taken, except by the same file with a change of case.
- **An opened file is always read from disk.** File content is cached by the file's id, which comes from its path, and a path isn't a stable identity: renaming or deleting a file frees its path for another file. So `openFile`, and following a rename onto a new id, drop the cached content for that file first. Otherwise a file created with ⌘N right after the last new file was renamed would show that file's title, since both started as `<today>.md`.
- **Edits during a save survive.** After writing, `saveFile` marks the file clean only if the content and frontmatter in the store still match what it wrote. Anything typed while the save was in flight stays dirty and is saved next time.
- **Body-only edits keep the user's YAML.** If the frontmatter wasn't touched (`isFrontmatterDirty`), the save sends the original `rawFrontmatter` text, so formatting, comments and key order are preserved. Only an edited frontmatter is re-serialised: schema fields in schema order, then any other keys alphabetically, with nested objects keeping their key order. Its values are written as they are: a datetime stays a datetime (the date picker writes `YYYY-MM-DD`), and serde_norway leaves both unquoted so Astro reads them as dates.
- **Edits that end where they started keep the user's YAML too.** The first load after opening a file is kept as its `frontmatterBaseline` (values and text). A save whose values are back to the baseline's sends the baseline's text, so a field changed and changed back, or a switch turned on and off again (`lib/files/frontmatter-baseline.ts`), leaves the file as it was. The baseline isn't moved by later loads, because auto-save has usually rewritten the text before a value is changed back. That's safe even after a change outside the app, since the text is only written when the values match exactly what it reads back as.
- **Unsaved edits win over disk.** When the file content query refetches, `useEditorFileContent` only copies it into the store if the file isn't dirty. `useFileChangeHandler` ignores watcher events for a dirty file, and for 3 seconds after our own save (or opening the file), because one save can produce several events. Every other watcher event also refreshes the sidebar and entry pickers, so files added, renamed or edited outside the app show up.
- **The save round trip must be byte-identical.** After a save, the content query refetches the file. If parsing it back gives even slightly different text than the editor holds, the store write replaces the whole document and the view jumps every few seconds as auto-save runs. A trailing newline added by the save and dropped by the parser is enough. The round-trip tests in `src-tauri/src/commands/files.rs` (`test_roundtrip_*`, and `mdx_corpus_tests` over the files in `test/mdx-imports/`) cover it; any change to parsing or serialising must keep them passing.
- **MDX imports are hidden, not edited.** `parse_frontmatter` splits an MDX file into frontmatter, the ESM block (its `import` and `export` statements) and the body. Only the body reaches the editor. `src-tauri/src/mdx_esm/` finds where the block ends by parsing it with swc, the way MDX does, and the block is written back as read. A block that ends in the wrong place either hides text the writer can't then edit or shows code in the editor, so check any change against the corpus snapshot in `test/mdx-imports/files/blocks.txt`.
- **If a save fails,** the file stays dirty and recovery files are written (see `app-data.md`). There's no crash recovery.
