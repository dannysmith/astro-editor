# New file naming

GitHub: #87

The last of four tasks reworking project and collection settings. It adds a collection setting, so it comes after tasks 1 and 3.

## Problem

New files are named after today's date (`2026-11-04.md`, then `2026-11-04-1.md`; `useCreateFile.ts`). The file name usually becomes the entry's id and so its URL, so date names are rarely what anyone wants.

## What it is

A per-collection setting, **Name new files:** **Date** (today's behaviour and the default) or **From title**. This follows Danny's comment on #87 rather than a pattern language, because it fits most sites with one setting.

- **From title:** the file is created with a date name as now, because auto-save needs a file straight away. When the title field loses focus, the file is renamed to the slugified title. Only files AE created in this session are renamed, and each only once, tracked in memory. A date-named file from last month is never renamed, because its URL may already be published.
- **A Rename File from Title command** in the palette works on any file, in any collection.
- **Names** are slugified as `astroEntryId` does, with `-1`, `-2` added on a clash. If the new name wouldn't match the collection's pattern, the file isn't renamed. In folder-per-entry collections (`<name>/index.md`), the folder is renamed.
- **Clashes are checked properly.** `rename_file` is a bare `fs::rename`, which replaces an existing target. Make it refuse to, which also protects the sidebar's rename. Compare names case-insensitively (APFS is case-insensitive), include files the pattern hides, and treat a clashing Astro id as a clash: an existing `my-post.mdx`, or a file with `slug: my-post`.
- **`slug` is left alone.** When it's set, Astro uses it as the id, so the file name doesn't affect the URL.
- **Renaming the open file** follows `editor.md`'s data-safety rules: no lost keystrokes and no jump from a reload.

## Work

- [ ] The collection setting, in the resolver and the dialog.
- [ ] Make `rename_file` refuse to overwrite.
- [ ] Rename on title blur, and the command.
- [ ] Tests for naming, clashes and the pattern check.
- [ ] The user guide: creating files and the setting.
