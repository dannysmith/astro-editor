# Project list

GitHub: #82

The second of four tasks reworking project and collection settings. It depends on task 1's path-based project identity.

## Problem

AE keeps a registry of every project it has opened, but you can't see it. There's no way to switch projects without the folder picker, remove an old project, or tell that one has moved. Task 1 removes the moved-project guess, so a project that's gone needs somewhere to show up as gone.

## What it is

A searchable list like VS Code's or Zed's Open Recent, built from the command palette's components (`command-palette/`). It's not a dashboard: no collection counts or schema badges, since those would mean scanning every project.

- **Rows:** name, path and when it was last opened, most recent first, with the open project marked. Typing filters the list, and Enter opens the selected project.
- **Open Folder…:** the existing folder picker (`openProjectViaDialog` in `src/lib/projects/actions.ts`), for a project AE hasn't seen.
- **Remove from Astro Editor:** after confirming, removes the project from the registry and deletes its settings file. It never touches the project itself.
- **Context menu:** Reveal in Finder, Open in IDE, Copy Path, Remove.
- **Missing projects:** when the list opens, one Rust command checks every path exists. Nothing is checked at startup. A missing project shows as missing, with **Locate…** (choose its new folder, keeping its settings) and **Remove**. If the chosen folder is already registered, usually because the user opened it with Open Folder… first, Locate… asks before replacing that entry's settings with the missing project's. If the last-opened project is missing at startup, a message says so and points to the list.

⌘O, File > Open Project…, the palette command, the sidebar's folder button and the welcome screen's Open Project button all open the list instead of the folder picker. Deep links find a file's project by path prefix (`useEditorActions.ts`), so a link into a moved project says it isn't in a known project. That message should point to the list too.

## Work

- [ ] A Rust command to check which registry paths exist.
- [ ] Registry actions: remove (deleting the settings file) and relocate.
- [ ] The list: search, keyboard navigation, open, Open Folder…, the context menu, and the missing state.
- [ ] Point every way of opening a project at it.
- [ ] Messages for a missing last-opened project and for deep links into unknown projects that point to the list.
- [ ] Tests for the registry actions.
- [ ] Docs: remove and relocate in `app-data.md`; the list in the user guide's file management pages.
