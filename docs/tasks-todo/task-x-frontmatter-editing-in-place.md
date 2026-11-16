# Task: Edit frontmatter in place

Issue #370. Editing one frontmatter field rewrites the whole block with serde_norway, so keys the writer didn't touch change too: quote styles, inline lists, lists indented under their key, wrapped strings, comments and key order. Over 1,878 real frontmatter blocks (astro.build, maggieappleton.com, danny.is, the Astro and Starlight docs, the taskdn docs, our website and test projects), only 12% of single-field edits change just that field's lines, and an edit changes 8.5 lines on average.

Unedited frontmatter, and frontmatter edited back to how it was loaded, are already written back as the original text (`frontmatter-baseline.ts`). That stays.

## Approach

The values are the truth and the original text is a template for formatting. On save:

1. Split the original frontmatter into one chunk per top-level key: its lines, plus the blank and column-0 comment lines above it. Each chunk must parse on its own as exactly that key.
2. Keep each chunk whose value hasn't changed, byte for byte.
3. Re-render each changed key, in its original style where that's simple: the same quotes for a one-line string, an inline list kept inline, list items kept indented under their key. Drop deleted keys. Put new keys before the first key that comes after them in the schema, or at the end.
4. With reordering on, sort the chunks: schema keys in schema order, then other keys alphabetically. Chunks move as text, so their formatting and comments go with them. Nested objects keep their own order.
5. Parse the result and check it reads back as exactly the values being saved. If the split or the check fails, write the whole block as today.

Because of step 5, the splitter only decides how good the result looks, never whether it's right: the worst case is today's behaviour. It also doesn't matter if the raw text the frontend sends is older than what's on disk.

A spike (in `docs/tasks-todo/temporary/frontmatter-370/`, local only) ran this over the same 1,878 blocks, editing every top-level key in turn (12,243 edits): 97.9% changed only that key's lines, at 2 lines per edit, with no fallbacks. Deleting each key fell back once, because of the last-key block scalar problem below. 97.2% of keys re-render exactly as they were written.

## Decisions

- **Reordering is a project setting, off by default.** `reorderFrontmatter` in `ProjectSettings`, the same shape as `addComponentImports`. Key order is a convention of a repo, shared with other people and tools. Off gives the smallest diffs.
- **With reordering on, keys that aren't in the schema go after the schema keys, alphabetically,** so every file in a collection ends up in the same order.
- **It only reorders on a real frontmatter edit,** never on a body-only save or an edit put back.
- **Keep serde_norway.** It reads everything else in the app, and step 5 relies on reading and writing with the same parser. A second parser (a lossless YAML crate, or the `yaml` package Astro uses) could read a value differently.
- **Granularity is the top-level key.** Editing `seo.title` re-renders the whole `seo:` chunk. Going a level deeper isn't worth it until someone needs it.
- **No TOML.** Astro reads `+++` frontmatter, but nobody has asked for it.

## How Astro reads frontmatter

From `@astrojs/internal-helpers/dist/frontmatter.js` (Astro 7.4): one regex, `(?:^﻿?|^\s*\n)(?:---|\+\+\+)([\s\S]*?\n)(?:---|\+\+\+)`, then `yaml`'s `parseDocument` with the core schema, `timestamp` and merge keys. So it accepts a BOM or blank lines before the opening fence, and trailing whitespace on the fences. Its YAML always ends with a newline.

Where we'll still differ, on purpose:

- TOML `+++` frontmatter, and mixed `---`/`+++` fences.
- A closing fence with text after it (`---foo`), which the regex accepts.
- `<<` merge keys: Astro merges them; we show `<<` as a key.
- Unquoted timestamps: Astro gets `Date`s, we get strings. The schema tells the panel it's a date.

## Phase 1: Corpus and harness

- [x] `test/frontmatter/`, laid out like `test/mdx-imports/` with a README. Real files with their frontmatter only: danny.is, the taskdn docs and our website. astro.build and maggieappleton.com have no licence, so their shapes are modelled in handwritten files instead. The Astro and Starlight docs are already in `test/mdx-imports/files/`.
- [x] Handwritten cases, one file per area (the README lists them), and `starlight.mdx` with every Starlight field.
- [x] `frontmatter_corpus_tests` in `files.rs`: saving unchanged writes the file back byte for byte (over both corpora), and `values.txt` snapshots what each file reads as. Two files aren't kept yet (`NOT_KEPT`): saving drops an empty frontmatter block, and frontmatter after blank lines isn't seen.
- [x] `astro-values.mjs` prints what Astro's own parser reads, in the same format, so the two can be diffed.
- [ ] The edit test comes with the writer in Phase 3: editing, deleting and adding each top-level key changes only that key's lines and reads back as the new values; with reordering on, the result is in schema order, then alphabetical.

### What comparing with Astro found

Beyond the expected differences (dates, JavaScript numbers, TOML; see the README):

- To fix in Phase 2: a BOM, trailing spaces on fences, blank lines before the opening fence, empty frontmatter (Astro reads `{}`), a last-key block scalar's trailing newline, and an unclosed `---`, which Astro reads as no frontmatter but we can't open at all.
- **Duplicate keys:** Astro fails the build; we silently keep the last value, so editing any field deletes the first one's line.
- **A blank line holding a tab:** Astro reads it; serde_norway (libyaml) rejects the whole file.
- **`017`:** Astro reads 17; we read the string `"017"`.
- **`<<` merge keys:** Astro merges them; we keep `<<` as a key.

## Phase 2: Reading

- [ ] A `frontmatter` module in `src-tauri/src/` that owns finding the block, reading its values, splicing and the whole-block writer, moved out of `commands/files.rs`. The listings (`frontmatter_values`), `parse_frontmatter`, `mdx_esm/plan.rs` and `create_file` use it.
- [ ] Find the block with a line scanner, not a regex: an optional BOM, then any whitespace-only lines, then a `---` line (trailing whitespace allowed), up to the next such line. Keep everything before the YAML (BOM, blank lines, the opening fence as written) and the closing fence as written, and write them back unchanged, so the round trip stays byte-identical.
- [ ] Parse the YAML with its final newline, as Astro does. Without it, a `|` block scalar that's the last key loses its trailing newline.
- [ ] An opening `---` that's never closed means no frontmatter, as in Astro, rather than an error that stops the file opening.
- [ ] Keep an empty frontmatter block when saving. Empty `NOT_KEPT`.

## Phase 3: Writing

- [ ] The splice, the style matching and the check, as above, with the whole-block writer as the fallback. `create_file` keeps using the whole-block writer.
- [ ] Compare numbers by value when deciding whether a key changed. Values make a round trip through JavaScript, so `1.0` comes back as `1`, and serde_json counts those as different.
- [ ] Quote date-like strings unless the schema says the field is a date (finding 5 in task 8). serde_norway writes the string `2024-01-01` unquoted, which Astro reads as a date, so a `z.string()` field fails the build. Save needs the date fields' names as well as the field order.
- [ ] Save always sends the values and the raw text (the baseline's text when edits are back to it), and the reorder setting, instead of today's three cases. Keep `isBackToBaseline`: it's what puts back the exact text when style matching can't.

## Phase 4: Setting and docs

- [ ] `reorderFrontmatter` in project settings and its switch in Project Settings.
- [ ] `editor.md`: replace "Only an edited frontmatter is re-serialised…" with how splicing works, the check and the fallback, and what's read like Astro and what isn't.
- [ ] Website: the setting, and what an edit does to a file's frontmatter.
- [ ] `bun run check:all`, then try it in the dev app on the test projects and a copy of a real site.
- [ ] Close #370.
