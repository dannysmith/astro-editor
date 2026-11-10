# Task: Reopen the last open entry

GitHub: #373

Its own branch and PR, after task 1 is merged. Then back to task 8's reviews.

## Problem

Opening a project always starts with no file open, so getting back to what you were writing means finding it in the file list again. When a project opens, reopen the entry that was open when it was last left, if it's still there.

## Approach

The astro-editor-plus fork does this (`useRememberLastEntry` and `lib/projects/last-entry.ts`): it stores the entry's path, relative to the project, in its registry record, writes it a second after the open file changes (and before quitting or switching projects), and reopens it through `resolve_file_entry`. Read it before starting, then fit it to how this codebase does things:

- [ ] **Store it with the project.** A `lastEntry` (path relative to the project) on the project's registry record (`ProjectMetadata` in `src-tauri/src/models/preferences.rs`), written through a small Rust command so the registry's locking and atomic writes apply. Relative, so it survives Locate… after a project moves. Clear it when the file is closed with nothing else opened, so closing a file isn't undone on the next open.
- [ ] **Write it when the open file changes,** debounced (about a second, so flicking through files doesn't write each one), and once more before quitting or switching projects. It's a convenience: a failed write is logged, never shown.
- [ ] **Reopen it in `openProject`** once the scan has loaded, through `resolve_file_entry` (it may have moved, been deleted or left the collection, in which case open nothing). Respect the open-project generation guard, so an open that's been overtaken doesn't open a file. A deep link that opens a file wins over the remembered one.
- [ ] **Data safety:** reopening must go through the usual `openFile` path, so it reads from disk and never touches unsaved edits (see `docs/developer/editor.md`).
- [ ] Tests: the path is stored relative and cleared on close; a missing or moved entry opens nothing; an overtaken open doesn't reopen; a deep link wins.
- [ ] Docs: the registry fields in `docs/developer/app-data.md`, and a line in the user guide where opening a project is described (`website/src/content/docs/file-management/overview.mdx`).
- [ ] Check it in the dev app (`bun run app`): open a file, switch project and back, quit and reopen.
- [ ] `bun run check:all`, then a PR, and close #373 when it merges.
