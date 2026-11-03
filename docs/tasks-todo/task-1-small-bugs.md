# Small bugs from #347

## Status

**Current Phase:** E. Code health
**Branch:** small-bugs
**Issue:** #347

Bugs and cleanups collected in #347 during the developer docs audit, the MDX imports work (#357) and the November dependency update (#362). Many were found by reading the code, so verify each one (in the app with `bun run app`, or with a failing test) before fixing it. *Checked* means already confirmed.

Not in this branch: save-on-quit (its own branch) and the project settings bugs in #361 (with the project rework, #82).

One commit per item or small group, `check:all` after each. Update `docs/developer/` where a fix changes something documented.

## A. Sidebar, watcher and collections

1. [x] **Sidebar dates are missing for `pubDate` collections.** New projects' settings files are created from `DEFAULT_PROJECT_SETTINGS`, which saves the date field as `'date'`, so the `['pubDate', 'date', 'publishedDate']` fallback in `getEffectiveFrontmatterMappings` never applies. Date sorting breaks too. Astro's blog starter uses `pubDate`, so this likely hits most new users. *Checked:* `test/demo-project` shows no dates; `dummy-astro-project` only works because `pubDate` was mapped by hand. Fix: try the configured field, then the default list (fixes existing settings files without a migration), and stop seeding `'date'`
2. [x] **Files added, renamed or deleted outside the app don't show in the sidebar,** and outside frontmatter edits leave titles, dates and draft badges stale. Nothing invalidates the collection's directory queries on watcher events, and `refetchOnWindowFocus` is off, so the list waits for navigation or the 5-minute rescan. Regressed in the TanStack Query migration (4ae37727). *Checked.* Fix: invalidate the current collection's directory queries on create, remove and rename, and on content changes outside the 3-second window after the app's own save. Remove the misleading comment in `projectStore.ts`
3. [x] **Reload Collections does nothing.** `useCommandContext` dispatches `reload-collections` and `reload-collection-files`, but nothing listens. *Checked.* Fix: invalidate the collections and directory queries directly
4. [x] **`.astro/collections/` is only watched if it existed when watching started** (`watcher.rs`), so after a project's first `astro sync`, schema changes need the project reopened. Fix: watch something that always exists and filter, after checking how the watcher handles a directory appearing. Update `schema-system.md`

## B. Schema parsing and frontmatter fields

Astro 7 generates schemas with Zod 4's `z.toJSONSchema`, which emits shapes the Rust parser (`schema_merger.rs`) doesn't handle. Add a Rust fixture for each shape first; `.astro/collections/` in `test/` shows real output.

5. [x] **`z.tuple`, numeric `z.literal` and numeric `z.enum` may fail the whole collection's JSON parse.** `JsonSchemaProperty` expects `items` to be a schema (tuples emit `items: false`) and `const_`/`enum_` to be strings. The collection then silently falls back to the Zod-only form (only image and reference fields). The most important item in this group
6. [x] **A union of literals is parsed as a plain string.** It becomes `anyOf` of `const`, not `enum`, so it shows a text input instead of a dropdown
7. [x] **`z.discriminatedUnion` becomes `oneOf`,** which Rust doesn't read, so the type is `unknown`. Check what the form shows; if it's the YAML editor, that may be right and only needs a test
8. [x] **Nullable objects (`anyOf: [object, null]`) become string fields** (`handle_anyof_type`)
9. [x] **Exclusive number bounds show as the next whole number.** `extract_constraints` turns `exclusiveMinimum: 0` into `min = 1`, so `z.number().gt(0)` shows "Min: 1" although `0.5` is valid. Keep exclusivity in `FieldConstraints` and show "> 0" (or only add 1 for integers). *Checked by CodeRabbit*
10. [x] **`test_parse_astro6_file_based_collection` uses the old root shape.** Astro 7's `file()` root is `anyOf: [{type: array, items}, {type: object, additionalProperties}]` (see `test/*/.astro/collections/authors.schema.json`)
11. [x] **`z.array(image())` uses the YAML editor instead of an image picker.** Rust already types it as an array with `subType: image`, but `FrontmatterField` sends every array that isn't strings or numbers to `YamlField`. `ImageField` reads and writes by field path, which can't address array items. Fix: split `ImageField`'s picking and preview into a component that takes a value and `onChange`, use it in `ImageField` and a new `ImageArrayField` (thumbnails, remove, add). Also check arrays of references whose collection the Zod parser didn't find, which fall through to `YamlField` too

## C. Command palette and preferences

12. [x] **Palette search ignores text after the first colon.** `CommandPalette.tsx` filters on `value.split(':')[1]`, and `value` is `id:label`, so "Open Collection: blog" only matches "Open Collection". *Checked*
13. [x] **Preference pane `FieldLabel`s have no `htmlFor`,** so clicking a label doesn't focus its input

## D. Keyboard shortcuts

14. [x] **Cmd+W should close the window on macOS.** Today the `mod+w` hotkey (`useKeyboardShortcuts.ts`) wins over the native Close item on every platform, so Cmd+W closes the file and does nothing without one. *Checked by Danny.* On macOS, make it close the window like Notes or Ulysses: call `close()` on the window, which goes through the Rust `CloseRequested` handler (saves window state and hides it), and clicking the Dock icon brings it back with the same file open. On Windows and Linux, keep Ctrl+W closing the file (closing the only window would quit). Close File stays in the palette. Update the website's keyboard shortcut docs and `commands-and-shortcuts.md`
15. [x] **Other shortcuts are bound twice:** Cmd+S, Cmd+N, Cmd+Shift+O, Cmd+B/I/K and Option+Cmd+1–4 are both native menu accelerators and JS hotkeys or CodeMirror keymaps; Windows has no native menu, so the JS bindings are its only path. Check each fires once on macOS. If so, explain why both exist in `commands-and-shortcuts.md` and change nothing

## E. Code health

16. [x] **Drop the direct `rfd` dependency.** `select_project_folder` calls `rfd::AsyncFileDialog` although `tauri-plugin-dialog` wraps `rfd` and has a Rust API. Since #362 our `rfd` is pinned to `gtk3` to avoid a Linux build clash; using the plugin removes the dependency and the pin. Retest Open Project
17. [x] **React Compiler bailouts.** There were 16, not 4: besides real Rules of React violations, the compiler skips any component using `try`/`finally`, `throw` inside `try`, or `?:`/`&&`/`??` inside `try`. All fixed except the vendored shadcn `calendar.tsx`. Approach: data reads moved to TanStack queries (`useImageSrcQuery` for thumbnails and the Alt-hover preview; the Content Finder shares `collectionFiles` with the entry pickers); shared async work moved to `lib/files/images.ts`; the save and create-file bodies lifted to module-level functions, unchanged; short handlers use `.catch()`. `useCommandPalette` lost its hand-maintained dependency list and its side effects inside a state updater, and the palette context lost its unused `isDirty` and `saveFile`. `bun run compiler:check` (in `check:all`) now fails on any new bailout. Danny: try a rename from the sidebar's context menu (now `mutate` callbacks)
18. [ ] **Unused code:** `mdxComponentsStore`, the `read_json_schema` command, `useDeleteFileMutation`, the editor registry's `save` and `addCursorsToLineEnds`, and `path-resolution.ts`'s `getEffective*` functions (nothing calls them; `collection-settings.ts` and `effective-settings.ts` do the same job). Do it last with the `codebase-hygiene` skill

## Issues encountered

- **B (5–10) went a little wider than listed.** Records (`z.record`) also showed as a text input that blanked the object, so they now use the YAML editor with discriminated unions. `z.number().int()` showed Zod's safe-integer range ("-9007199254740991–9007199254740991") under every integer field; those bounds are now dropped. The `file()` branches in `parse_json_schema` were dead (`file()` collections never reach the parser) and misread `.catchall()` collections as `file()` ones, so they were removed rather than updated. The `notes` collection in `test/dummy-astro-project` has one field of each shape, with `zod4-shapes-test.md`
- **One blank file load, not reproduced.** While testing #11, opening a note straight after an auto-save timed out in the agent bridge ("webview didn't respond") and the note opened with an empty editor and frontmatter. Opening it again worked, and six tries at the same sequence (saved and still dirty) all loaded and saved correctly. Worth watching for
