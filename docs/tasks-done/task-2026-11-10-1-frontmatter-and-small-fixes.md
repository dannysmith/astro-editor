# Task: Frontmatter fixes and small follow-ups

GitHub: #370 (steps 1–2), #372, #371, #376

One branch and PR, before 1.1.0. Each phase is one issue, with its own tests, and can be committed on its own. Then back to task 8's reviews.

## Phase 1: Don't rewrite frontmatter that hasn't changed (#370, steps 1–2)

Editing a frontmatter field re-serialises the whole block (serde_norway), losing comments, quote styles, inline lists and so on. That's the bigger job in #370 (editing the YAML in place) and stays open for after 1.1.0. These two steps are the cheap, safe part:

- [x] **Write the original text when the values are back to what was loaded.** Changing a field and changing it back still rewrites the block today, so the file shows as changed in git. When the frontmatter equals what was loaded, save as a body-only edit and send the original `rawFrontmatter` (see `isFrontmatterDirty` in `editorStore.ts` and "Body-only edits keep the user's YAML" in `docs/developer/editor.md`). The fork does this in `frontmatter-save.ts`.
- [x] **Stop cutting datetimes in keys that weren't edited.** `normalize_dates` (`src-tauri/src/commands/files.rs`) shortens every ISO datetime with a `Z` or offset to a date, in every key, so editing one field loses the time from all of them. First find out why it shortens them at all (AE assumes `YYYY-MM-DD` dates, and the date picker writes them), then limit it to what needs it, ideally only the edited keys. Don't change how dates are written for date fields: supporting timestamps is part of #370's later work.
- [x] Tests: a value changed and changed back saves the original text byte for byte; an untouched `2024-01-15T10:30:00Z` survives an edit to another field.

Done: the first load after opening is kept as `frontmatterBaseline` and its text is written when the values are back to it (a switch left at its default counts as unset; see `lib/files/frontmatter-baseline.ts`). `normalize_dates` was removed rather than limited: it dated from when the date picker wrote `toISOString()`, and nothing on the save path produces datetimes now.

## Phase 2: New files with frontmatter that builds (#372)

`useCreateFile` writes a new file's frontmatter as a string by hand, so:

- required fields with no default get `''` or `0`, which fail `email`, `url`, `image()`, enums and `reference()`
- dates are quoted, so Astro reads them as strings and `z.date()` rejects them (`z.coerce.date()` hides this in the test project)
- nested required fields are written as literal `sponsor.name:` keys
- object defaults come out as `[object Object]`, and a `"` in a string isn't escaped

To do:

- [x] **Decide (Danny):** what a required field with no default gets. Leaving it out fails the build, and so does `''` for anything but a plain `z.string()`. Options: leave such fields out (the panel already marks them required, and the build error names the field); write `''` only for plain strings and leave the rest out; or something else.
- [x] Build the values as an object (nested where the schema nests) and let the Rust writer serialise them, as saving already does, so dates, nesting, objects and escaping come out right. The fork's `lib/files/new-file.ts` (commits `1577a65`, `62df387`) is worth reading.
- [x] Tests for each of the cases above.

Done: leave them out (option 1). A required switch, date or list gets off, today or `[]` (unless it needs items); other required fields are left out, and so is every field inside an object, since the schema doesn't say whether the object is required. `newFileFrontmatter` (`lib/files/new-file.ts`) builds the values and `create_file` serialises them with the save writer, in schema order.

## Phase 3: Windows paths (#371)

`rename_entry` and the `\\?\` prefix were fixed in #368. These still return paths with `\` on Windows, which the frontend doesn't expect:

- [x] `canonical_path` (`preferences.rs`), and so the registry, `open_project` and `list_projects`
- [x] `select_project_folder`, `create_file` and `rename_file`

Normalise them with `normalize_path_for_serialization` (`utils/path.rs`), as the serialised types are. Windows isn't officially supported and can't be tried here, so lean on unit tests and the cross-platform notes in `docs/developer/cross-platform.md`.

Done: `canonical_path`, `select_project_folder` and `create_file` return `/` paths. `rename_file` returns nothing, so there was nothing to change. Registry entries stored with `\` still match (`find_project` normalises them before comparing), are listed with `/`, and are rewritten on the next open. Tested on every platform by storing a path with `\`; no Windows CI tests, to keep CI fast.

## Phase 4: `file()` data stored as an object (#376)

- [x] `load_file_based_collection` (`src-tauri/src/commands/project.rs`) only reads a JSON array, so a reference to a `file()` collection stored as an object keyed by id can't load its entries. For an object, use each key as the entry's id, as Astro does.
- [x] Test both shapes. YAML `file()` data isn't read at all; add it only if it's a few lines.

Done: `file_collection_entries` reads both shapes as Astro's loader does (array ids from `id` or `slug`, numbers included, items without one skipped; object keys as ids, `$schema` ignored), and `.yml`/`.yaml` files are parsed with serde_norway. TOML was left out, since `toml` is only a dev-dependency. Object entries list in id order, as serde_json doesn't keep key order.

## Finishing

- [x] Update `docs/developer/editor.md` (saving) and the issues: close #371, #372 and #376; comment on #370 with what's done and leave it open for the in-place editing.
- [x] `bun run check:all`, then a PR. Merge it before task 2.
