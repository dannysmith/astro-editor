# MDX import fixtures

Real and handwritten MDX for testing how the editor reads the import block between an MDX file's frontmatter and its body, and how the component builder adds imports to it. None of it builds or runs. Use it for automated tests and for trying things by hand in the app.

## `files/`: finding the import block

MDX files whose import block the editor has to find and hide. The tests (`mdx_corpus_tests` in `src-tauri/src/commands/files.rs`) run over every `.mdx` file in here, so adding a file is enough to add a case. They check that saving an unchanged file changes nothing but blank lines and reads back the same, and that each file's hidden block matches `blocks.txt`. After adding a file or changing how blocks are found, regenerate `blocks.txt` with `UPDATE_SNAPSHOTS=1 cargo test mdx_corpus` (in `src-tauri`) and review the diff.

Real files, copied whole:

- `astro-docs/`: pages from [withastro/docs](https://github.com/withastro/docs) (`src/content/docs/en/`) at commit `14bb8ab`. Imports through the `~/` alias, Starlight components, mixed quotes and semicolons, JSX straight after the block, and imports further down the page. MIT licensed, see `astro-docs/LICENSE`.
- `starlight-docs/`: pages from [withastro/starlight](https://github.com/withastro/starlight) (`docs/src/content/docs/`) at commit `6c9ca43`. Files whose only import is halfway down, and files with imports at the top and further down. MIT licensed, see `starlight-docs/LICENSE`.
- `dannyis/`: posts from danny.is, copied at commit `9098b0c`. `export const` statements spanning several lines, a JSON import, image imports and a barrel import.
- `taskdn/`: pages from the [taskdn](https://github.com/dannysmith/taskdn) docs (`website/src/content/docs/`) at commit `aa59cb9`. Starlight components, `starlight-kbd`, `@components` and `@assets` aliases and `astro:assets`. Content licensed CC BY 4.0 by Danny Smith.

Handwritten, in `handwritten/`, for shapes the real files don't cover:

| File | Covers |
| --- | --- |
| `prose-starting-with-import.mdx` | A paragraph that starts with the word "import" |
| `import-then-heading.mdx` | A heading straight after an import, with no blank line |
| `import-then-jsx.mdx` | JSX straight after an import, with no blank line |
| `export-const-blank-line.mdx` | A blank line inside an `export const` array |
| `template-literal.mdx` | Blank lines inside a template literal |
| `comments.mdx` | Line and block comments in the block, non-ASCII text, and a `//` line after a blank line, which is a paragraph |
| `specifier-kinds.mdx` | Type, namespace, side-effect, default-plus-named, renamed, `?raw` and `?url` imports |
| `multiline-named.mdx` | A named import over several lines with a trailing comma |
| `no-frontmatter.mdx` | Imports at the very top of a file without frontmatter |
| `frontmatter-only.mdx` | Nothing after the frontmatter |
| `blank-line-groups.mdx` | Groups of imports separated by blank lines, and several blank lines before the body |
| `components-mapping.mdx` | `export const components = { … }` |
| `top-level-await.mdx` | `export const post = await getEntry(…)` |
| `export-default-layout.mdx` | An `export default` function containing JSX and a blank line |
| `import-later-only.mdx` | The only import comes after a paragraph |
| `broken-import.mdx` | An import with an unclosed string |
| `indented-import.mdx` | An indented import line, which MDX treats as text |
| `imports-in-code-fence.mdx` | Imports inside a code fence, which aren't ESM |
| `crlf.mdx` | Windows line endings (kept by `.gitattributes`) |

## `sites/`: adding imports

Small projects, one for each way sites write imports. Each has a `package.json`, a `tsconfig.json`, a `src/content.config.ts`, components in `src/components/mdx/` (unless `components_dir` says otherwise), MDX files in one collection, and a `cases.toml`. List any package the MDX imports from in `package.json`: imports from the project's packages are never copied for its own components. `cases_in_test_sites` in `src-tauri/src/mdx_esm/plan.rs` runs every case (`cargo test cases_in_test_sites` in `src-tauri`).

| Site | Style | Modelled on |
| --- | --- | --- |
| `relative/` | `../../components/mdx/X.astro`, double quotes, semicolons; React, Vue and Svelte components; a barrel imported by a relative path | maggieappleton.com |
| `alias/` | `@components/mdx/X.astro` from tsconfig `paths`, single quotes, no semicolons | taskdn docs, Astro docs |
| `root-path/` | `/src/components/X.astro`, files that disagree about style | astro.build |
| `barrel/` | `import { X } from '@/components/mdx'` through an `index.ts` | the test projects, danny.is |
| `starlight/` | Starlight's components, a `~/` alias, and a project `Card` that shares a name with Starlight's | Starlight and Astro docs |

The sites are written for these fixtures. Nothing in them is copied from the sites they're modelled on.

### Cases

Each `[[case]]` in a `cases.toml` inserts one component into one file and says what the file's import block should be afterwards:

```toml
[[case]]
name = "adds to the existing import from the barrel"
file = "src/content/notes/a.mdx"       # relative to the site
component = "Callout"                  # as the component builder lists it
expected = """
import { Aside, Callout } from '@/components/mdx'
"""
```

- `expected` is the whole import block after the insert. It's compared without trailing whitespace. The editor reads every file with LF line endings, so `expected` never contains `\r`.
- `existing` replaces `expected` when nothing should be added because the file already has the name: it's the statement the builder should show as "Already imported".
- `component` names one of the site's own components. Add `package = "@astrojs/starlight/components"` for a Starlight component of that name.
- `components_dir` at the top of the file sets where the site's components are, if not `src/components/mdx`.

To add a case found in the wild, add the files it needs to a site, or start a new site, and add a `[[case]]`.
