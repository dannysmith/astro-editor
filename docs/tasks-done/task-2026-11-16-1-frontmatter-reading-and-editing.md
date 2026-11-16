# Task: Read frontmatter like Astro, and edit it in place

Issues #370 and #388. Editing one frontmatter field rewrites the whole block with serde_norway, so keys the writer didn't touch change too: quote styles, inline lists, lists indented under their key, wrapped strings, comments and key order. Over 1,878 real frontmatter blocks (astro.build, maggieappleton.com, danny.is, the Astro and Starlight docs, the taskdn docs, our website and test projects), only 12% of single-field edits change just that field's lines, and an edit changes 8.5 lines on average.

Reading has problems too. serde_norway reads some frontmatter differently from Astro, and a file whose frontmatter can't be parsed opens as a blank document that the next save overwrites (#388).

Unedited frontmatter, and frontmatter edited back to how it was loaded, are already written back as the original text (`frontmatter-baseline.ts`). That stays.

All of this merges together.

## Approach

### Reading

- **Finding the block:** a line scanner, not a regex. It accepts what Astro accepts: an optional BOM, blank lines before the opening `---`, and trailing whitespace on either fence. Everything before the YAML, and both fences as written, are kept and written back unchanged.
- **Parsing:** serde-saphyr, which follows YAML 1.2 and reads frontmatter the way Astro 7 does. The YAML is parsed with its final newline, as Astro does.
- **One module owns it:** a single `yaml` module holds the parser and its options, and every YAML read in the app goes through it: frontmatter, listings, `slug_of`, `file()` collections, and the read-back check.
- **Frontmatter that can't be read** opens with the body editable and the frontmatter text kept as it is, with the parser's error shown in the frontmatter panel. It's never written over.

### Writing

The values are the truth, and the original text is a template for formatting. On save:

1. **Split** the original frontmatter into one chunk per top-level key: its lines, plus the blank and column-0 comment lines above it. Each chunk must parse on its own as exactly that key.
2. **Keep** each chunk whose value hasn't changed, byte for byte.
3. **Re-render** each changed key with our own renderer, in the key's original style where that's simple: the same quotes for a one-line string, an inline list kept inline, list items kept indented under their key. Drop deleted keys. Put a new key before the first key that comes after it in the schema, or at the end.
4. **Sort the chunks**, with reordering on: schema keys in schema order, then other keys alphabetically. Chunks move as text, so their formatting and comments go with them. Nested objects keep their own order.
5. **Check** that the result reads back as exactly the values being saved.
   - If the split or the check fails, render the whole block instead, and check that.
   - If that check fails too, the save fails: the file isn't written, it stays dirty, and recovery data is written, as for any failed save.

Because of step 5, the splitter and the renderer only decide how good the result looks, never whether it's right. It also doesn't matter if the raw text the frontend sends is older than what's on disk.

### The renderer

It only renders the values the panel produces (strings, numbers, booleans, null, lists and objects), so it's small. We own it rather than use a serialiser, because we need per-field control over dates and style, and because a crate update mustn't change what we write into users' files.

**Strings:**
- Written plain only if they're on one line, read back as the same string, and aren't something an older YAML reader would take as a boolean or null (`yes`, `no`, `on`, `off`, `y`, `n`, `~`).
- Otherwise double-quoted, using JSON escaping, which is valid YAML.
- Multi-line strings use a `|` block, with the chomping indicator that keeps their trailing newlines.

**Dates:**
- A date-like string (`2024-01-01`, or a datetime) is written plain when the schema says the field is a date, or when the original value was a plain date, so Astro reads it as a date.
- Any other date-like string is quoted, so a text field never becomes a date. That fixes finding 5 from task 8.

**Lists and objects:** list items are indented two spaces under their key (the common style: 1,139 of the surveyed files, against 8 at column 0), and objects are indented two spaces. Empty ones are written `[]` and `{}`.

**New files:** `create_file` uses the same renderer for a new file's frontmatter.

## Decisions

- **Read with serde-saphyr; write with our own renderer; drop serde_norway.**
  - serde_norway has had no release since December 2024, it's a mechanical translation of libyaml's C, and it differs from Astro on tabs, leading zeros, duplicate keys and merge keys.
  - serde-saphyr is pure Rust with `unsafe` denied, actively maintained, and used by kube-rs, Cloudflare's foundations, ast-grep and mise. Its reader is the more mature half; its serialiser has had round-trip bugs and changes style between versions, which is why we don't use it.
- **serde-saphyr and granit-parser are pinned exactly (`=`), and only upgraded on purpose.** They change default behaviour between minor versions. One author does nearly all the work, and only the latest version gets fixes. An upgrade must pass the frontmatter corpus and the comparison with Astro (`test/frontmatter/README.md`). Stay on 2.x until 3.0 has settled. If maintenance stops, we stay on the pinned version or fork it; both crates are MIT/Apache with almost no dependencies.
- **No fallback to a second parser.** Two parsers is the complexity this avoids. The pinned version and the corpus gate are the safety net, and reverting the commit is the way back.
- **Match Astro 7.** Astro 5 read frontmatter with js-yaml, which tolerated tabs indenting the items of a `[ … ]` list. The YAML spec, Astro 7 and serde-saphyr reject that (four files on maggieappleton.com do it). Such files open with an error in the frontmatter panel, as any unreadable frontmatter does.
- **Duplicate keys are unreadable frontmatter,** as in Astro, whose build fails on them. They get the same treatment as any other error, rather than a choice of which copy wins. No real Astro site turned up with them on purpose; they come from accidents and tools appending keys.
- **Anchors, aliases and merge keys need nothing special.** The panel shows the resolved values, as Astro reads them. Untouched keys keep them, since their chunks are kept as text. An edited key is written with its values expanded, which reads the same. In real frontmatter they're rare and mostly generated (js-yaml's `&ref_0`), and they turned up in Jekyll and Hugo sites, not hand-written Astro ones.
- **Reordering is a project setting, off by default.** `reorderFrontmatter` in `ProjectSettings`, the same shape as `addComponentImports`. Key order is a convention of a repo, shared with other people and tools, and off gives the smallest diffs. With it on, keys that aren't in the schema go after the schema keys, alphabetically, so every file in a collection ends up in the same order. It only reorders on a real frontmatter edit, never on a body-only save or an edit put back.
- **Granularity is the top-level key.** Editing `seo.title` re-renders the whole `seo:` chunk. Going a level deeper isn't worth it until someone needs it.
- **No TOML.** Astro reads `+++` frontmatter, but nobody has asked for it.

## How Astro reads frontmatter

Astro 7.4's `@astrojs/internal-helpers/dist/frontmatter.js` finds the block with one regex, `(?:^﻿?|^\s*\n)(?:---|\+\+\+)([\s\S]*?\n)(?:---|\+\+\+)`. It parses the YAML with the `yaml` package's `parseDocument`, using the core schema, `timestamp` and merge keys. Astro 5 used js-yaml (`@astrojs/markdown-remark`).

Where we'll still differ, on purpose:

- TOML `+++` frontmatter, and mixed `---`/`+++` fences.
- A closing fence with text after it (`---foo`), which the regex accepts.
- Unquoted dates and datetimes: Astro gets `Date`s, and we keep the text. The schema tells the panel which fields are dates.
- `.inf` and `.nan`, which JSON can't hold.

## Research

The spikes and reports are in `docs/tasks-todo/temporary/frontmatter-370/` (local only).

**Splicing.** Over the 1,878 blocks, every top-level key was edited in turn (12,243 edits):
- 97.9% changed only that key's lines, at 2 lines per edit, with no fallbacks.
- Deleting each key fell back once, because of the last-key block scalar problem.
- 97.2% of keys re-render exactly as they were written.

**Parsers.** Astro's own code extracted 1,918 blocks (the corpus, the test projects and the real sites), and each parser read the same text:

| Parser       | Differs from Astro 7 | Differs from Astro 5 | Time per block |
| ------------ | -------------------- | -------------------- | -------------- |
| serde_norway | 8                    | 4                    | 6.6 µs         |
| serde-saphyr | 1 (`.inf`)           | 5                    | 7.3 µs         |
| saphyr       | 4                    | 7                    | 6.0 µs         |

saphyr has no serde support and doesn't apply merge keys.

**serde-saphyr's defaults that would hurt us:**
- `yes`, `no`, `on` and `off` read as booleans.
- `.inf` fails the whole file.
- Leading zeros (`017`) read as a float, `17.0`.
- `max_nodes` (250,000) rejects a large `file()` collection, such as a 30,000-entry YAML file.
- Errors quote snippets of the file.
- Its serialiser folds strings over 80 characters, and quotes every date.

The options below fix the reading side, and we don't use its serialiser.

## Phase 1: Corpus and harness

- [x] `test/frontmatter/`, laid out like `test/mdx-imports/`, with a README. Real files with their frontmatter only: danny.is, the taskdn docs and our website. astro.build and maggieappleton.com have no licence, so their shapes are modelled in handwritten files instead. The Astro and Starlight docs are already in `test/mdx-imports/files/`.
- [x] Handwritten cases, one file per area (the README lists them), and `starlight.mdx` with every Starlight field.
- [x] `frontmatter_corpus_tests` in `files.rs`:
  - Saving unchanged writes the file back byte for byte, over both corpora.
  - `values.txt` snapshots what each file reads as.
  - Two files aren't kept yet (`NOT_KEPT`): saving drops an empty frontmatter block, and frontmatter after blank lines isn't seen.
- [x] `astro-values.mjs` prints what Astro's own parser reads, in the same format, so the two can be diffed.

## Phase 2: Unreadable frontmatter (#388)

This comes first, because it stops data loss today, and because the parser switch makes some files that read today unreadable.

- [x] **Rust:** when the block is found but its YAML can't be parsed, `parse_markdown_content` returns the body, the imports and the raw frontmatter text, with the error (`frontmatter_error`), instead of failing. The error is parsed again after a blank line, so its line numbers count from the top of the file. A file that can't be read at all still fails.
- [x] **Frontend:** the store holds `frontmatterError`.
  - The body loads and can be edited.
  - Saving sends the raw frontmatter text unchanged.
  - The store ignores frontmatter edits, so its values are never written.
- [x] **The frontmatter panel** shows the error and its line in place of the fields, with Open in IDE when an IDE is set. Fixing the file outside the app brings the fields back without reopening it.
- [x] **A failed load** shows an error in the editor area, with the editor kept mounted and hidden. The file content query no longer retries (a file that can't be read fails the same way every time); before, retries paused while the window wasn't focused. All queries and mutations now run while the Mac is offline (`networkMode: 'always'` in `query-client.ts`): TanStack Query's default paused them, though every one reads or writes local files, so creating or renaming a file would have hung offline.
- [x] **Editing before a file has loaded** was the same data loss as a race: the editor held an empty placeholder that typing could mark dirty, and the load was then skipped, so the save wrote what was typed. Now nothing edits or saves a file until `isLoaded`: the editor is read-only, the store's edit actions do nothing, and `saveFile` writes nothing. Documented in `editor.md`.
- [x] **The sidebar** falls back to the file name for an entry whose frontmatter can't be read, as before. It can't tell whether such a file is a draft, so it doesn't mark it as one.
- [x] **Tests:**
  - Rust: unreadable frontmatter keeps its text and the body, and its error's lines count from the top of the file. The corpus test writes `tab-on-blank-line.md` back unchanged. `duplicate-keys.md` joins it once Phase 3 rejects duplicates.
  - Frontend: edits are ignored before the file loads; frontmatter edits are ignored while it can't be read; a save writes nothing before the file loads and writes unreadable frontmatter's text unchanged; loading marks the file loaded with its frontmatter error, records a failed load, and keeps a loaded file when a reload fails.
- [x] **Tried in the dev app** with the test vault: a note with a tab on a blank line opens with its body and the error, and a body edit leaves the frontmatter byte-identical on disk. A note with an unclosed `---` shows the load error, and nothing typed is written.

## Phase 3: Reading

- [x] **A `frontmatter` module** (`src-tauri/src/frontmatter/`) that owns finding the block, reading it and writing it, moved out of `commands/files.rs`. `parse_frontmatter`, the listings (`frontmatter_values`), `slug_of`, `mdx_esm/plan.rs` and the commands use it. Its tests (`tests.rs`) and both corpus tests (`corpus_tests.rs`) moved with it; the command tests stay in `files.rs`.
  - `parse_frontmatter` no longer fails: an unclosed `---` is no frontmatter, and bad YAML is unreadable frontmatter.
  - **`raw_frontmatter` is now the whole block as written,** from the top of the file through the closing fence, so a BOM, blank lines and spaces after the fences are written back unchanged. The frontend treats it as opaque text. Until Phase 4, editing the values of such a file still rewrites the block from `---`.
- [x] **A `yaml` module (`src-tauri/src/yaml.rs`) that's the only caller of serde-saphyr,** enforced with Clippy's `disallowed-methods` (which also bans `serde_norway::from_str`).
  - [x] `serde-saphyr = "=2.1.1"` and `granit-parser = "=2.1.0"` pinned, with a comment in `Cargo.toml`. serde-saphyr only asks for granit-parser `2.1.0`, which Cargo would update within 2.x, so it's pinned directly.
  - [x] Options: `strict_booleans`, `underscored_numbers_as_strings` (`1_000` is a string in YAML 1.2's core schema), duplicate keys an error, merge keys applied, non-finite floats as text, no snippets in errors, and no limit on events or nodes (the input size and alias limits still apply).
  - [x] Errors are a `YamlError` (message, line, column), so frontmatter errors are shifted to file lines rather than parsed again. serde-saphyr's hint for developers on duplicate keys is dropped.
  - [x] Numbers as JavaScript sees them: a float with no fraction is an integer, so `017` is 17 and `id: 007` gives the id `"7"`.
  - [x] `file()` collections (`project.rs`) read through it.
- [x] **The line scanner** (`find_block`). An opening `---` that's never closed means no frontmatter. An empty block is kept. `NOT_KEPT` is gone: every corpus file saves back byte for byte.
- [x] **Parse with the final newline:** a `|` block scalar that's the last key keeps its trailing newline.
- [x] **More corpus cases:** `tabs-in-flow-list.md`, `null-key.md`, `timestamp-tag.md`, `bom-in-value.md`, `generated-anchors.md`. `id: 007`, a 40,000-entry collection and `yes`/`no` are unit tests in `yaml.rs`.
- [x] **Regenerated `values.txt`** and compared with `astro-values.mjs`. What's left is in the README: dates as text, JavaScript's numbers and key order, merged keys' order, `.inf` as text, TOML, and two rare things Astro reads that we can't (`null` keys and `!!timestamp`), which show as unreadable.
- [x] **Tests that described serde_norway's reading** are renamed and read through `crate::yaml`. The comments about its writing in `tests.rs` and `editor.md` change with the writer in Phase 4.
- [x] **Tried in the dev app:** a file with a BOM before its fence reads (title in the panel and the sidebar), and a body edit keeps the BOM and the block byte for byte. A file with duplicate keys shows the frontmatter error.

## Phase 4: Writing

- [x] **The renderer** (`src-tauri/src/frontmatter/write.rs`), with unit tests: strings that need quoting (a test writes ~70 awkward strings at the top level, in lists and nested, and reads each back), multi-line strings, long strings on one line, dates in date fields and in text fields, empty lists and objects, lists of objects, nested lists, keys that need quoting.
  - How a value was written is found in the key's original text: under its own key first (`key: "value"`), then anywhere in the key's text. A new value takes the style most of the key's strings use, or the file's.
  - Indentation of objects and lists is measured from the key's own text, or the file's.
  - A multi-line string whose first line starts with a space is written as a JSON string rather than a block scalar with an indentation indicator.
- [x] **The splice, the style matching and the check, with the whole-block render as the fallback.** A save that fails both checks returns an error and writes nothing. Frontmatter that can't be read is returned unchanged, whatever the frontend sends.
  - The comments directly above a key go with it; blank lines between keys belong to the key before, since a `|+` block keeps them as part of its value. A re-rendered key keeps the blank lines after it.
  - A new key goes before the first key that comes after it in the schema, or else after the last that comes before it, or else at the end.
  - Inline lists stay inline, whether on the key's line or the next.
- [x] **Compare numbers by value** (`same` in `write.rs`).
- [x] **Save sends** the raw text always, the values only when they were edited, and a `FrontmatterSchema` (`fields` and `dateFields`, built by `frontmatterSchema` in `lib/schema.ts`). `isBackToBaseline` stays.
- [x] **`create_file`** renders new files' frontmatter with the renderer, in schema order (reordering on). Duplicating a file passes an empty schema.
- [x] **Removed serde_norway.** One `assemble` replaces the three `rebuild_*` functions.
- [x] **The corpus edit test** (`edits_change_only_the_keys_edited`), over both corpora: editing, deleting and adding each top-level key reads back as the new values and keeps every line of the other keys.
- [x] **Checked against real sites and Astro** (temporary, not committed):
  - Every top-level key of the 1,900 real files edited in turn: 12,409 edits, no errors, none touching another key's lines, one file (with anchors) written whole.
  - Each edited file read with Astro's own parser: in all 12,416 edits, every untouched value reads exactly as before (a `Date` stays a `Date`, text stays text), and the edited one as written.
- [x] **Tried in the dev app:** editing a title and a switch changes only those two lines, keeping single quotes; adding a tag keeps an inline list inline; a new file's `pubDate` is unquoted.

## Phase 5: Reordering

- [x] `reorderFrontmatter` in `ProjectSettings`, off by default, with its switch ("Reorder frontmatter") in Project Settings' Content group. Save reads it from the project scan and passes it to Rust, rather than Rust reading the settings file on every save.
- [x] With it on, the chunks are sorted: schema keys in schema order, then the rest alphabetically. Corpus test (`reordering_moves_keys_with_their_text`): the result is in that order, and each other key's text is unchanged. A key with a dot in its name counts as itself when the schema names it, rather than as part of an object.
- [x] **Tried in the dev app:** with it on, editing a file's title put its keys in schema order, its comment moved with its key, and keys outside the schema went last, alphabetically.

## Phase 6: Docs and finishing

- [x] **`editor.md`:** replace "Only an edited frontmatter is re-serialised…" with how splicing works, the renderer, the check and what happens when it fails, unreadable frontmatter, and what's read like Astro and what isn't.
- [x] **`architecture-guide.md` or `schema-system.md`:** the `yaml` module, why serde-saphyr is pinned, and the upgrade check.
- [x] **AGENTS.md rules:** all YAML goes through the `yaml` module, and serde-saphyr is only upgraded after the corpus and the Astro comparison pass.
- [x] **`app-data.md`:** the new project setting.
- [x] **Website:** the reordering setting, what an edit does to a file's frontmatter, and what the frontmatter panel shows when it can't read a file.
- [x] **`bun run check:all`.**
- [x] **Try it in the dev app** on the test projects and a copy of a real site: edit fields of every type, with reordering on and off; files with comments, inline lists and nested objects; a broken file; a new file.
