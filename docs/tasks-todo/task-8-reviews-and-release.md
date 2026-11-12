# Task: Reviews and the 1.1.0 release

The work for 1.1.0 is merged: 162 commits since `v1.0.20`, with about 12,700 lines of Rust and 11,900 of frontend changed. What's left is a second round of reviews, the fixes they lead to, a note for danny.is, a prerelease tested on real sites, and the release.

The first round (fixes from the astro-editor-plus fork, and the reviews before tasks 1 and 2) is recorded in `docs/tasks-done/task-2026-11-10-8-fork-fixes-and-first-review.md`.

## Phase 1: Tidy the repo

- [x] **Look over the repo for anything that doesn't belong.** Nothing did: the tree was clean, `temporary/` was empty, and everything ignored is build output, the temporary test projects or Claude Code's own folders.
- [x] **Check AGENTS.md and the README.** AGENTS.md was missing `mdx_esm/` and `reset:testprojects`. The README promised crash recovery and enforced field constraints (there's neither: see `app-data.md` and the website's field types page), listed theme and IDE settings under Project Settings, and didn't mention reopening the last file.

## Phase 2: Reviews

Everything since `v1.0.20`. Reviewers read the code and the developer docs but not the task docs, so they judge the code as it is rather than as we meant it. They don't edit anything. Every finding is checked against the code before it goes in the findings list, then triaged in Phase 3.

- [x] **A. Adversarial review of projects and settings** (agent). Try to break the project model: the registry and settings files, how a project is identified, opened and moved, the scan (content config, loaders, patterns, overrides), the watcher, and how settings changes, rescans, project switches and reopening the last entry interact. Look for lost settings or content, races, states the UI can't get out of, and assumptions about Astro that don't hold for real sites. Start from `app-data.md` and `schema-system.md`.
- [x] **B. Code review: Rust** (agent). `src-tauri/src` since `v1.0.20`, against AGENTS.md and the architecture guide: correctness, error handling, path safety (`validate_project_path`, `dunce`), blocking IO on the async runtime, the cost of scans, test quality, and design problems Clippy can't see.
- [x] **C. Code review: frontend** (agent). `src/` since `v1.0.20`, against AGENTS.md, the architecture guide and `editor.md`: the Zustand rules, the React Compiler, the `hooks/` and `lib/` boundaries, data safety when saving and loading, query keys and invalidation, needless re-renders, test quality, and leftovers from abandoned approaches.
- [x] **D. UX review of Project Settings and the other settings pages** (by hand, in the dev app). With personal-site, unusual-structure, starlight-minimal and the test vault, in light and dark. Does Project Settings show clearly what AE found and what you can change? Is the mental model (what Astro says and what you chose; project, collection and global) the same across Project Settings, Preferences, the project list and the file list? Names, icons, empty and error states. `task-2026-11-10-6-project-settings-ux.md` records what the first round settled; review what's changed since and what it left.
- [x] **E. Website docs** (agent). `website/src/content/docs/` against the app as it is: wrong or stale statements, 1.1.0 features that are missing, and whether the settings pages give a writer the mental model they need (what's detected, what's set, where each setting lives, and why). Suggest cuts as well as additions.
- [x] **F. Developer docs and code comments** (agent). `docs/developer/`, AGENTS.md and the comments in changed code: accurate, evergreen (no history, no PR numbers, no "now" or "new"), one place per fact (see `docs/README.md`), and no bloat, including docs that describe what the code visibly does.
- [x] **G. Release notes** (by hand, then an agent). The draft below against `git log v1.0.20..main` and the issues closed since: anything missing, wrong or overstated, and the order. Then a cold read against Danny's writing guide.

### Findings

Checked against the code. Marked *(1.0.20)* where it was already in the last release. "Plausible" means the code path is real but the timing wasn't reproduced.

**Data safety**

1. **Undo straight after switching files writes the previous file's text into the new one.** Loading a file goes into CodeMirror's undo history (`Editor.tsx:246-313` dispatch without `addToHistory: false`), so ⌘Z after opening B brings back A's text, marks B dirty, and auto-save writes it to B. *(1.0.20)* Fix: a fresh `EditorState` per file, and keep programmatic loads out of history.
2. **Close File throws away unsaved edits.** `closeCurrentFile` clears `isDirty` without saving; the palette's Close File and Ctrl+W (Windows, Linux) call it directly. Keystrokes typed during a project switch are dropped the same way. Fix: user-facing closes save first and stay open if the save fails.
3. **Deleting the open file leaves it open, and the next save recreates it** (`context-menu.tsx:198`). A failed delete is only logged. Fix: close it without saving after a delete; toast on failure.
4. **Renaming the open file from the sidebar skips the rename guard** (`LeftSidebar.tsx:195`): no save first, no `renameUnderWay`, so an auto-save mid-rename can write the old file back. Fix: route it through `lib/files/rename.ts`.
5. **Editing any frontmatter field unquotes date-like strings.** serde_norway writes `version: "2024-01-01"` as `version: 2024-01-01`, which Astro reads as a date, so a `z.string()` field fails the build. *(1.0.20)* Fix: quote strings that look like YAML timestamps unless the schema says the field is a date.
6. **Saves aren't atomic.** `std::fs::write` truncates first, so a full disk or a save cut off at quit can leave the file empty or partial (`files.rs:349`). *(1.0.20)* **Dropped:** an editor should write the file itself, as VS Code does, and replacing it changes its inode, which is surprising. The risk is small and nobody has reported it.
7. **Reset All Preferences deletes recovery files too** (all of `AppLocalData`), and restarts without saving the open file. *(1.0.20)*
8. **Async inserts can land in a file opened meanwhile** (plausible): a dropped image, or the component builder's planned imports (`setImports`), after the open file changes. `ImagePicker` already guards against this.
9. **Overlapping saves of the same file can land out of order** (plausible), leaving older text on disk with the file marked clean. Fix: one save at a time, queueing the next.

**Bugs**

10. **An inline loader is described as unreadable.** `loader: async () => []` or `loader: { name, load }` (both standard Astro) say "couldn't be read, perhaps because it's in another file". `read_loader` (`content_config/mod.rs:344`) returns no name for anything that isn't a call.
11. **AstroPaper's folder can't be read.** `base: \`./${BLOG_PATH}\`` (and `'./' + X`) is unreadable (`string_value`, `content_config/mod.rs:436`), so the folder is guessed, with a warning; older AstroPaper puts posts elsewhere, so the guess is wrong. Fix: evaluate templates and `+` whose parts resolve to strings.
12. **A project moved while open traps the file.** Every auto-save fails (with a toast and recovery files each time), and switching projects is refused with only a log line. Fix: say why, and offer to switch anyway since recovery data is written.
13. **Global settings changes overwrite each other.** `updateGlobalSettings` merges into the store's old value and sets it after saving, so a colour picker drag or quick toggles can save an in-between value. Fix: as `updateProjectSettings` does.
14. **YAML field (really JSON) loses its text** when an edit parses to `[]` or `""`, which deletes the key and resets the draft.
15. **The folder fallback with the content folder set to `.`** makes `node_modules`, `dist` and `public` collections and watches all of `node_modules`.
16. **Quick project switches show "Failed to stop file watcher"**, and can leak a set of watcher listeners (plausible), so events are handled twice.
17. **A project on a disconnected drive invites Locate…** on Enter, and the startup toast says it "may have been moved or deleted".
18. **Symlinked collection folders**: the last entry and deep links don't resolve, and outside changes to the open file aren't matched.
19. **Collections spread into the export** (`{ ...docs, blog }`) vanish silently; the "part of the config couldn't be read" warning can never show.
20. **Nested frontmatter objects come back with their keys sorted** after any frontmatter edit (only top-level keys follow the schema).
21. **A UTF-8 byte-order mark** shifts swc's spans, garbling schema helpers and component props, and hides frontmatter after it.
22. **Path checks:** `scan_directory`, the count and listing commands, `new_file_name` and `load_file_based_collection` don't use `validate_project_path`; `copy_file_to_assets` creates folders before checking them and leaves a 0-byte file if the copy fails; a dangling symlink passes validation.
23. Smaller: reopening the open file blanks and reloads it (cursor jumps to the top); deep links set broken settings files aside without a toast; a config change during a settings rescan can skip closing the open file (plausible); removing or replacing a project deletes its settings before the registry write; an empty `---\n---` block is dropped on save; CRLF files become LF.

**Performance**

24. **The watcher loop blocks a tokio worker** for as long as a project is open (`watcher.rs:182`). *(1.0.20)*
25. **Every scan canonicalises every registered project's path under the preferences lock**, so one project on a stale network mount can hang every scan and settings write. Fix: match by stored canonical string.
26. Each ⌘N and rename parses every file in the collection for `slug`s, listings parse whole files for frontmatter, and the Zod parser recompiles its regexes per call (#374 covers some).

**UX**

27. **Preferences hasn't had Project Settings' copy pass**: Title Case labels, "Global Settings" (Project Settings says "Global preference"), "Choose your preferred color theme", missing full stops, "e.g.", a breadcrumb.
28. **Project Settings has three icons**: the file list footer uses a cog (Preferences' General uses the same), the Preferences sidebar uses `FolderCog` (rejected in task 6), the dialog uses the project's identity.
29. **"Edited as YAML"** in the schema view, for fields that are edited as JSON (`field-control.ts:35`, `schema-system.md`, `project-settings.mdx:120`).

**Website docs** (the reviewer's 25 items, the main ones)

30. Wrong: the no-schema fallback "handles most everyday schemas" (it only finds `image()` and `reference()`); stale component builder shortcuts; troubleshooting's log tags; auto-save delay stated as fixed; recovery folders described as crash and short-lived; `{slug}`'s fallback; "run `astro sync` and reopen the project"; the date field rule with a schema.
31. Missing: saving before quitting and switching; the 1.0 settings reset outside Advanced Preferences; the file list's collection status icons and dimmed rows; project list shortcuts; that skipped files aren't entries.
32. Mental model: a short "how settings work" at the top of Project Settings (read from Astro / set by you, stored on this computer and not in the repo / Preferences are about you); what to do for each status; the trade-off of setting a value (it's pinned); "Overrides" repeats Project Settings under an old name.
33. Cuts: the Advanced tab described twice; about 700 words on how imports are computed; six ways into Project Settings.

**Developer docs and comments**

34. Wrong: the palette's dependency list (`commands-and-shortcuts.md`), "Windows and Linux have no native menu", `testing.md` on the test projects, log tags (`agent-tooling.md`), `editor-styles.md` vs `Editor.css`, `bindings.rs:25` ("the frontend never sends these structs").
35. Evergreen: bug stories in `editor.md`; "compiled manually by Danny" in `editor-styles.md`; history in about a dozen comments; commented-out `fix_path_env`.
36. Duplication and bloat: `app-data.md` has grown a Project Settings walkthrough that overlaps `ui-patterns.md`; menu rules in three places; `releases.md` re-describes `release.yml`.
37. Gaps: `eprintln!` in `mdx_components` never reaches the log; dead fields (`referenceCollection`, `nestedFields`, `editorSelection`); `read_file_content` duplicates `read_file`.

**Release notes**

38. Accuracy: nothing wrong or overstated. #375 and #352 were closed as won't-do, so leaving them out is right. Worth adding under the hood: the unused file-system plugin and its broad permission are gone. Optional: Windows paths (#371).
39. Writing (cold read against the writing guide): "Before you upgrade" gives no action and mixes two points; several improvements don't say what was different before; some improvements are really fixes; bug fixes use two formats; headings use four forms; a few overloaded sentences (Project Settings, imports, new files' frontmatter).

## Phase 3: Triage and fix

- [x] Go through the findings with Danny: fix now, open an issue, or drop. Fixes are done on `main`, a commit per group, in this order: data safety, bugs, performance, UX, docs, release notes.

**Decisions**

- **Data safety:** fix 1, 2, 3, 4, 7, 8 and 9. Drop 5 until someone reports it (it's been there since 1.0, and editing the YAML in place for #370 would fix most of it) and 6 (an editor should write the file itself).
- **Bugs:** fix 10–15, 17 and 20 (try serde_json's `preserve_order`; an issue if it ripples). 16: fix the false toast, drop the listener leak. 19: comment on #288 and delete the dead warning branch. 22: validate paths in the five commands, check the assets folder before creating it, and delete the empty file when a copy fails; drop the dangling symlink. 23: fix the deep link's silent set-aside and the delete order in remove and replace; drop the rest. Drop 18 and 21 until someone reports them.
- **Performance:** fix 24 (`block_in_place` around `recv_timeout`) and 25 (canonicalise a stored path only when its folder name matches, ignoring case). 26: keep the parser's regexes in a `LazyLock`, and add the listings and import planning to #374.
- **UX:** fix 27 (Preferences copy, layout unchanged), 28 (the project's own icon for the file list footer's Project Settings button and Preferences' link, so the cog only ever means Preferences) and 29 ("Edited as JSON", and `YamlField` renamed to match).
- **Docs:** fix 30–37, after the code, so they describe the fixed behaviour (including "closing saves first"). "Overrides" becomes "Settings Reference" at `/reference/settings/`, redirected from the old URL. Two agents, one for `website/` and one for `docs/developer/` and code comments, with Danny reviewing their diffs.
- **Release notes:** last. Add the file-system plugin's removal under the hood (not #371), apply the writing review, and add this round's fixes that affect people.

**Fixes**

- [x] Data safety: 1, 2, 3, 4, 7, 8, 9
- [x] Bugs: 10–17, 19, 20, 22, 23
- [x] Performance: 24, 25, 26
- [x] UX: 27, 28, 29
- [x] Docs: 30–37
- [x] Release notes: 38, 39

## Phase 4: A note for danny.is

- [x] A short note (not a full article) on what's new in 1.1.0, with screenshots and the release video. Take the screenshots from the dev app (`bun run app shot`).

## Phase 5: Prerelease

- [x] Build a prerelease and use it as my real copy of AE. [v1.0.21-test.1](https://github.com/dannysmith/astro-editor/releases/tag/v1.0.21-test.1), built from `bc19af17`, with the release notes as its body.
  - [x] Before installing, copy `~/Library/Application Support/is.danny.astroeditor` somewhere safe. Copied to `~/Library/Application Support/is.danny.astroeditor.backup` (2026-11-10). To restore: quit the app, rename `is.danny.astroeditor` aside, and rename the backup to `is.danny.astroeditor`. Delete the backup once 1.1.0 has settled in.
  - [x] Each project's old settings file is renamed to `*.v2.json` the first time it opens. The Review toast only appears where something can't be read.
  - [x] Note every setting you had to set again, for the release notes. None: the real projects' 1.0 files held only the default field names, which are detected now. The settings in dannyis' new file (file name and link URL patterns, `projects`' `byline` and `startDate`) are new choices.
  - [x] Every project you'd opened before is in the project list; ones that have moved show as Missing. `danny-is-astro`, whose folder is gone, showed as Missing and was removed.
- [x] Comment on the closed issues and PRs that 1.1.0 addresses: #149, #81 (cc bdukes) and PR #158, linking the prerelease.

## Phase 6: Release

In order.

1. [x] **Use the prerelease on my real sites for a few days.** Fix anything that comes up on `main`, and make another test build with `bun run test-build "<note>"` if it's worth checking.
2. [ ] **Edit the release notes** (the draft below).
3. [ ] **Commit this doc to `main`.** `prepare-release` refuses a dirty working tree.
4. [ ] **Release.**
   - On an up-to-date `main`, run `bun run prepare-release v1.1.0`. Without the version it proposes 1.0.21.
   - When `release.yml` finishes, paste everything below the `---` in the draft notes into the draft release, and publish it.
   - Check that the website's page appears (`publish-release-notes.yml`), and that the installed prerelease offers the update.
5. [ ] **Close the roadmap epic, #354.** It's already updated, with v1.1.0 under "Shipped" and a "Still open" list. Remove the line saying it's being tested as a prerelease, then close it.
6. [ ] **Publish the note on danny.is:** set `draft: false`, then commit and push there.
7. [ ] **Post about it** on the Astro Discord and on Bluesky, linking the note.
8. [ ] **Tidy up.**
   - Delete the test build: `gh release delete v1.0.21-test.1 --cleanup-tag`.
   - Once 1.1.0 has settled in, delete `~/Library/Application Support/is.danny.astroeditor.backup`.
9.  [ ] **Close this task:** move it to `docs/tasks-done/task-YYYY-MM-DD-8-reviews-and-release.md`, and commit to `main`.

## Release notes for 1.1.0 (draft)

For the GitHub release; the website's release page is generated from it. Covers everything since v1.0.20. Links are absolute so they work in both places.

---

This is the biggest release since 1.0.0. Astro Editor now finds your collections from your content config, has a Project Settings window and a project list, can name new files from their titles, and gives you a form for each MDX component's props.

**If you're upgrading from 1.0:** project settings from 1.0 aren't carried over. The first time you open each project, its old settings file is set aside as `<project-id>.v2.json` in `~/Library/Application Support/is.danny.astroeditor/preferences/projects/` and the project starts with no settings. Most projects won't need any, because collection folders and frontmatter fields are now read from the project itself. None of mine needed setting up again.

Projects are now remembered by their folder, so one you've moved shows as **Missing** in the project list until you point it at the new folder. See [Moved projects](https://astroeditor.danny.is/file-management/overview/#moved-projects).

### Collections from your content config

Astro Editor used to assume every collection lived in `src/content/<name>`. It now reads each collection's folder and file pattern from its loader, as Astro does. That covers `glob()` with any `base` and `pattern`, Starlight's `docsLoader()`, and legacy collections. Content outside `src/content` works, and files your pattern leaves out (like `_draft.md`) are hidden, or shown dimmed if you turn on **Show files Astro skips**. (#361)

### Project Settings

Project and collection settings have moved out of Preferences into their own **Project Settings** window. It shows what Astro Editor found for each collection: where it lives, which frontmatter fields it uses for the title, date, description and draft, and its schema. Anything it couldn't work out is flagged, such as a missing folder or a schema that needs `astro sync`, so you only change what it got wrong. Open it with the project's icon at the top of the file list, or **Project Settings** at the bottom. See [Project Settings](https://astroeditor.danny.is/project-settings/). (#82)

### Project list

<kbd>⇧⌘O</kbd> opens a list of every project you've used, with each site's favicon. Search it, switch projects, remove ones you're done with, and point moved ones at their new folder. See [Opening a project](https://astroeditor.danny.is/file-management/overview/#opening-a-project).

### File names from a pattern

Each collection can name new files with a pattern, like `{YYYY-MM-DD}-{title}` or `{title}`. A new file is named once you've written its title. There's also a **Rename File from Pattern** command, and when you change a file's date, a link under the date field renames the file to match. See [File names](https://astroeditor.danny.is/project-settings/#file-names). (#87)

### Forms for MDX components

Pick a component with <kbd>⌘/</kbd> and you get a form for its props, built from their types: text boxes, number fields, switches, dropdowns, date pickers and lists. Image props get an image picker, and props that take a collection entry get an entry picker. It reads props from Astro, React, Vue and Svelte components, and in Starlight projects it offers Starlight's own components too. See [The MDX component builder](https://astroeditor.danny.is/editor/mdx-components/). (#350)

### Adding imports (experimental)

An MDX file has to import every component it uses. Turn on **Add imports** in Project Settings and the builder adds the imports for you (the component's, and any image or collection entry it uses), written the same way your site already writes them. It's off by default. Leave it off if your site uses Astro Auto Import. See [Adding imports](https://astroeditor.danny.is/editor/mdx-components/#adding-imports). (#357)

### Saving when you quit

Quitting waits for your work to save, however you quit: <kbd>⌘Q</kbd>, the Dock, logging out or shutting down. If the save fails, it asks before quitting. Closing a file and switching projects save first too. (#364)

### Other improvements

- **Back where you left off** – Opening a project reopens the file you last had open in it, if it still exists. (#373)
- **New files' frontmatter** – Required fields with no sensible empty value (text, numbers, choices, images, references) are left for you to fill in, rather than given `""` or `0`, which looked filled in but could fail your site's build. The frontmatter panel marks them required, and Astro's build names any you miss. (#372)
- **Undoing a frontmatter edit** – Changing a field and changing it back, or turning a switch on and off again, leaves the file exactly as it was, formatting and all. (#370)
- **<kbd>⌘W</kbd>** – Closes the window, as the red button does. It used to close the open file.
- **Running `astro sync` with a project open** – Astro Editor picks up the new schemas without you reopening the project.
- **Lists of images** – Each item gets its own image picker.
- **Settings files that can't be read** – They're set aside as `<name>.broken-<date>.json` rather than written over, and Astro Editor tells you it's done this.

### Bug fixes

- **Windows** – The app crashed on launch. (#351)
- **Reference fields and content links** – These wrote Astro Editor's own IDs (`articles/first-article`) where Astro expects `first-article`, and ignored `slug` frontmatter. They now write the IDs Astro uses.
- **Undo after switching files** – Undoing straight after opening another file could bring back the previous file's text, which was then saved over the new one.
- **Close File** – It threw away anything typed in the last couple of seconds. It now saves first.
- **Deleting the open file** – The file stayed open, and the next save brought it back.
- **Changes made outside the app** – The file list didn't update when files were added, changed or removed outside Astro Editor, its file counts went wrong, and **Reload Collections** didn't work.
- **Zod 4 schemas** – Tuples, literals, unions and nullable objects stopped a collection's schema from loading.
- **Window size** – With displays of different resolutions, the window could reopen at twice its size. It now opens at the same size on every display, and on one that's connected if its last display is gone.
- **Multi-line text** – Editing a text field whose value had line breaks joined its lines.
- **Command palette** – Search only matched part of some commands' names, so "blog" didn't find **Open Collection: blog**.
- **Sort order** – Sorting by title or file name started Z to A. It now starts A to Z, and sorting by date starts with the newest.
- **Dates with times** – Editing any frontmatter field cut every date with a time, like `2024-06-15T14:30:00Z`, down to the date.
- **Dates in new files** – These were quoted, so `z.date()` rejected them, and fields inside objects got stray dotted keys like `sponsor.name:`. (#372)
- **References to `file()` collections** – The entry picker was empty when the collection's file held its entries as an object keyed by ID, or an entry had a numeric ID or no ID. It now reads these as Astro does, and reads YAML files too. (#376)
- **Blank line before the frontmatter's closing `---`** – This was dropped when only the body was edited.
- **Content Finder** – It searched the `title` field even when a collection uses a different one.
- **JSON field** – It reverted text while you typed it, if it wasn't valid JSON yet.
- **Full screen** – <kbd>⌃⌘F</kbd> entered full screen but couldn't leave it.
- **Date picker** – It opened on the current month instead of the field's date.
- **Empty defaults** – Defaults like `.default('')` showed a bare "Default:" under the field.
- **List limits** – These were shown as characters instead of items.
- **Image previews** – They flashed the previous image.
- **Images copied into your project** – Dots in the file name were kept. They now become dashes, as spaces do.
- **Copy as slug** – It dropped accented letters entirely, so "Café" became `caf`. It now drops just the accent: `cafe`.

### Under the hood

- The unused file-system plugin, and the broad file access it was granted, are gone.
- A security update for `zip`, used by the updater on Windows and Linux.
- Dependency updates.
