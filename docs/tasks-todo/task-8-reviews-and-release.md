# Task: Reviews & Admin

## Fixes from the astro-editor-plus fork

All dealt with on this branch, apart from two moved to issues (#372, #373). Notes on each item below.

[GustavoGomez092/astro-editor-plus](https://github.com/GustavoGomez092/astro-editor-plus) is a fork built on main at `3af8e9bf`. Comparing it with this branch turned up the bugs below. They were found by tracing the code, plus two small scripts, and none has been reproduced in the app, so reproduce each one before fixing it. The fork's commit is given where its fix is worth reading (`git fetch https://github.com/GustavoGomez092/astro-editor-plus main`).

### Project settings bugs on this branch

- [x] **The sidebar shows a collection's old files after its folder, pattern or skipped files setting changes.** `useDirectoryScanQuery`'s query function holds the `Collection` from the last render, and its key (`queryKeys.directoryContents`) only has the collection's name. `updateProjectSettings` invalidates straight after `rescan`, before React re-renders with the new collection, so the refetch scans the old folder with the old pattern. Switching skipped files from Hide to Show dimmed shows no change. `refreshProjectScan`, which runs when the content config changes, never invalidates the listings at all, so editing a glob's `base` or `pattern` leaves the sidebar stale until something else refreshes it. Put the folder, pattern and skipped files setting in the key, or read the collection from the scan inside the query function. Fork: `aec8b28`. Done: the listings read the latest scan, and a content config change now refreshes them too.
- [x] **Sidebar collection counts never refresh** (main too). `LeftSidebar` loads them in an effect that depends only on `collections`, and a rescan that finds the same collections keeps the same reference, so creating, deleting or renaming a file, in the app or outside it, leaves the count wrong. Make the counts a query under the project key and invalidate it with the folder listings. Fork: `cd56f11`, `6a81179`. Done: a query keyed by the collections' folders and patterns.
- [x] **A preferences file that can't be read is treated as missing, then overwritten.** `read_or_default` and `read_project_file` treat any `read_to_string` error as no file. If the registry can't be read (permissions, not UTF-8), `open_project` writes a new one holding only the project being opened, and every other project is lost. Only `NotFound` should mean missing; anything else should be set aside like a file that doesn't parse. Fork: `f45ae1a`. Done.
- [x] **When `set_aside_broken` can't move a file,** the message still says it was kept, and the next write replaces it. Don't write over a file that couldn't be set aside. Done: `write` won't replace a file it can't read or parse.
- [x] **`Preferences::write` doesn't `sync_all` the temporary file before renaming it,** so a crash or power cut can leave an empty settings file, which is then set aside and the settings reset. Fork: `11b53ee`. Done.
- [x] **`updateProjectSettings` closes the open file even when the save before it failed,** and the toast says it was saved. `openProject` already checks `isDirty` after saving; do the same here. Fixed in `e649e51e`.
- [x] **Two project opens close together can overlap.** `setProject` fires `openProject` without a guard. The open that finishes last starts the watcher for whichever project is current by then, so it can start twice, and because `set()` overwrites the `_unlisten*` handles, every file event is then handled twice. It can also stop a watcher that hasn't started yet and show a false "Failed to stop file watcher" toast. A generation counter in `openProject`, checked after each `await`, covers it. It's rare: it needs two deep links, or quick switches during a slow scan. Fork: `0a4d185`, `a25a729`. Done.
- [x] **A project on an unplugged drive shows as missing,** which invites Remove, and Remove deletes its settings. `list_projects` only checks `is_dir()`. When the path is under a `/Volumes` folder that isn't mounted, say the drive isn't connected instead. Fork: `07eebd3`. Done: it says "Drive Not Connected".
- [x] **A collection whose folder is missing vanishes from the sidebar.** If every collection's folder is missing, the sidebar says "No collections found. Open an Astro project to get started", which is wrong with a project open. Listing them dimmed with their status icon would fix both. Done: listed dimmed, opening Project Settings.
- [x] **One collection folder that can't be watched stops all watching.** `create_project_watcher` returns at the first `watch()` error. Skip that folder and watch the rest. Fork: `08547b4`. Done.

### Remember the last open entry

- [x] When a project opens, reopen the entry that was open when it was last left, if it's still there. The fork stores the entry's path relative to the project in its registry record, writes it a second after the open file changes (and before quitting or switching projects), and reopens it through `resolve_file_entry`. Fork: `useRememberLastEntry` and `lib/projects/last-entry.ts`. Moved to issue #373.

### Editor bugs, on main too

Fix these here or on main straight after this branch merges.

- [x] **Clicking the open file again wipes it.** For a file with no unsaved edits, `openFile` gets past its only guard (`isDirty && currentFile?.id === file.id`) and clears the store. The sidebar passes the same `FileEntry`, so the effect in `useEditorFileContent` (`[data, currentFile]`) doesn't run again and the editor stays blank. The next keystroke saves the typed text with `rawFrontmatter: ''`, and the file loses its frontmatter and body. Return early when the path matches, still dispatching the event that selects the file's collection. `storeQueryIntegration.test.ts` asserts the clearing and needs changing. Fork: `c4b6cd5`, `8b5b120`. Not reproduced: `openFile` now always reloads the file from disk, and the content and frontmatter survive clicking it again.
- [x] **New files can get frontmatter that fails the site's build.** In the frontmatter block of `useCreateFile`: Moved to issue #372.
  - required fields with no default get `''` or `0`, which fail `email`, `url`, `image()`, enums and `reference()`;
  - dates are quoted, so Astro reads them as strings and `z.date()` rejects them (the test project's `z.coerce.date()` hides this);
  - nested required fields are written as literal `sponsor.name:` keys;
  - object defaults come out as `[object Object]`, and `"` in a string isn't escaped.

  Build the values as an object and let the Rust writer serialise them. Decide what a required field with no default should get: leaving it out fails the build too, and a plain `z.string()` passes with `''` but not when it's missing. Fork: `1577a65`, `62df387` (`lib/files/new-file.ts`).
- [x] **Order, Title and Filename start sorted descending** (Z to A, 3 to 1). `DEFAULT_VIEW_STATE.sortDirection` is `'desc'` and `setSortMode` keeps the existing direction. Start dates newest first and everything else ascending. Fork: `4c98f05`, the direction part only. Done.
- [x] **A blank line before the closing `---` is dropped on body-only saves.** `parse_frontmatter` joins the lines between the markers, and `rebuild_markdown_with_raw_frontmatter` skips the newline when the raw text already ends in one. Add a round-trip test: `mdx_corpus_tests` only compares non-blank lines, which is why this got through. Fork: `17eecc0`. Done, with a round-trip test.
- [x] **`.default('')` shows a bare "Default:"** under the field (`FieldWrapper`). Leave out empty defaults (`''`, `[]`, `{}`). Fork: `96318d2`. Done.
- [x] **Check whether multi-line values in text fields get flattened.** `StringField` is an `<input>`, which drops line breaks, so editing a value that has one probably joins its lines. If it does, use `AutoExpandingTextarea` when the value already contains a line break. They did (an `<input>` strips line breaks); such values now get the textarea.

## Reviews 

Tasks 1 and 2 (frontmatter fixes and small follow-ups, then reopening the last entry) each get their own PR first. Once both are merged, come back here and revisit these reviews on main before the release.

Our recent work has made some fairly significant changes to how the app works so we should conduct a series of reviews looking at things like:

- Adverserial review of the whole project management/settings approach.
- UX review of the project settings stuff and making the mental model of how it all works consistent and good. Most of this is now `task-6-project-settings-ux.md`; review what it leaves. Likewise: are our settings pages designed well and designed to help people understand and use them. Also: icons, names etc.
- Full code review of recent changes to check that they are compliant with the architecture guides and other developer guidance and also with what would be considered best practice. might consider having sub-agents also review for performance etc.
- We should do a review of the website documentation. Most of this should have been updated as we go, but we should look at that around the project stuff. We should look for opportunities to better explain the mental model needed when it comes to settings and how this works and what all of these things are for, if necessary and also check that we haven't added too much bloat to the developer docs.
- We should obviously also review the developer docs and code comments to ensure they're evergreen etc.

### How they were run

Three agents reviewed cold, given the code and the developer docs but not the task docs: an adversarial review of the project model and settings, a Rust code review and a frontend code review. The UX, website docs, developer docs and video reviews were done by hand in the dev app (personal-site, unusual-structure, dannyis-astro-content). Every agent finding was checked against the code before it was listed.

### Fixes

- [x] **The schema helper parser can panic** on non-ASCII text before `image()` or `reference()` (`parser.rs` mixes byte offsets and char indexes). Release builds abort on panic and reopen the last project, so the app would crash at every launch.
- [x] **A folder override keeps the pattern's prefix,** so setting `src/content/blog` for `base: 'src/content', pattern: 'blog/**/*.md'` (the placeholder's own value) hides every file and new files can't be named.
- [x] **Negations naming a folder** (`'!drafts'`) don't exclude the files in it, as tinyglobby does.
- [x] **Settings saves race with rescans:** `rescan()` returns a scan already in flight, which may have read the old settings; quick edits overwrite each other; a save that finishes after a project switch stores the old project's settings.
- [x] **Enter in a settings text field commits twice** (Enter, then the blur), so two saves, two rescans and possibly two sets of watcher listeners.
- [x] **A `schema` imported from another file reads as no schema:** no `astro sync` warning, and the page says there's no schema.
- [x] **A `glob()` whose `pattern` or `base` can't be read** gets no warning: an unread pattern becomes "every Markdown file" (the whole project with no `base`), and an unread base becomes a guessed folder presented as the loader's.
- [x] **A collection imported from another file** is described as "a custom loader, which probably doesn't read files".
- [x] **The startup notice that settings were reset can be lost:** `load_preferences` emits it before the toast listener exists. Return it instead, as `open_project` does.
- [x] **Scans can set a broken registry aside silently** (`project_settings_for_path`, documented as read only).
- [x] **Smaller frontend bugs:** the string field loses focus when its last line break is deleted; a settings change shows two toasts and saves a clean file; "Project opened successfully" shows when the open is refused; creating a file rescans the project but doesn't refresh counts; clearing the name pattern leaves the box blank; a favicon that fails once never shows again; the sidebar says "This directory is empty" when the selected collection becomes unavailable.
- [x] **A collection folder created after the project opens is never watched.** The periodic rescan should rescan the project, which restarts the watcher. It now restarts the watcher once its refetch lands, if the folders changed.
- [x] **Docs:** the website's "How projects are identified" describes `package.json` matching; four pages say "in the preferences" for project settings; stale `file()` schema notes in `schema_merger.rs` and `schema-system.md`; `app-data.md` says a lost registry "could be rebuilt".
- [x] **Cleanups and tests:** one assets-copy command instead of two; `useCreateFile` reads the scan with `getCollection`; a test mock of a deleted module; `#[serde(default)]` instead of completing settings files by hand; a sort that runs before collections are reclassified; skipped files' frontmatter read then thrown away. Tests for `isFileListing`, the default sort, `renameNewFileFromTitle` and overlapping collections. `#[serde(default)]` made the fields optional in the TypeScript bindings, so both readers share one lenient parse instead (which also fixes scans and opens reading a partial file differently). The default sort was already tested.
- [x] **UX:** the project list's "Open" badge reads like the Enter action ("Current" now); the sidebar repeats each collection's name as its folder (shown only when it differs); the welcome text asks for a project when one is open.

### To GitHub issues

- [x] A new file or rename reads every file in the collection for `slug`s; scans do blocking IO on the async runtime. #374
- [x] Follow collections imported from other files. A comment on #288, whose "follow relative imports" covers it.
- [x] Adopt orphaned `projects/*.json` files by their stored path when the registry is lost, and don't overwrite an existing `.v2.json`. #375
- [x] Object-form `file()` data as reference targets. #376
- [x] #354 updated with this branch's work and its follow-ups.

### Dropped

- Each frontmatter field running its own scan query: query observers are cheap.
- Canonicalising every registry entry per scan: the registry is small.
- Custom `srcDir`: documented as unsupported.

### Marketing video

The homepage video is still accurate apart from scene F, which shows the old search-and-insert MDX popup. Update that scene to show the props form and the added import; project settings has no visual moment worth a scene. See task 9, which also makes a one-off video of what's new in 1.1.0.

## Admin

- [ ] Any other cleaning up in this repo on GH or here, before I make a release.
- [ ] Write up release notes for next release (which I think will be 1.1.0).
  - Say that project settings from 1.0.x are set aside (renamed to `*.v2.json`), so projects may need setting up again. Most won't, because folders and fields are now detected. List the settings that had to be set again in the upgrade check (task 5).
  - Drafted at the end of this doc. Fill in the `[DANNY: …]` marker after the prerelease check.
- [x] Update the README as needed. The MDX components, file management, Project Settings and supported projects sections now describe 1.1.0.
- [x] Close and consolidate all the GH Issues. Closed #82 and #87 (done in #368), noted on #371 what #368 fixed and what's left, labelled #370, #372, #374, #375 and #376, and ticked #368's items in #354. The rest are the follow-ups from this work, or in the icebox.
- [x] Make a quick video showing off the new features since the last release, and update the homepage video's MDX scene. Done in task 9.
- [ ] Write up a quick blog post for my website showing off the new features, with screenshots and the video we made for the v1.1.0 release.
- [ ] Release a prerelease and test it on my machine as my proper version of AE.
  - [ ] Before installing, copy `~/Library/Application Support/is.danny.astroeditor` somewhere safe.
  - [ ] Each project's old settings file is renamed to `*.v2.json` the first time it opens. The Review toast only appears where something can't be read.
  - [ ] Note every setting you had to set again, for the release notes.
  - [ ] Every project you'd opened before is in the project list; ones that have moved show as Missing.
- [ ] Do the actual release.

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
