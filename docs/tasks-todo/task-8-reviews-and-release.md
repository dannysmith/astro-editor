# Task: Reviews & Admin

## Fixes from the astro-editor-plus fork

[GustavoGomez092/astro-editor-plus](https://github.com/GustavoGomez092/astro-editor-plus) is a fork built on main at `3af8e9bf`. Comparing it with this branch turned up the bugs below. They were found by tracing the code, plus two small scripts, and none has been reproduced in the app, so reproduce each one before fixing it. The fork's commit is given where its fix is worth reading (`git fetch https://github.com/GustavoGomez092/astro-editor-plus main`).

### Project settings bugs on this branch

- [ ] **The sidebar shows a collection's old files after its folder, pattern or skipped files setting changes.** `useDirectoryScanQuery`'s query function holds the `Collection` from the last render, and its key (`queryKeys.directoryContents`) only has the collection's name. `updateProjectSettings` invalidates straight after `rescan`, before React re-renders with the new collection, so the refetch scans the old folder with the old pattern. Switching skipped files from Hide to Show dimmed shows no change. `refreshProjectScan`, which runs when the content config changes, never invalidates the listings at all, so editing a glob's `base` or `pattern` leaves the sidebar stale until something else refreshes it. Put the folder, pattern and skipped files setting in the key, or read the collection from the scan inside the query function. Fork: `aec8b28`.
- [ ] **Sidebar collection counts never refresh** (main too). `LeftSidebar` loads them in an effect that depends only on `collections`, and a rescan that finds the same collections keeps the same reference, so creating, deleting or renaming a file, in the app or outside it, leaves the count wrong. Make the counts a query under the project key and invalidate it with the folder listings. Fork: `cd56f11`, `6a81179`.
- [ ] **A preferences file that can't be read is treated as missing, then overwritten.** `read_or_default` and `read_project_file` treat any `read_to_string` error as no file. If the registry can't be read (permissions, not UTF-8), `open_project` writes a new one holding only the project being opened, and every other project is lost. Only `NotFound` should mean missing; anything else should be set aside like a file that doesn't parse. Fork: `f45ae1a`.
- [ ] **When `set_aside_broken` can't move a file,** the message still says it was kept, and the next write replaces it. Don't write over a file that couldn't be set aside.
- [ ] **`Preferences::write` doesn't `sync_all` the temporary file before renaming it,** so a crash or power cut can leave an empty settings file, which is then set aside and the settings reset. Fork: `11b53ee`.
- [x] **`updateProjectSettings` closes the open file even when the save before it failed,** and the toast says it was saved. `openProject` already checks `isDirty` after saving; do the same here. Fixed in `e649e51e`.
- [ ] **Two project opens close together can overlap.** `setProject` fires `openProject` without a guard. The open that finishes last starts the watcher for whichever project is current by then, so it can start twice, and because `set()` overwrites the `_unlisten*` handles, every file event is then handled twice. It can also stop a watcher that hasn't started yet and show a false "Failed to stop file watcher" toast. A generation counter in `openProject`, checked after each `await`, covers it. It's rare: it needs two deep links, or quick switches during a slow scan. Fork: `0a4d185`, `a25a729`.
- [ ] **A project on an unplugged drive shows as missing,** which invites Remove, and Remove deletes its settings. `list_projects` only checks `is_dir()`. When the path is under a `/Volumes` folder that isn't mounted, say the drive isn't connected instead. Fork: `07eebd3`.
- [ ] **A collection whose folder is missing vanishes from the sidebar.** If every collection's folder is missing, the sidebar says "No collections found. Open an Astro project to get started", which is wrong with a project open. Listing them dimmed with their status icon would fix both.
- [ ] **One collection folder that can't be watched stops all watching.** `create_project_watcher` returns at the first `watch()` error. Skip that folder and watch the rest. Fork: `08547b4`.

### Remember the last open entry

- [ ] When a project opens, reopen the entry that was open when it was last left, if it's still there. The fork stores the entry's path relative to the project in its registry record, writes it a second after the open file changes (and before quitting or switching projects), and reopens it through `resolve_file_entry`. Fork: `useRememberLastEntry` and `lib/projects/last-entry.ts`.

### Editor bugs, on main too

Fix these here or on main straight after this branch merges.

- [ ] **Clicking the open file again wipes it.** For a file with no unsaved edits, `openFile` gets past its only guard (`isDirty && currentFile?.id === file.id`) and clears the store. The sidebar passes the same `FileEntry`, so the effect in `useEditorFileContent` (`[data, currentFile]`) doesn't run again and the editor stays blank. The next keystroke saves the typed text with `rawFrontmatter: ''`, and the file loses its frontmatter and body. Return early when the path matches, still dispatching the event that selects the file's collection. `storeQueryIntegration.test.ts` asserts the clearing and needs changing. Fork: `c4b6cd5`, `8b5b120`.
- [ ] **New files can get frontmatter that fails the site's build.** In the frontmatter block of `useCreateFile`:
  - required fields with no default get `''` or `0`, which fail `email`, `url`, `image()`, enums and `reference()`;
  - dates are quoted, so Astro reads them as strings and `z.date()` rejects them (the test project's `z.coerce.date()` hides this);
  - nested required fields are written as literal `sponsor.name:` keys;
  - object defaults come out as `[object Object]`, and `"` in a string isn't escaped.

  Build the values as an object and let the Rust writer serialise them. Decide what a required field with no default should get: leaving it out fails the build too, and a plain `z.string()` passes with `''` but not when it's missing. Fork: `1577a65`, `62df387` (`lib/files/new-file.ts`).
- [ ] **Order, Title and Filename start sorted descending** (Z to A, 3 to 1). `DEFAULT_VIEW_STATE.sortDirection` is `'desc'` and `setSortMode` keeps the existing direction. Start dates newest first and everything else ascending. Fork: `4c98f05`, the direction part only.
- [ ] **A blank line before the closing `---` is dropped on body-only saves.** `parse_frontmatter` joins the lines between the markers, and `rebuild_markdown_with_raw_frontmatter` skips the newline when the raw text already ends in one. Add a round-trip test: `mdx_corpus_tests` only compares non-blank lines, which is why this got through. Fork: `17eecc0`.
- [ ] **`.default('')` shows a bare "Default:"** under the field (`FieldWrapper`). Leave out empty defaults (`''`, `[]`, `{}`). Fork: `96318d2`.
- [ ] **Check whether multi-line values in text fields get flattened.** `StringField` is an `<input>`, which drops line breaks, so editing a value that has one probably joins its lines. If it does, use `AutoExpandingTextarea` when the value already contains a line break.

## Reviews 

Our recent work has made some fairly significant changes to how the app works so we should conduct a series of reviews looking at things like:

- Adverserial review of the whole project management/settings approach.
- UX review of the project settings stuff and making the mental model of how it all works consistent and good. Most of this is now `task-6-project-settings-ux.md`; review what it leaves. Likewise: are our settings pages designed well and designed to help people understand and use them. Also: icons, names etc.
- Full code review of recent changes to check that they are compliant with the architecture guides and other developer guidance and also with what would be considered best practice. might consider having sub-agents also review for performance etc.
- We should do a review of the website documentation. Most of this should have been updated as we go, but we should look at that around the project stuff. We should look for opportunities to better explain the mental model needed when it comes to settings and how this works and what all of these things are for, if necessary and also check that we haven't added too much bloat to the developer docs.
- To consider rebuilding the marketing video to show some of the new features here In particular the MDX form component builder and the auto inserting stuff.
- We should obviously also review the developer docs and code comments to ensure they're evergreen etc.

## Admin

- [ ] Write up release notes for next release (which I think will be 1.1.0).
  - Say that project settings from 1.0.x are set aside (renamed to `*.v2.json`), so projects may need setting up again. Most won't, because folders and fields are now detected. List the settings that had to be set again in the upgrade check (task 5).
- [ ] Update the README as needed.
- [ ] Close and consolidate all the GH Actions.
- [ ] Make a quick video showing off the new features since the last release. AI can probably do this for me?
- [ ] Write up a quick blog post for my website showing off the new features, with screenshots.
- [ ] Write up a thread for bluesdy showing these off as well as a post for the Astro discord.
- [ ] Any other cleaning up in this repo on GH or here, before I make a release.
- [ ] Release a prerelease and test it on my machine as my proper version of AE.
  - [ ] Before installing, copy `~/Library/Application Support/is.danny.astroeditor` somewhere safe.
  - [ ] Each project's old settings file is renamed to `*.v2.json` the first time it opens. The Review toast only appears where something can't be read.
  - [ ] Note every setting you had to set again, for the release notes.
  - [ ] Every project you'd opened before is in the project list; ones that have moved show as Missing.
  - [ ] With a Retina and a 1x display, move the window between them, then quit and reopen: it keeps its size and display. Dock-reopen after Cmd+W, and unplug the external display with the window saved on it: it opens centred on the laptop (task 7).
- [ ] Do the actual release.
