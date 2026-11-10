# Project list

GitHub: #82

The second of four tasks reworking project and collection settings. It depends on task 1's path-based project identity.

## Status

Done, on the `project-model-and-settings` branch. `check:all` passes. Opening, searching, switching, the startup message and the title bar were tried in the dev app; Remove, Locate… and the context menu use native dialogs and menus, so they're covered by the Rust tests and need trying by hand (`task-5-manual-checks-before-release.md`).

Where the build differs from the plan:

- **One `list_projects` command** returns the registry, newest first, with each project flagged missing. It's read fresh each time the list opens, because `projectStore.registry` is only loaded at startup.
- **Rows show the folder name,** as the title bar does, not the stored `package.json` name.
- **The open project can't be removed.**
- **Enter on a missing project runs Locate…,** and Locate… opens the project afterwards.
- **Open Folder… is pinned under the search box,** outside the results, so it's in view with a long list but a search never highlights it. ⌘O triggers it from the list.
- **⌘⌫ removes the highlighted project.** Remove also deletes the project's `.v2.json`.
- **The shortcut stays ⇧⌘O.**
- **Clicking the project name in the title bar** opens the list too.
- **Switching projects saves the open file first,** and stays put if the save fails. Before this, edits made since the last auto-save were lost on switching.

## Problem

AE keeps a registry of every project it has opened, but you can't see it. There's no way to switch projects without the folder picker, remove an old project, or tell that one has moved. Task 1 removes the moved-project guess, so a project that's gone needs somewhere to show up as gone.

## What it is

A searchable list like VS Code's or Zed's Open Recent, built from the command palette's components (`command-palette/`). It's not a dashboard: no collection counts or schema badges, since those would mean scanning every project.

- **Rows:** name, path and when it was last opened, most recent first, with the open project marked. Typing filters the list, and Enter opens the selected project.
- **Open Folder…:** the existing folder picker (`openProjectViaDialog` in `src/lib/projects/actions.ts`), for a project AE hasn't seen.
- **Remove from Astro Editor:** after confirming, removes the project from the registry and deletes its settings file. It never touches the project itself.
- **Context menu:** Reveal in Finder, Open in IDE, Copy Path, Remove.
- **Missing projects:** when the list opens, one Rust command checks every path exists. Nothing is checked at startup. A missing project shows as missing, with **Locate…** (choose its new folder, keeping its settings) and **Remove**. If the chosen folder is already registered, usually because the user opened it with Open Folder… first, Locate… asks before replacing that entry's settings with the missing project's. If the last-opened project is missing at startup, a message says so and points to the list.

⇧⌘O, File > Open Project…, the palette command, the sidebar's folder button and the welcome screen's Open Project button all open the list instead of the folder picker. Deep links find a file's project by path prefix (`useEditorActions.ts`), so a link into a moved project says it isn't in a known project. That message should point to the list too.

## Work

- [x] A Rust command to check which registry paths exist.
- [x] Registry actions: remove (deleting the settings file) and relocate.
- [x] The list: search, keyboard navigation, open, Open Folder…, the context menu, and the missing state.
- [x] Point every way of opening a project at it.
- [x] Messages for a missing last-opened project and for deep links into unknown projects that point to the list.
- [x] Tests for the registry actions.
- [x] Docs: remove and relocate in `app-data.md`; the list in the user guide's file management pages.
