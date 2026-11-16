# Frontmatter fixtures

Real and handwritten Markdown and MDX for testing how the editor reads frontmatter and writes it back. None of it builds. The bodies are stubs: only the frontmatter matters here.

The tests are `frontmatter_corpus_tests` in `src-tauri/src/frontmatter/corpus_tests.rs`. They run over every `.md` and `.mdx` file in `files/`, so adding a file is enough to add a case. They check that:

- saving a file whose frontmatter hasn't been edited writes it back byte for byte (with LF line endings). This also runs over `test/mdx-imports/files/`, except files with an import block, whose blank lines `mdx_corpus_tests` checks.
- each file reads as the values in `values.txt`. After adding a file or changing how frontmatter is read, regenerate it with `UPDATE_SNAPSHOTS=1 cargo test frontmatter_corpus` (in `src-tauri`) and review the diff.
- editing each top-level key in turn, deleting each one, and adding one, writes frontmatter that reads back as the new values and keeps every line of the other keys. This also runs over `test/mdx-imports/files/`.

## `files/`

Real files, with only their frontmatter copied:

- `dannyis/`: posts and projects from danny.is, at commit `6b8736b`. Single- and double-quoted strings, inline lists of quoted tags, lists indented under their key.
- `taskdn/`: pages from the [taskdn](https://github.com/dannysmith/taskdn) docs (`website/src/content/docs/`) at commit `7a69c7f`. Starlight's `sidebar` and `tableOfContents`. Content licensed CC BY 4.0 by Danny Smith.
- `astro-editor-docs/`: pages from this repo's `website/`.

The Astro and Starlight docs pages in `test/mdx-imports/files/` cover Starlight's `hero`, `head` and `banner`.

Handwritten, in `handwritten/`. Some are modelled on shapes from astro.build and maggieappleton.com, which have no licence, so nothing in them is copied.

| File | Covers |
| --- | --- |
| `comments.md` | Comments above, between and after keys, inside a list, and at the end; a colour like `#4783B5`, which is a comment |
| `quote-styles.md` | Plain, single- and double-quoted strings, escapes, strings that need quotes, empty strings, numbers and booleans as strings |
| `inline-lists.md` | Inline lists with plain, single- and double-quoted items, empty lists, inline maps, an inline list over several lines |
| `block-lists.md` | List items at column 0, indented by two and by four; lists of objects; nested lists |
| `block-scalars.md` | `\|`, `>`, `\|-`, `>+`, a blank line inside, an indentation indicator |
| `block-scalar-last-key.md` | A `\|` block scalar as the last key, whose trailing newline depends on reading the YAML with its final newline |
| `wrapped-strings.md` | Plain and quoted strings wrapped over several lines, and HTML in a plain string |
| `dates.md` | Dates and datetimes, quoted and not, with `Z`, an offset and a space; dates written out in words; a date-like string that must stay a string; an empty date |
| `scalars.md` | `~`, `null`, empty values, `yes`/`no`/`on`/`off`, `True`, hex, octal, a leading zero, `1.10`, `1.0`, `1e3`, infinities, NaN, an integer too big for JavaScript, a version number |
| `nested-objects.md` | Objects indented by two and by four, three levels deep, with a list inside; an empty object value; a key with a dot in it |
| `anchors-and-merge-keys.md` | Anchors and aliases across keys, and a `<<` merge key |
| `generated-anchors.md` | Anchors like `&ref_0`, which serialisers such as js-yaml add when one object appears twice |
| `keys.md` | Quoted keys, keys with spaces, a colon inside a quoted key |
| `numeric-key.md` | A number as a key |
| `null-key.md` | `null` as a key |
| `duplicate-keys.md` | The same key twice |
| `timestamp-tag.md` | An explicit `!!timestamp` tag |
| `bom-in-value.md` | A byte order mark inside a value |
| `whitespace.md` | Trailing spaces, blank lines between keys and inside a list, several spaces after a colon, a tab inside a value, a blank line before the closing fence |
| `tab-on-blank-line.md` | A blank line holding a tab |
| `tabs-in-flow-list.md` | Tabs indenting the items of a `[ … ]` list, which Astro 5 (js-yaml) read and Astro 7 rejects |
| `starlight.mdx` | Every frontmatter field Starlight adds |
| `bom.md` | A byte order mark before the opening fence |
| `leading-blank-lines.md` | Blank lines before the opening fence |
| `fence-trailing-spaces.md` | Trailing spaces after both fences |
| `empty-frontmatter.md` | Nothing between the fences |
| `comment-only-frontmatter.md` | Only a comment between the fences |
| `toml-frontmatter.md` | TOML frontmatter between `+++` fences |
| `unclosed-frontmatter.md` | A file starting with a thematic break that's never closed |
| `body-thematic-breaks.md` | Thematic breaks in the body, after the frontmatter |
| `no-frontmatter.md` | No frontmatter |
| `crlf.md` | Windows line endings (kept by `.gitattributes`) |

## Comparing with Astro

`astro-values.mjs` prints what Astro reads from each file in `files/`, in the format of `values.txt`, using the parser of any Astro project with its dependencies installed:

```bash
bun test/frontmatter/astro-values.mjs ~/path/to/an/astro-site > $TMPDIR/astro.txt
tail -n +3 test/frontmatter/values.txt | diff - $TMPDIR/astro.txt
```

Some differences are expected, because the editor keeps frontmatter as it's written rather than as JavaScript sees it:

- Astro reads dates and datetimes as `Date`s, which print in UTC (`2024-06-15T00:00:00.000Z`). The editor keeps the text, and knows from the schema which fields are dates.
- JavaScript loses precision in integers over 2^53, and puts numeric keys first. Keys from a `<<` merge come after an object's own keys in the editor, and before them in Astro; the values are the same.
- `.inf` and `.nan` are the text `".inf"` and `".nan"` in the editor, since JSON can't hold them.
- Astro reads TOML frontmatter between `+++` fences. The editor doesn't.

Astro reads a few rare things the editor can't: a `null` key (`null-key.md`) and an explicit `!!timestamp` tag (`timestamp-tag.md`). The editor shows that frontmatter as unreadable, and leaves its text alone.

Comparing with Astro 5 (js-yaml) also differs on `tabs-in-flow-list.md`, which js-yaml read and Astro 7 rejects, as the editor does.
