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
- [ ] Bugs: 10–17, 19, 20, 22, 23
- [ ] Performance: 24, 25, 26
- [ ] UX: 27, 28, 29
- [ ] Docs: 30–37
- [ ] Release notes: 38, 39

## Phase 4: A note for danny.is

- [ ] A short note (not a full article) on what's new in 1.1.0, with screenshots and the release video. Take the screenshots from the dev app (`bun run app shot`).

## Phase 5: Prerelease

- [ ] Build a prerelease and use it as my real copy of AE.
  - [ ] Before installing, copy `~/Library/Application Support/is.danny.astroeditor` somewhere safe.
  - [ ] Each project's old settings file is renamed to `*.v2.json` the first time it opens. The Review toast only appears where something can't be read.
  - [ ] Note every setting you had to set again, for the release notes.
  - [ ] Every project you'd opened before is in the project list; ones that have moved show as Missing.
  - [ ] Try it on my real sites.

## Phase 6: Release

- [ ] Fill in the `[DANNY: …]` marker and finish the release notes.
- [ ] Release (see `docs/developer/releases.md`).
- [ ] Post the note.

## Release notes for 1.1.0 (draft)

For the GitHub release; the website's release page is generated from it. Covers everything since v1.0.20. Links are absolute so they work in both places. Fill in the `[DANNY: …]` marker after the prerelease check.

---

This is the biggest release since 1.0. Astro Editor now reads where your content lives from your content config, has a project list and a Project Settings window, can name new files from their titles, and the MDX component builder gives you a form for each component's props.

**Before you upgrade:** project settings from 1.0.x aren't carried over. The first time you open each project, its old settings file is renamed to `<project-id>.v2.json` (kept, not deleted) and the project starts with no settings. Most projects won't need any, because collection folders and frontmatter fields are now read from the project itself. [DANNY: the settings you had to set again in the prerelease check, or "None of mine needed setting up again."] Projects are now remembered by their folder, so one you've moved shows as **Missing** in the project list until you point it at the new folder. See [Moved projects](https://astroeditor.danny.is/file-management/overview/#moved-projects).

### Collections are read from your content config

Astro Editor used to assume every collection lived in `src/content/<name>`. It now reads each collection's folder and file pattern from its loader, as Astro does: `glob()` with any `base` and `pattern`, Starlight's `docsLoader()`, and legacy collections. Content outside `src/content` now works, and files your pattern leaves out (like `_draft.md`) are hidden, or shown dimmed if you'd rather see them. (#361)

### Project Settings

Project and collection settings have moved out of Preferences into their own **Project Settings** window. It shows what Astro Editor found: where each collection lives, which frontmatter fields it uses as the title, date, description and draft, and each collection's schema as it reads it. Anything it couldn't work out is flagged, such as a missing folder or a schema that needs `astro sync`, so you only change what it got wrong. Open it from the bottom of the file list or the project's icon at the top. See [Project Settings](https://astroeditor.danny.is/project-settings/). (#82)

### A project list

<kbd>⇧⌘O</kbd> opens a list of every project you've opened, with each site's favicon. Search it, switch projects, remove ones you're done with, and find ones you've moved. See [Opening a project](https://astroeditor.danny.is/file-management/overview/#opening-a-project).

### New file names

Each collection can name new files with a pattern, like `{YYYY-MM-DD}-{title}` or `{title}`. A new file is renamed once you've written its title. There's also a **Rename File from Pattern** command, and a link under the published date to rename a file to match when you change the date. See [File names](https://astroeditor.danny.is/project-settings/#file-names). (#87)

### A form for MDX components

Pick a component with <kbd>⌘/</kbd> and you now get a form for its props, built from their types: text boxes, number fields, switches, dropdowns, date pickers and lists. Image props get an image picker, and props that take a collection entry get an entry picker. It reads props from Astro, React, Vue and Svelte components, and in Starlight projects it offers Starlight's own components too. See [The MDX component builder](https://astroeditor.danny.is/editor/mdx-components/). (#350)

### Adding imports (experimental)

An MDX file has to import every component it uses. Turn on **Add imports** in Project Settings and the builder adds the import for you, copying how your site already imports things, along with any image or collection entry the component needs. It's off by default. Leave it off if your site uses Astro Auto Import. See [Adding imports](https://astroeditor.danny.is/editor/mdx-components/#adding-imports). (#357)

### Saving when you quit

Quitting now waits for your work to save, however you quit: <kbd>⌘Q</kbd>, the Dock, logging out or shutting down. If the save fails, it asks before quitting. (#364)

### Other improvements

- **Back where you left off** – Opening a project reopens the file you had open when you last left it, if it's still there. (#373)
- **Window size** – The window opens at the same size on every display. If it was last on a display that's no longer connected, it opens on one that is.
- **Changes made outside the app** – The sidebar now updates when files are added, changed or removed outside Astro Editor, its file counts stay right, and Reload Collections works again.
- **First `astro sync`** – Schemas generated after a project is open are picked up without reopening it.
- **Zod 4 schemas** – Tuples, literals, unions and nullable objects no longer stop a collection's schema from loading.
- **Lists of images** – Each item gets its own image picker.
- **Multi-line text** – A text field whose value has line breaks keeps them.
- **Command palette** – Search matches the whole of each command's name.
- **<kbd>⌘W</kbd>** – Closes the window on macOS.
- **Settings files that can't be read** – They're set aside as `<name>.broken-<date>.json` rather than written over, and you're told.
- **New files' frontmatter** – Required fields with no sensible empty value (text, numbers, choices, images, references) are now left for you to fill in, rather than given `""` or `0`, which looked filled in but could fail your site's build. The panel marks them required, and Astro's build names any you miss. Dates are no longer quoted, so `z.date()` accepts them, and fields inside objects no longer get stray `sponsor.name:` keys. (#372)
- **Undoing a frontmatter edit** – Changing a field and changing it back, or turning a switch on and off again, now leaves the file exactly as it was, formatting and all. (#370)

### Bug fixes

- **Windows startup crash** – The app crashed on launch on Windows. (#351)
- **Reference fields and content links** – These wrote Astro Editor's own ids (`articles/first-article`) where Astro expects `first-article`, and ignored `slug` frontmatter. They now write the ids Astro uses.
- **Sort order** – Sorting by title or filename started Z to A. It now starts A to Z, and dates newest first.
- **A blank line before the closing `---`** was dropped when only the body was edited.
- **Dates with times** – Editing any frontmatter field cut every date with a time, like `2024-06-15T14:30:00Z`, down to the date. Times are now kept.
- **References to `file()` collections** – The entry picker was empty when the collection's file held its entries as an object keyed by id, or any entry had a numeric id or none. It now reads these as Astro does, and reads YAML files too. (#376)
- **The Content Finder** searched the `title` field even when a collection uses a different one.
- **The JSON field** reverted text while you typed it, if it wasn't valid JSON yet.
- **Full screen** – <kbd>⌃⌘F</kbd> entered full screen but couldn't leave it.
- **The date picker** opened on the current month instead of the field's date.
- **Empty defaults** like `.default('')` showed a bare "Default:" under the field.
- **List limits** were shown as characters instead of items.
- **Image previews** flashed the previous image.
- **Copied image names** kept dots from the original name. They now become dashes, as spaces do.
- **Copy as slug** dropped accented letters entirely, so "Café" became `caf`. It now drops just the accent: `cafe`.

### Under the hood

- A security update for `zip`, used by the updater on Windows and Linux.
- Dependency updates.
