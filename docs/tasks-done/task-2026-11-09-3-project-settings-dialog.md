# Project settings dialog

GitHub: #82

The third of four tasks reworking project and collection settings. It builds on task 1's model: resolved collections whose every value carries its source, and the collection status Rust reports.

## Status

Built, on the `project-model-and-settings` branch. `check:all` and the website checks pass. Tried in the dev app in light and dark with `temp-dummy-astro-project` (including a broken copy with a missing folder, an unreadable pattern, a missing schema and settings for a removed collection), `unusual-structure` and `starlight-minimal`, plus Default Sort, the review toast and the Preferences link. Still to do: trying the native pieces (folder pickers, the Clear confirmation, the menu items) by hand (`task-5-manual-checks-before-release.md`), and new screenshots for the user guide, which wait for the UX rework in `task-6-project-settings-ux.md`. Its open questions (one Settings window, dropping the "Default" label) moved there too.

Where the build differs from the plan:

- **Statuses** (`lib/project-settings/status.ts`): errors are a missing folder, a folder outside the project, or an unreadable schema. Warnings are a schema Astro hasn't generated, an unreadable pattern, and the folder fallback (or no collections at all), which shows on the Project entry. The file list's collection rows show the same statuses (replacing their "No schema found" icon), so anything that works isn't a status: an unknown loader whose folder exists is explained by the Folder setting, and a field mapping with nothing to go on is a note on that setting. Only problems get an icon; fine collections have none.
- **A schema Astro hasn't generated is now reported** (`notGenerated`, renamed from `helpersOnly`) even when the config uses no `image()` or `reference()`; before, that showed as no schema. And fields are only detected in a complete schema, so a helpers-only schema no longer makes the title "missing".
- **Field mappings without a generated schema** offer the keys the collection's files have.
- **Preferences' sidebar links to Project Settings** when a project is open. Switching projects closes the dialog.
- **"Shown as" comes from the form's own routing,** moved out of `FrontmatterField` into `fieldControl` (`lib/field-control.ts`).
- **Rust:** the scan's project settings include the assets folder and absolute paths with their sources, and `open_project` reports `newSettings` for the review toast.
- **Default sort** gets a dropdown, and the sidebar's Default sort mode follows it. Before, it was stored but unused.
- **Data collections** are listed but not clickable. **Saved settings for collections not in the config** have one Clear button for the group, after a confirmation, and aren't offered with the folder fallback.
- **File > Project Settings…** has no shortcut.
- **Source labels:** "Default" stands for Astro's or AE's convention.
- **The user guide** has a new Project Settings page; `preferences.mdx` covers General and Advanced only.

## Problem

Project and collection settings sit in two Preferences tabs, with the collection ones behind accordions, and people don't find them. Nothing shows how AE has read the project: which collections it found and where, which fields it uses for the title, date and draft, or why a schema didn't load. When something's wrong, the user can't see why or what to change.

## Principles

- **Explain first, configure second.** Every collection shows what AE is using and where that came from, so most people only ever look. Settings are there to correct it.
- **Out of the way.** Nothing appears while writing.
- **Every value shows its source:** set by you (with a reset), read from the config, detected in the schema, Astro convention, or missing. A missing value comes with a warning saying what won't work, for example: "No boolean `draft` field, so there's no draft badge or filter for this collection."

## What it is

A separate dialog with a sidebar and a detail pane, laid out like Preferences. Preferences keeps General and Advanced, and loses its Project Settings and Collections panes.

- **Sidebar:** a Project entry, then each collection with a status (fine, warning, error). Below them: collections whose folder is missing, the config's data collections, and settings saved for collections no longer in the config. The last group has a Clear button.
- **Project page:** the project settings (assets folder and image paths as defaults for every collection, MDX components folder, component imports, content folder), and which config file was read. If AE is using the folder fallback, it says so and why: no config was found, or none of its collections could be read.
- **Collection page:**
  - **Status:** the loader, the folder and where it came from, the pattern, and the schema status. Problems come with a fix, such as "Run `astro sync` to generate the schema".
  - **Settings:** every collection setting from task 1, with its value and source. The folder override is a folder picker. Field mappings are dropdowns of the schema's fields of the right type.
  - **Schema:** each field as AE read it: name, type, required, constraints, default, description, and how the form shows it ("date picker", "image picker", "edited as YAML"). Fields AE can't fully represent carry a warning. Without a JSON schema, it says what's lost.
- **Opened from:** the sidebar header, the command palette, a Project Settings… item in the File menu, and task 2's list for the open project. Only the open project's settings can be edited for now.
- **Review toast:** the first time a project is opened with no version 3 settings file (new projects, and every project after the upgrade), if any collection has a warning, a toast says so with a Review button that opens the dialog. Otherwise nothing appears.

## Work

- [x] The dialog, its sidebar and its entry points.
- [x] The project page.
- [x] Collection status and settings, with sources and resets.
- [x] The schema viewer, including how each field is shown and the warnings.
- [x] The review toast.
- [x] Remove the Project Settings and Collections panes from Preferences.
- [x] Check it in the app, in light and dark mode, with each test project, including task 1's unusual one.
- [ ] Rewrite `preferences.mdx` and `reference/overrides.mdx` in the user guide, with new screenshots. Rewritten, with a new `project-settings.mdx`; screenshots to do.
