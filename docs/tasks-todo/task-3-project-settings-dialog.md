# Project settings dialog

GitHub: #82

The third of four tasks reworking project and collection settings. It builds on task 1's model: resolved collections whose every value carries its source, and the collection status Rust reports.

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

- [ ] The dialog, its sidebar and its entry points.
- [ ] The project page.
- [ ] Collection status and settings, with sources and resets.
- [ ] The schema viewer, including how each field is shown and the warnings.
- [ ] The review toast.
- [ ] Remove the Project Settings and Collections panes from Preferences.
- [ ] Check it in the app, in light and dark mode, with each test project, including task 1's unusual one.
- [ ] Rewrite `preferences.mdx` and `reference/overrides.mdx` in the user guide, with new screenshots.
