# Manual checks before the next release

Things the project list and project settings work (#82) does with native dialogs and menus, which the agent tooling can't click. Try them in a dev build, in `temp-dummy-astro-project` unless a step says otherwise. `bun run app reset` puts that project back afterwards.

## Project settings

- [ ] **Choose… buttons:** Content Folder, MDX Components Folder and Assets Folder on the project page, and Folder and Assets Folder on a collection page. For each one:
  - The picker opens in the current folder.
  - Picking a folder inside the project fills in a relative path, with "Set by you · Reset".
  - Picking a folder outside the project shows the "Choose a folder inside the project" toast.
  - Cancel changes nothing.
- [ ] **A folder override takes effect:** choose a different folder for a collection, check the file list shows that folder's files, then press Reset and check it's back.
- [ ] **Clear for removed collections:** rename a collection in the project's content config so its saved settings show under "Settings for Removed Collections". Clear shows a confirmation. Cancel keeps the settings; Clear removes them, and the group disappears.
- [ ] **File > Project Settings…** opens the dialog. With no project open, it does nothing.
- [ ] **The project list:** right-click the open project. Project Settings… closes the list and opens the dialog, and it isn't offered on other projects.
- [ ] **Keyboard:** Tab through a collection page, including the dropdowns. Escape closes the dialog and puts focus back in the editor.

## Project list

- [ ] **Context menu:** Reveal in Finder, Open in IDE (only with an IDE command set) and Copy Path each work. A missing project has Reveal and Open in IDE disabled.
- [ ] **Remove:** Remove from Astro Editor… (and ⌘⌫ on the highlighted project) asks first. Cancel keeps it; Remove takes it out of the list. It's disabled for the open project, and ⌘⌫ does nothing on it.
- [ ] **Locate…:** move or rename a project's folder, then open the list: it shows as Missing. Enter or Locate… opens the folder picker; picking the new folder opens it with its settings as they were.
- [ ] **Locate… onto a folder already in the list:** open the moved folder with Open Folder… first, then Locate… the missing entry onto it. It asks before replacing; Replace keeps the missing entry's settings and removes the other.
- [ ] **⌘O in the list** opens the folder picker.
