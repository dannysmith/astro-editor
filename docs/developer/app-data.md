# App data

What the app stores on the user's machine, where, and the reasoning behind the settings model. The settings model is due a rework (#82), so this covers the reasoning and gotchas rather than every setting; for the shapes, read `src/lib/project-registry/types.ts`.

## Where it lives

Everything is in Tauri's `AppLocalData` folder, named after the bundle identifier:

- **macOS:** `~/Library/Application Support/is.danny.astroeditor/`
- **Windows:** `%LOCALAPPDATA%\is.danny.astroeditor\`
- **Linux:** `~/.local/share/is.danny.astroeditor/` (or under `$XDG_DATA_HOME`)

Dev builds use `is.danny.astroeditor.dev` instead, so they never read or write the installed app's data (see `agent-tooling.md`).

Inside it:

- `preferences/global-settings.json`: app-wide settings (theme, IDE command, auto-save delay, appearance and so on).
- `preferences/project-registry.json`: every project ever opened (ID, name, path, dates) and which was open last.
- `preferences/projects/{id}.json`: one project's settings, including its collection overrides.
- `recovery/` and `crash-reports/`: see [Recovery Files](#recovery-files).
- `telemetry.json`: the anonymous install ID. Release builds only.
- `.window-state.json`: window size and position, from the window-state plugin.

The webview's localStorage holds a few per-machine conveniences: panel sizes (`panel-v4:*`), a copy of the theme (`astro-editor-theme`) so the theme provider has it before settings load, and a skipped update version. Logs live elsewhere; see `agent-tooling.md`.

All preferences reads and writes go through Rust commands (`readAppDataFile`, `writeAppDataFile`) that refuse paths outside the app data folder.

## How a setting resolves

Project and collection settings resolve **collection → project → hard-coded default**. There's deliberately no global layer for them: a project's paths or field names don't make sense as an app-wide default. The one exception is `defaultFileType` (md or mdx), which is a writing preference, so it goes collection → project → global → `'md'` (`default-file-type.ts`).

`collection-settings.ts` is where the fallbacks are written out.

- **Collection overrides are sparse.** `settings.collections` lists only collections the user has changed, never the collections discovered in the project. Nothing has to stay in sync with discovery, and settings for a collection that's since been removed are harmless.
- **Path overrides are relative to the project root,** at both levels, not to the content directory: `content/blog/` means `<project>/content/blog/`. Assets go in a folder named after the collection inside the assets directory (`<assets>/<collection>/`), overridden or not.
- **Frontmatter mappings are collection-scoped in the UI** (which field is the title, date, description, draft). Each collection has its own schema, so the dropdowns list that collection's fields; a project-level dropdown merged fields from every collection, which was confusing and often wrong. Project-level mappings still exist in the files and act as the fallback, but there's no UI for them.

## Project IDs

A project's ID is its `package.json` `name`, made filename-safe, or the folder name if there's no `package.json`. On a clash with an existing ID, a short hash of the path is appended (`utils.ts`). Keying on the name means a project keeps its settings when it's moved: if no registered project has the new path, `findMovedProject` looks for one with the same name and updates its path.

That check doesn't confirm the old path is gone, so two projects with the same package name (say, two sites from the same Astro template) are treated as one project and share settings. This is tracked in #347.

## Gotchas

- **`projectRegistryManager.updateProjectSettings` replaces `collections` wholesale.** Path overrides and frontmatter mappings are merged one level deep, but a `collections` array overwrites the stored one, so callers must send the full array. `usePreferences.updateCollectionSettings` does.
- **A new collection setting must be added to the cleanup filter** in `updateCollectionSettings` (`src/hooks/usePreferences.ts`). It drops collections whose settings are all empty by checking each known field by name, so a field it doesn't know about is dropped on save.
- **Changing project path overrides has side effects.** `projectStore.updateProjectSettings` saves and closes the open file (with a toast explaining why), invalidates the collection and directory queries, and restarts the file watcher, because the paths under the open file may have moved. Collection-level path changes go through `collections` and skip all of this, which is a bug (#347).
- **A collection's content directory override is saved but not used** (a bug, #347). Collections are found by scanning the project-level content directory (`useCollectionsQuery`), and nothing reads the collection-level value except the preferences pane.
- **New project files are seeded with `DEFAULT_PROJECT_SETTINGS`** (`defaults.ts`), so the project layer is rarely empty and the hard-coded defaults in `collection-settings.ts` seldom apply. The two sets of defaults have drifted apart on the published date field (#347), so change both.
- **A preferences file that doesn't parse is treated as missing.** Global settings fall back to defaults and are overwritten on the next change. A broken project file is replaced with defaults as soon as the project opens. Take a copy before hand-editing one.
- **Project files have a leftover top-level `collections` field that nothing reads.** Collection overrides are in `settings.collections`.

## Recovery files

When a save throws, the `catch` in `useEditorActions.saveFile` writes the unsaved content to `recovery/` (`{timestamp}-{name}.recovery.json` and `.recovery.md`) and a report to `crash-reports/` (`{timestamp}-crash.json`), keeps the file marked dirty, and shows an error toast.

That's all it is: a fallback dump for failed saves. Nothing is written on an actual crash, force quit or power loss. There's no UI to restore from these files, and nothing cleans them up. The real protection against losing work is auto-save's maximum delay; see `editor.md`.
