# Manual testing before release

The checks for the project model (#361), the project list and project settings (#82) and file naming (#87) that need a person: real timing, native dialogs and pickers, drag and drop, and real projects. Everything else was tried by driving the dev app (see **Checked in the dev app** below). Steps 1–9 use `temp-test-projects/personal-site`, a realistic site whose README says what each collection is for. Tick a step when it passes. When one doesn't, add a line to **Found** and carry on.

Settings live in the dev app's data (`~/Library/Application Support/is.danny.astroeditor.dev/preferences/`), not in the projects, so resetting a project's files doesn't reset its settings. Remove from Astro Editor in the project list does.

## Setup

- [x] Run `bun run reset:testprojects` and `bun run reset:testdata`.
- [x] In the dev app's project list (⇧⌘O), remove any earlier entries for `personal-site`, `unusual-structure` and `starlight-minimal`, so they start with no settings.
- [x] Set Preferences > General > default file type to **Markdown**.
- [x] Keep a Finder window open on `temp-test-projects/personal-site` to watch files being added and renamed.

## Data safety

- [x] **Saving before a folder change:** set journal's Folder to `writing/journal`, open `2025-05-02.md` and type something, then straight away press Reset on journal's Folder. The edit is on disk before the file closes, and journal goes back to Not in the File List. [NOTE: actually do this fast enough to test this out so I think we're probably fine here ]
- [x] **Settings survive a restart:** map notes' fields (Title `name`, Published Date `created`), quit the dev app and start it again. They're still set.
- [x] **New file, then click away:** set blog's File Names to Date and title. ⌘N, type a title, then click straight onto another file in the sidebar. Nothing is lost, and there's one copy of the new file, under one name or the other.
- [x] **New file, then type straight on:** ⌘N, type a title, click into the body and type at once. Everything typed is in the renamed file, and the date-named file doesn't come back. Restart the dev app to check.
- [x] **Undo:** after a rename, ⌘Z in the title or body doesn't do anything odd.

## Images

Use a test image from your Desktop, and check where it was copied in Finder and the path written in the file.

- [x] **Default:** drag it into `2025-01-12-hello-again.md`. It's copied to `src/assets/blog/<today>-<name>.png` and written as `../../assets/blog/…`. In `2024/2024-11-02-moving-house.md`, the path is `../../../assets/blog/…`.
- [x] **A collection's own folder:** set notes' Assets Folder to `src/notes-media` and turn on absolute paths for notes only. A note's image goes to `src/notes-media/notes/` as `/src/notes-media/notes/…`, while blog's are unchanged.
- [x] **public/:** set blog's Assets Folder to `public/uploads`, with absolute paths. Astro serves that file at `/uploads/blog/…`. I expect AE to write `/public/uploads/blog/…`, which won't work on the site. Note what it writes.
- [x] **The frontmatter image picker:** on a blog post's `cover`, pick a file from the Desktop: it's copied like a dragged image. Pick `src/assets/blog/2025-03-04-lake.png`: it isn't copied, and the path points at it.
- [x] Reset the image settings.

## Native dialogs

- [x] **Choose… outside the project:** on any folder setting, choose a folder outside the project. A toast says to choose one inside it, and nothing changes. Cancel in the picker changes nothing either.
- [x] **A moved project:** `cp -R temp-test-projects/personal-site temp-test-projects/personal-site-2`, open it, and set something. Rename the folder to `personal-site-moved`, then open the list: it shows as Missing. Enter (or Locate…) opens the folder picker, and picking the new folder opens it with its settings as they were.
- [x] **Remove:** Remove from Astro Editor… (and ⌘⌫ on the highlighted project) asks first. Cancel keeps it; Remove takes it out of the list. It's disabled for the open project.
- [x] **Clear for removed collections:** in the config, rename the `notes` key to `jottings`. Clear under Settings for Removed Collections asks first: Cancel keeps them; Clear removes them. Rename the key back.

## Your own sites

Settings are stored in the app, not the repo, so the only changes to a site are files AE creates or renames. Check `git status` is clean before starting, and use it afterwards to see exactly what changed. `git restore` and `git clean` undo it.

- [x] **dannyis-astro-content:** set it up the way you'd really use it, then write one note from start to finish: a new file, a title, an image, a component and a link. Set up; its `atprotoLoader()` collections showed as errors, which led to the Other Loaders group.
  - Set articles and notes to `{YYYY-MM-DD}-{title}`, and projects to `{title}`.
  - Map projects' Description to `byline` and Published Date to `startDate`.
  - Set a Link URL Pattern for articles.
  - Keep Add Imports off: the site auto-imports components, and a manual import breaks its build.
  - Its image folders (`src/assets/articles`, `notes`, `projects`) are AE's default, so an image dragged into an article should land in `src/assets/articles/` with no setting at all.

The upgrade check, with the prerelease in the real app, moved to task 8.

## Checked in the dev app

Tried by Danny: first open, field mappings, a collection folder override, files the pattern leaves out, the default and Date and title file names, and the MDX components folder.

Tried by Claude, driving the dev app on fresh copies (`temp-test-projects/check-*`), all passing:

- **File name patterns:** `/`, `\`, `:` and a leading `.` are refused and not saved; `{YY}{MM}{DD}-{title}`, `notes-{title}` and `{D}-{M}-{YYYY}` give the right examples; a preset saves.
- **Clashes:** a blog file titled "Reading" became `reading-1.md` (another post's `slug: reading`), and a note titled "TEA" became `tea-1.md` (`tea.md` exists). A new note got its `created` date through the mapping.
- **Rename File from Pattern:** with Date, `on-walking.md` became `2025-02-14.md` from the mapped `created` date, and with the mapping reset, `tea.md` took today's date. On blog, "already named" with Date and title; `2024/moving-house.md` with Title, kept in its folder; `slug` untouched.
- **docs:** a new page is `<today>/index.mdx` (MDX despite the Markdown preference). Its title renamed the folder to `deploying-site/`, which renaming no longer does (see Found).
- **journal:** the Folder override typed in; a new entry is `<today>.md`; Rename file to match took `2025-05-01.md` to `2026-11-03.md`, then to `2026-11-09-1.md` when the date was taken.
- **Link URL Pattern** `/blog/{slug}`: links went to `/blog/reading` (the slug), `/blog/2024/moving-house` and `/blog/2025-01-12-hello-again`.
- **Default Sort** by title, and **New Files** set to MDX for blog.
- **Two copies of one site** keep separate settings.
- **A renamed collection's** settings show under Settings for Removed Collections, and come back when it's renamed back.
- **An unreadable pattern** (`*.@(md|mdx)`) gives a warning in both sidebars and falls back to every Markdown file not starting with `_`.
- **A schema that hasn't been generated:** the status says to run `astro sync`, the field dropdowns offer the files' keys, and the form shows them as text.
- **unusual-structure:** posts' Draft maps to `unpublished`; guides makes `.mdx`; field-notes leaves out `README.md` and `archive/`; feed is found by name.
- **starlight-minimal:** a titled page in `guides/` became `guides/writing-first-page.md`.

## Found

Add a line for anything that didn't pass: what happened, and what you expected.

- **The Content Finder ignores the title mapping.** It lists and searches notes by file name, though notes' title is mapped to `name`. The link it inserts does use the mapping. `ContentLinkerDialog.tsx` calls `resolveTitle(file)` without the collection's title field. Fixed.
- **Renaming a file in its own folder renamed the folder,** and CodeRabbit found it could move other entries with it: with `**/*.md`, renaming `2024/index.md` moved everything in `2024/`. Fixed: renaming only ever changes the file's name, and `index` files, which Astro names by their folder, are never renamed.
- **The date picker opens on this month,** not the field's date, so changing `2025-05-01` means paging back eighteen months (`ui/date-picker.tsx` sets no `defaultMonth`). Not new. Fixed.
- **Copying a test project into the checkout reloaded the dev app,** because Vite saw a new `tsconfig.json`. Fixed: `vite.config.ts` now ignores `temp-test-projects/`.
- **Collections with a custom loader showed as errors.** dannyis-astro-content's `books` and `scrobbles` use `atprotoLoader()`, which fetches from an API, so AE couldn't find a folder and reported an error, with the review toast. Fixed: a collection whose loader AE can't read and whose folder it can't find is listed under Other Loaders, with no status.
- **⌘N right after a new file was renamed showed that file's title.** File content was cached by path, and the second new file took the first one's date name, so it opened with the first one's cached frontmatter and was renamed from it. Fixed: opening a file, or following a rename, always reads it from disk.
