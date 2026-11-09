# New file naming

GitHub: #87

The last of four tasks reworking project and collection settings. It adds a collection setting, so it comes after tasks 1 and 3.

## Status

Built, on the `project-model-and-settings` branch. `check:all` passes. Tried in the dev app with `temp-dummy-astro-project`: the setting's presets, examples and error; a new file renamed on leaving the title, and only once; the published date link; the command, including a second run ("already named"); and renaming with unsaved edits, then typing on, which all landed in the renamed file. The native pieces and a few timing cases are in `task-x-manual-checks-before-release.md`.

## Problem

New files are named after today's date (`2026-11-04.md`, then `2026-11-04-1.md`; `useCreateFile.ts`). The file name usually becomes the entry's id and so its URL, so date names are rarely what anyone wants.

## What it is

A per-collection **File Names** pattern, like `{YYYY-MM-DD}-{title}`, in the collection page's Files section, with **Date**, **Title** and **Date and title** buttons that fill in the common ones, and examples of the names it gives as you type.

- **Placeholders:** `{title}` is the title as a slug, by the "Copy as slug" rules (`slugFromTitle`: stop words dropped, about 50 characters, accents now kept as plain letters). Any other placeholder is a date in moment-style tokens (`YYYY`, `YY`, `MM`, `M`, `DD`, `D`): the file's published date, or today. `{title}` rather than `{slug}`, which the link URL pattern already uses for the entry's slug or id. The default, `{YYYY-MM-DD}`, is the old behaviour.
- **New files** are created with the pattern minus the title (or today's date, if that leaves nothing), because auto-save needs a file straight away. When the title field loses focus, a file AE created this session is renamed once, unless its title is still the placeholder.
- **Rename File from Pattern** in the palette renames the open file in any collection.
- **Rename file to match**, below the published date, appears when the file's name follows the pattern and has another date in it. It changes only the date, keeping the rest of the name as it is.
- **Names** get `-1`, `-2` on a clash. If no name would match the collection's pattern, nothing is renamed. Folder-per-entry files (`<name>/index.md`) have their folder renamed.
- **Clashes, in Rust (`free_entry`):** ignoring case, hidden files included, a Markdown file with the same name before its extension (Astro's id), and an entry with that `slug`. New files use the same rules.
- **`rename_file` never replaces a file,** which protects the sidebar's rename too. It also keeps a change of case now: it validated the whole new path, and resolving a path that exists gives its case on disk, so `post.md` → `Post.md` did nothing.
- **`slug` is left alone.** When it's set, Astro uses it as the id, so the file name doesn't affect the URL.
- **Renaming the open file** follows `editor.md`'s data-safety rules (described there). The store now gets the renamed file's new id; before, a rename kept the old one.
- **The title field** is found by the collection's title mapping, for the focus on a new file and the frontmatter a new file gets, rather than by the name `title`. The same goes for the published date.

## Work

- [x] The collection setting, in the resolver and the dialog.
- [x] Make `rename_file` refuse to overwrite.
- [x] Rename on title blur, the command, and the published date link.
- [x] Tests for naming, clashes, the pattern and the rename sequence.
- [x] The user guide: creating files, the setting, the command and the date link.
- [ ] The manual checks.
