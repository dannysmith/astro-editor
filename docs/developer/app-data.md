# App data

What the app stores on the user's machine, where, and how a project's collections and settings are worked out. For the shapes, read `src-tauri/src/models/preferences.rs` (what's stored) and `src-tauri/src/models/collection.rs` (what's resolved).

## Where it lives

Everything is in Tauri's `AppLocalData` folder, named after the bundle identifier:

- **macOS:** `~/Library/Application Support/is.danny.astroeditor/`
- **Windows:** `%LOCALAPPDATA%\is.danny.astroeditor\`
- **Linux:** `~/.local/share/is.danny.astroeditor/` (or under `$XDG_DATA_HOME`)

Dev builds use `is.danny.astroeditor.dev` instead, so they never read or write the installed app's data (see `agent-tooling.md`).

Inside it:

- `preferences/global-settings.json`: app-wide settings (theme, IDE command, auto-save delay, appearance and so on).
- `preferences/project-registry.json`: every project ever opened (id, name, path, dates) and which was open last.
- `preferences/projects/{id}.json`: one project's settings, and its path.
- `recovery/` and `crash-reports/`: see [Recovery Files](#recovery-files).
- `telemetry.json`: the anonymous install ID. Release builds only.
- `.window-state.json`: window size and position, from the window-state plugin.

The webview's localStorage holds a few per-machine conveniences: panel sizes (`panel-v4:*`), a copy of the theme (`astro-editor-theme`) so the theme provider has it before settings load, and a skipped update version. Logs live elsewhere; see `agent-tooling.md`.

## The model

Everything AE knows about a project is one of two kinds of thing:

- **What Astro says:** read from the project on every scan and never stored.
- **What the user chose:** stored, and only when they set something.

Rust combines them: `collections::scan_project` reads the content config (`content_config/`), applies the stored settings and the conventions, and returns a `ProjectScan`. The frontend holds it in the collections query and reads it through `lib/project-scan.ts` and the hooks in `hooks/settings/`. It never resolves a setting itself.

### What Astro says

- **Content config:** the first of `src/content.config.{mjs,js,mts,ts}` that exists, else `src/content/config.{ts,js,mjs,mts}`, in Astro's own order. It's parsed as TypeScript with swc and read statically: the `collections` export, the `defineCollection()` behind each key (following local variables and renamed imports), and the loader inside it.
- **Collection:** a key in the `collections` export. The key is the name (`{ posts: blog }` is `posts`) and names `.astro/collections/<name>.schema.json`.
- **Loader:**
  - `glob({ base, pattern })` loads entries from files. `base` is relative to the project root (default `.`); a `new URL(…, import.meta.url)` base is relative to the config file. `pattern` is a string or an array, where items starting with `!` (not `!(`) exclude files.
  - **No loader** is a legacy collection, which Astro loads from `src/content/<name>` with everything but `_`-prefixed files and folders. When no collection has a loader, Astro also makes a collection of each undefined `src/content` folder, and so does AE.
  - **Starlight's `docsLoader()`** is a glob on `src/content/docs`; its `i18nLoader()` is data.
  - **Data:** `file()`, `i18nLoader()`, legacy `type: 'data'`, and globs whose pattern can only match data files. Not shown as collections. `file()` JSON is still read as a reference target (`load_file_based_collection`).
  - **Unknown:** anything else, like a custom loader, a `base` built from variables, or a collection imported from another file. AE looks for it in `<content folder>/<name>`.
- **Collection folder** (`Collection.path`): what the sidebar browses, `base` plus the pattern's fixed prefix (`blog/**/*.md` on `src/content` is `src/content/blog`). Entry ids and pattern matching stay relative to `base` (`Collection.base`), so `FileEntry.id` is `<collection>/<path from base>` and `astroEntryId` gives Astro's id.
- **Schema:** see `schema-system.md`. Its status is complete, helpers only (no JSON, usually because `astro sync` hasn't run), unreadable (with the error), or none.

A collection whose folder is missing, or outside the project (Astro allows that; AE only reads and writes inside it), is still in the scan with its `folderStatus`, but not in the sidebar (`isBrowsable`).

With no config, or none AE can read, every subfolder of the content folder becomes a schemaless collection (`fallback` in the scan). This is deliberate: it keeps AE useful as an editor for Markdown files on disk.

### Which files are entries

`content_config/pattern.rs` matches like Astro's tinyglobby and picomatch for the forms people write: `*` doesn't cross `/`, `./` prefixes and trailing slashes are ignored. Patterns `globset` can't read (extglobs like `@(md|mdx)`) are reported in `patternError`, and the collection falls back to the legacy pattern, as do collections with no readable pattern.

- **Files the pattern leaves out** are hidden, or shown dimmed when the collection's `skippedFiles` setting is `dim`, because a `README.md` should never show but drafts named `_draft.md` usually should. Dimmed files open and edit like any other, but `FileEntry.is_entry` is false, so the reference pickers and the Content Finder never offer them. With `hide`, folders without entries are hidden too. Files and folders starting with `.`, and `node_modules`, are always skipped.
- **New files must match the pattern,** or they'd be written and never shown. `new_file_name` picks `<stem>.<ext>` or, for folder-per-entry patterns, `<stem>/index.<ext>`, avoiding clashes without regard to case. When no name could match, the new file command says so and creates nothing.

### What the user chose

A project's settings are sparse: a missing key is unset, nothing is ever seeded, and clearing a field removes it (`usePreferences` drops empty values). Each setting has one home; only the asset settings and the new file type have two levels.

| Setting | Home | When unset |
| --- | --- | --- |
| Collection folder | Collection | From the loader; else `<content folder>/<name>` |
| Files the pattern leaves out | Collection | Hide |
| Title, description fields | Collection | A string field named `title` / `description` in the schema |
| Published date field | Collection | The first date field named `pubDate`, `date` or `publishedDate` |
| Draft field | Collection | A boolean field named `draft` |
| Default sort | Collection | Published date, newest first; else title |
| New file type | Collection → global | The global preference |
| File name pattern | Collection | `{YYYY-MM-DD}`: today's date. Applied by `lib/files/file-name-pattern.ts`; Rust picks a free name |
| Link URL pattern | Collection | A relative file path |
| Assets folder | Project → collection | `src/assets`; images go in `<assets>/<collection>/` |
| Absolute or relative image paths | Project → collection | Relative |
| MDX components folder | Project | `src/components/mdx` |
| Add component imports | Project | Off |
| Content folder | Project | `src/content` |

- **Field detection** looks in the schema by name and type. Without a schema, the conventional names apply and are read from each file's frontmatter. A schema without a matching field leaves the setting missing: no draft badge or filter, for example.
- **The pattern decides the file type** when it only matches `.md` or only `.mdx`; the setting matters only when it allows both.
- **A folder override replaces `base`,** and the pattern applies inside it.
- **The content folder** is only used where the loader doesn't say: for unknown loaders and the folder fallback.
- **Default sort** is what the sidebar's Default sort mode does (`sortFiles`). The sort the writer picks in the sidebar stays per session.

Every resolved value carries its source (`SettingSource`): set, project, global, config, schema, convention or missing.

### The project settings dialog

`components/project-settings/` shows how AE has read the open project, and edits its settings. It only ever shows the open project, so it reads the scan and `projectStore.projectSettings` like the rest of the app. Every setting shows its source, with Reset when it's set.

- **Statuses** come from `lib/project-settings/status.ts`, which the dialog's sidebar, the file list's collection rows and the review toast all use. Errors mean a collection can't be used properly: its folder is missing or outside the project, or its schema can't be read. Warnings mean AE has less to go on: no generated schema, an unreadable pattern, or the folder fallback. The file list shows statuses all the time, so things that work are never one: an unknown loader whose folder exists is explained by the Folder setting, and a field mapping with nothing to go on (no `draft` field) is a note on that setting, because plenty of sites don't have one.
- **Field mappings without a generated schema** offer the frontmatter keys the collection's files have, by the type of their values (`frontmatterKeysOfType`), since there are no schema fields to offer. Rust only detects fields in a complete schema; the config's helpers alone don't say which field is the title.
- **How a field is shown** comes from `fieldControl` in `lib/field-control.ts`, which `FrontmatterField` renders from, so the schema view always matches the form.
- **Settings for collections no longer in the config** are listed with a Clear button, except with the folder fallback, when the config's collections aren't known and clearing would lose settings for a config that's only broken for now.
- **The review toast:** `open_project` reports `newSettings` when the project had no version 3 settings file (it's new, or its old one was moved aside). Then, if anything has a status, a toast offers to open the dialog. Otherwise nothing appears.
- **Ways in:** File > Project Settings…, the icon in the file list's header, the palette, the project list's context menu on the open project, and a link in Preferences' sidebar. Switching projects closes the dialog.

## Settings files

`preferences.rs` reads and writes all three files. Writes go through a temporary file and a rename.

- **A file that doesn't parse is never overwritten.** It's renamed to `<name>.broken-<timestamp>.json`, the app carries on with defaults, and a toast says so.
- **Global settings and the registry are read over their defaults,** so a setting added since a file was written gets its default.
- **Project files are version 3.** An older one is renamed to `<id>.v2.json` when first read and the project starts with no settings; nothing migrates them. Each records the project's path, so a lost registry could be rebuilt.
- **Projects are identified by their canonical path.** New projects get an id from their folder name and a random suffix, which never changes. There's no guessing from `package.json` names: opening a moved project's new folder registers a new project, and the old entry shows as missing in the project list until it's located or removed.
- **The project list** (`components/project-list/`) reads the registry with `list_projects`, which is also the only place AE checks that projects' folders exist; nothing is checked at startup. `relocate_project` (Locate…) points an entry at its new folder, keeping its id and settings. If another entry already has that folder, usually because the writer opened it with Open Folder… first, it reports that and changes nothing; with `replace` it removes that entry and its settings first. `remove_project` deletes an entry, its settings file and any `.v2.json`, and never touches the project. The list won't remove the open project, whose settings would otherwise be written again on the next change.
- **Switching projects saves the open file first,** and stays on the current project if that save fails, since closing the file would lose its edits.
- **A settings change can move a collection's files.** `projectStore.updateProjectSettings` rescans, saves and closes the open file if its collection's folder, base or pattern changed, refreshes every file listing, and restarts the watcher if the collection folders moved.
- **The watcher** watches each collection folder, `src/` and `src/content/` (for the content config, including one created later) and `.astro/collections/`. A change to the config or a schema rescans the project.

## Recovery files

When a save throws, the `catch` in `saveCurrentFile` (`useEditorActions.ts`) writes the unsaved content to `recovery/` (`{timestamp}-{name}.recovery.json` and `.recovery.md`) and a report to `crash-reports/` (`{timestamp}-crash.json`), keeps the file marked dirty, and shows an error toast.

That's all it is: a fallback dump for failed saves. Nothing is written on an actual crash, force quit or power loss. There's no UI to restore from these files, and nothing cleans them up. The real protection against losing work is auto-save's maximum delay; see `editor.md`.
