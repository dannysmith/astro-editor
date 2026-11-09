# Manual testing before release

A test plan for the project model (#361), the project list and project settings (#82) and file naming (#87). Most of it is in `temp-test-projects/personal-site`, a realistic site whose README says what each collection is for. Each step says what to do, then what should happen. Tick a step when it passes. When one doesn't, add a line to **Found** at the bottom and carry on.

Settings live in the dev app's data (`~/Library/Application Support/is.danny.astroeditor.dev/preferences/`), not in the projects, so resetting a project's files doesn't reset its settings. Remove from Astro Editor in the project list does.

## 0. Setup

- [ ] Run `bun run reset:testprojects` and `bun run reset:testdata`.
- [ ] In the dev app's project list (⇧⌘O), remove any earlier entries for `personal-site`, `unusual-structure` and `starlight-minimal`, so they start with no settings.
- [ ] Set Preferences > General > default file type to **Markdown**.
- [ ] Keep a Finder window open on `temp-test-projects/personal-site` to watch files being added and renamed.

## 1. First open: what AE works out

Open `temp-test-projects/personal-site` with Open Folder… in the project list.

- [ ] A toast says AE couldn't read all of the project, with **Review**. Review opens Project Settings.
- [ ] The sidebar shows **Collections:** blog, notes and docs; **Not in the File List:** journal, with an error; **Data:** authors and links.
- [ ] **Project page:** it was read from `src/content.config.ts`, and every setting says Default.
- [ ] **blog:** Title, Description, Published Date (`pubDate`) and Draft are all detected in the schema. New Files is the global preference, since the pattern allows both.
- [ ] **notes:** all four fields say Not found, each with a line saying what won't work. New Files is `.md`, from the content config.
- [ ] **docs:** New Files is `.mdx`, from the content config. Published Date and Draft are Not found.
- [ ] **journal:** its folder (`src/content/journal`) doesn't exist, and the error says so.
- [ ] **The file list:** blog shows four posts and a `2024` folder. `_half-finished-thought` isn't there, and Plans for the garden has a draft badge. notes are listed by file name, without dates. Both docs pages can be opened.
- [ ] Close and reopen the project (switch to another and back). No toast this time.

## 2. Field mappings

In Project Settings > notes, with `tea.md` open in the editor.

- [ ] Set **Title** to `name`. It says "Set by you · Reset". Without reopening anything, the file list shows note titles instead of file names, and `name` is the title field in the frontmatter panel, with Copy as slug.
- [ ] Set **Description** to `summary`. It gets the tall text box.
- [ ] Set **Published Date** to `created`. Notes are dated in the file list and sorted newest first, and `created` has a date picker.
- [ ] Set **Draft** to `hidden`. Why I keep a notebook gets a draft badge, and the drafts filter hides it.
- [ ] Each dropdown only offers fields of the right type: strings for Title and Description, dates for Published Date (`created`, `updated`), and booleans for Draft.
- [ ] Reset **Draft**. The badge goes, and the setting says Not found again. Set it back.
- [ ] Switch to `temp-dummy-astro-project` and back: the mappings are still there. Restart the dev app: they're still there.

## 3. Folders AE can't find

- [ ] **Collection folder:** on journal's page, set Folder with Choose… to `writing/journal`. Journal moves to Collections, the file list shows three entries, and Published Date is detected as `date`.
- [ ] Open `2025-05-02.md` and type something, then straight away press Reset on journal's Folder. The file is saved before it's closed (check the file on disk), and journal goes back to Not in the File List.
- [ ] **Content folder instead:** on the project page, set Content Folder to `writing`. Journal is found by name (its Folder says where from), while blog, notes and docs are unchanged because their loaders say where they are. Reset Content Folder.
- [ ] **A folder that doesn't exist:** type `src/content/blogg` into blog's Folder. Blog gets an error and leaves the file list. Reset fixes it.
- [ ] **Outside the project:** choose a folder outside the project with Choose…. A toast says to choose one inside it, and nothing changes. Cancel in the picker changes nothing either.
- [ ] **No readable config:** in Finder, rename `src/content.config.ts` to `content.config.ts.off`. Without reopening the project, the project page says there's no content config, and the collections are blog and notes (the folders in `src/content`), without schemas. Set Content Folder to `writing`: now it's journal. Reset Content Folder and rename the file back. Everything returns as in section 1, along with the settings you made.

## 4. Files the pattern leaves out

- [ ] **blog:** set Files the Pattern Leaves Out to show them dimmed. `_half-finished-thought.md` appears dimmed. It opens and saves like any file, but isn't offered in the Content Finder (⇧⌘K) or in a reference picker.
- [ ] **notes:** set the same. An `archive` folder appears, with `old-note` dimmed inside it. In `archive`, ⌘N says new notes can't go there and creates nothing.
- [ ] Set both back to hide them. `archive` disappears too, since it has no entries.

## 5. New files and file names

Create each file with ⌘N from the collection's root, and check the name in Finder.

- [ ] **blog, default pattern:** two new files are `<today>.md`, then `<today>-1.md`. Delete them.
- [ ] **blog, Date and title:** ⌘N, type the title "A day in the hills", then press Tab. A toast says the file was renamed to `<today>-day-hills.md`, and the sidebar still has it selected. Change the title: no second rename.
- [ ] **blog, Title:** ⌘N and the title "Reading". It's named `reading-1.md`, because What I'm reading has `slug: reading` and Astro would give both the same id.
- [ ] **notes, Title:** ⌘N and the title "TEA". It's named `tea-1.md`, since `tea.md` differs only in case.
- [ ] **notes, Date** (the default), with Published Date mapped to `created`: run Rename File from Pattern on `on-walking.md`. It's renamed to `2025-02-14.md` (its `created` date, not today). Reset the mapping and run it on `tea.md`: it uses today's date.
- [ ] **docs, Title:** ⌘N makes `<today>/index.mdx`, MDX even though the preference is Markdown. Give it the title "Deploying the site": the folder is renamed to `deploying-site/`.
- [ ] **journal** (with Folder set to `writing/journal` again): ⌘N makes `<today>.md`. Change the date of `2025-05-01.md` to 3 May in the date picker. **Rename file to match** appears, and renames it to `2025-05-03.md`. Change `2025-05-03.md` to 2 May: it's renamed to `2025-05-02-1.md`, because `2025-05-02.md` exists.
- [ ] **Rename File from Pattern:** on blog's `2024/2024-11-02-moving-house.md` with Date and title, it says it's already named that. With Title, it becomes `2024/moving-house.md`, staying in its folder. On What I'm reading, the file is renamed and `slug: reading` is untouched.
- [ ] **Patterns that don't work:** typing `{YYYY}/{title}`, `.{title}` or `{title}:x` shows an error under the field and isn't saved. `{YY}{MM}{DD}-{title}`, `notes-{title}` and `{D}-{M}-{YYYY}` work, and the examples update as you type.
- [ ] **Leaving by clicking another file:** with Date and title, ⌘N, type a title, then click another file in the sidebar. Nothing is lost, and there's only one copy of the new file, under one name or the other.
- [ ] **Typing straight on:** ⌘N, type a title, click into the body and type at once. Everything typed is in the renamed file, and the date-named file doesn't come back. Restart the dev app to check.
- [ ] **Sidebar rename:** rename a file to another file's name: it's refused, and the other file is untouched. Rename one to the same name in different case (`tea.md` → `Tea.md`): it takes.
- [ ] **Undo:** after a rename, ⌘Z in the title or body doesn't do anything odd.

## 6. Images

Use a test image from your Desktop. Check where it was copied to in Finder, and the path written in the file.

- [ ] **Default:** drag it into `2025-01-12-hello-again.md`. It's copied to `src/assets/blog/<today>-<name>.png`, written as `../../assets/blog/…`. In `2024/2024-11-02-moving-house.md`, the path is `../../../assets/blog/…`.
- [ ] **Project assets folder:** set it to `src/images`. Blog images now go to `src/images/blog/`, and the collection's Assets Folder says Project setting.
- [ ] **Collection override:** set notes' Assets Folder to `src/notes-media` and turn on absolute paths for notes only. A note's image goes to `src/notes-media/notes/` as `/src/notes-media/notes/…`, while blog images are still relative and in `src/images/blog/`.
- [ ] **Project absolute, collection relative:** turn on absolute paths for the project and off for blog. Blog stays relative; docs becomes absolute.
- [ ] **public/:** set blog's Assets Folder to `public/uploads`, with absolute paths. Astro serves that file at `/uploads/blog/…`. I expect AE to write `/public/uploads/blog/…`, which won't work on the site. Note what it writes.
- [ ] **Frontmatter image picker:** on a blog post's `cover`, pick a file from the Desktop: it's copied like a dragged image. Pick `src/assets/blog/2025-03-04-lake.png`: it isn't copied, and the path points at it.
- [ ] Reset every image setting, and check the sources go back to Default and Project setting.

## 7. MDX components

- [ ] Open `2025-03-04-weekend-at-the-lake.mdx` and press ⌘/. The builder lists Callout, Figure and YouTube, and not Steps.
- [ ] Open `getting-started/index.mdx`: the same three, since the setting is project-wide.
- [ ] Set MDX Components Folder to `src/components/docs`. Without reopening anything, ⌘/ lists Steps, Tip and ApiTable in both files.
- [ ] Insert ApiTable. `type` is a dropdown of its three values, and `name` and `type` are required.
- [ ] Turn on Add Imports for MDX Components and insert Tip into `getting-started/index.mdx`. The import is `import Tip from '../../components/docs/Tip.astro'`, after the frontmatter. Inserting Tip again doesn't add a second import.
- [ ] Type a folder that doesn't exist. The builder says there are no components, and doesn't fail.
- [ ] Reset both settings.

## 8. Links, sort and file type

- [ ] **Link URL Pattern:** set blog's to `/blog/{slug}`. In a note, ⇧⌘K, find What I'm reading, and press ⌘Enter. It inserts `[What I'm reading](/blog/reading)`, using the slug. For Hello again, it's `/blog/2025-01-12-hello-again`; for Moving house, `/blog/2024/2024-11-02-moving-house`. Reset it: links are relative file paths.
- [ ] **Default Sort:** set blog's to title. The file list starts sorted by title. Change the sort in the sidebar, then reopen the project: it's back to title.
- [ ] **New Files:** set the global preference to MDX. A new blog file is `.mdx` (Global preference), and a new note is still `.md`. Set blog's New Files to Markdown: it's `.md`, Set by you.

## 9. Project identity and settings storage

These cover the old bugs, where projects were matched by `package.json` name and broken settings files were overwritten.

- [ ] **Two copies of one site:** `cp -R temp-test-projects/personal-site temp-test-projects/personal-site-2` and open both. Map notes' Title to `name` in one and not the other. Switching between them, each keeps its own, and the list shows both.
- [ ] **A removed collection:** in the config, rename the `notes` key to `jottings`. notes' settings show under Settings for Removed Collections, and jottings starts with none. Rename it back: the settings return. Rename it again and use Clear: Cancel keeps them; Clear removes them, and the group disappears.
- [ ] **An unreadable pattern:** change notes' pattern to `'*.@(md|mdx)'`. notes gets a warning, and the file list shows its files as AE would without a pattern. Undo the change.
- [ ] **A schema that hasn't been generated:** delete `.astro/collections/notes.schema.json`. notes gets a warning about `astro sync`. The field dropdowns offer the keys the notes have, and the frontmatter panel shows them as text. Restore the file with `bun run reset:testprojects` afterwards (and remove `personal-site` from the list to clear its settings).
- [ ] **A broken settings file:** quit the dev app. Find personal-site's file in `preferences/projects/` (named `personal-site-<id>.json`), and delete its closing brace. Start the app and open the project: a toast says the settings couldn't be read, the file is renamed to `*.broken-<timestamp>.json`, and the project opens with defaults.
- [ ] **A moved project:** rename `temp-test-projects/personal-site-2` to `personal-site-moved`, then open the list. It shows as Missing. Enter (or Locate…) opens the folder picker. Picking the new folder opens it with its settings as they were.
- [ ] **Locate… onto a folder already in the list:** rename it again, open the new folder with Open Folder… first, then Locate… the missing entry onto it. It asks before replacing; Replace keeps the missing entry's settings and removes the other.

## 10. The project list and the dialog

- [ ] **Context menu:** Reveal in Finder, Open in IDE (only with an IDE command set) and Copy Path each work. A missing project has Reveal and Open in IDE disabled.
- [ ] **Remove:** Remove from Astro Editor… (and ⌘⌫ on the highlighted project) asks first. Cancel keeps it; Remove takes it out of the list. It's disabled for the open project, and ⌘⌫ does nothing on it.
- [ ] **⌘O in the list** opens the folder picker.
- [ ] **Opening the dialog:** File > Project Settings… opens it, and with no project open it does nothing. In the list, right-click the open project: Project Settings… closes the list and opens the dialog, and isn't offered on other projects.
- [ ] **Keyboard:** Tab through a collection page, including the dropdowns. Escape closes the dialog and puts focus back in the editor.

## 11. The other test projects

- [ ] **`temp-test-projects/unusual-structure`:** posts' Draft is Not found until you map it to `unpublished`. A new project is `<today>/index.md`, and with the Title pattern its folder is renamed. guides only makes `.mdx`. field-notes leaves out `README.md` and `archive/`. feed is found by name in `src/content/feed`.
- [ ] **`temp-test-projects/starlight-minimal`:** docs is read from Starlight's loader. A new file in a nested folder lands there. File Names with Title works.

## 12. Your own sites

Settings are stored in the app, not the repo, so the only changes to a site are files AE creates or renames. Check `git status` is clean before starting, and use it afterwards to see exactly what changed. `git restore` and `git clean` undo it. Set each site up the way you'd really use it, then write something in it from start to finish: a new file, a title, an image, a component and a link.

- [ ] **dannyis-astro-content:**
  - Set articles and notes to `{YYYY-MM-DD}-{title}`, and projects to `{title}`.
  - Map projects' Description to `byline` and Published Date to `startDate`.
  - Set a Link URL Pattern for articles.
  - Keep Add Imports off: the site auto-imports components, and a manual import breaks its build.
  - Its per-collection image folders (`src/assets/articles`, `notes`, `projects`) are AE's default, so dragging an image into an article should land in `src/assets/articles/` with no setting at all.
- [ ] **maggieappleton.com:**
  - The config is at the legacy `src/content/config.ts`.
  - Every pattern is `**/*.mdx`, so new files are MDX only.
  - Dates are `startDate`, which AE doesn't detect.
  - Each collection has a required `type` literal (`"note"`, `"essay"`…). Check what a new note's frontmatter gets.
  - Components come from two folders, `src/components/mdx` and `src/components/unique`, with explicit imports. Try Add Imports on, compared with how the site writes them.
  - Images are in `src/images`, but in folders by kind (`posts`, `covers`), not by collection. AE always adds the collection's name, so note how close you can get.
- [ ] **astro-editor/website:**
  - Starlight's `docsLoader()` should need no settings.
  - Release pages are named by version, which no pattern can make, so leave File Names alone there.
  - Images are in a flat `src/assets`, and AE will use `src/assets/docs/`.

## 13. Upgrading from 1.0.x (with the prerelease, in the real app)

- [ ] Before installing, copy `~/Library/Application Support/is.danny.astroeditor` somewhere safe.
- [ ] Each project's old settings file is renamed to `*.v2.json` the first time it opens. The Review toast only appears where something can't be read.
- [ ] Note every setting you had to set again. That list goes in the release notes.
- [ ] Every project you'd opened before is in the project list; ones that have moved show as Missing.

## Found

Add a line for anything that didn't pass: the section, what happened, and what you expected.
