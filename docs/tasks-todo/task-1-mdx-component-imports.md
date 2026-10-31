# MDX Component Imports

Make the component builder add the `import` a component needs when it inserts it, and build a small, reliable way to read and edit the code between an MDX file's frontmatter and its body, so image and collection-entry props can use it too. Covers #287. It's an experimental, per-project setting, off by default.

Branch: `mdx-component-imports`. A first attempt is on the local branch `mdx-imports-first-attempt` (one commit, `f1873e3d`). It was written before the builder rework (#350) and was never reviewed or tried in the app. Lift pieces from it rather than merging it; see "The first attempt" below.

## Background

MDX files are split into three parts in `src-tauri/src/commands/files.rs`: frontmatter, the "imports" block, and the body. `extract_imports_from_content()` finds the block with a line heuristic that only understands `import`/`export` lines. The block is hidden from the editor, held as a string in `editorStore` (`imports`), and written back exactly as read.

What the builder knows about a component (`MdxComponent` in `src-tauri/src/models/mdx_component.rs`):

- `file_path`: relative to the project root, empty for package components
- `framework`: Astro, React, Vue or Svelte
- `import_source`: the module a package's components come from, e.g. `@astrojs/starlight/components`
- `slot_template`: content inserted inside the tag, which can contain other components (`Tabs` inserts `TabItem`s, `CardGrid` inserts `Card`s)

Image and collection-entry props currently get a text field and a hint telling the writer to add the import themselves (`bindingHint` in `src/components/component-builder/PropField.tsx`).

## How sites import components

From the Astro sites in `~/dev`, surveyed on 2026-10-30:

| Site | Example | Style |
| --- | --- | --- |
| maggieappleton.com | `import YearsAgo from "../../components/mdx/YearsAgo.astro";` | relative, double quotes, semicolons |
| astro.build | `import Note from '/src/components/Note.astro'` | root path, mixed quotes and semicolons |
| taskdn docs | `import Center from '@components/Center.astro'` | alias, single quotes, no semicolons |
| taskdn docs | `import { Tabs, TabItem } from '@astrojs/starlight/components'` | package, named |
| danny.is | `import { … } from '@components/ui/index'`, `@assets/x.png` | alias, barrel file |
| test projects | `import { Callout } from '@/components/mdx'` | alias, barrel file |

Images are often imported too (maggieappleton.com: 53 image imports; taskdn: 30). Only this repo's `website/` uses astro-auto-import.

What Astro's docs recommend:

- MDX examples use a relative path with the extension: `import ReactCounter from '../components/ReactCounter.jsx';`
- `.astro`, `.vue` and `.svelte` imports need their extension. `.ts(x)` and `.js(x)` don't, but Astro's base tsconfig sets `allowImportingTsExtensions`, so keeping the extension always works.
- Aliases come from tsconfig `paths`, e.g. `"@components/*": ["./src/components/*"]`.
- Starlight documents `import { Tabs, TabItem } from '@astrojs/starlight/components';`.
- Local images: `import rocket from '../assets/rocket.png';`, then `<Image src={rocket} />`.

## Decisions

- **Experimental, per project, off by default.** Labelled experimental in Project Settings. Revisit the default once people have used it. Projects using astro-auto-import break if a component is also imported by hand.
- **Support the common cases and do nothing otherwise.** The bar: imports the writer never has to fix, and no change at all when we're unsure.
- **Rust parses and edits the block** with swc, which is already bundled. The frontend sends the imports string and gets the new one back.
- **Choosing the import path:**
  1. If the name is already imported in this file, do nothing. If it points somewhere else, the writer's import wins.
  2. Package components (`import_source`) import from that module.
  3. If another MDX file in the same collection imports this name, copy its specifier: aliases, root paths (`/src/…`), barrels and packages as they are; relative paths only from a file in the same directory. "Same collection" means anywhere under the collection's directory, not just the current file's folder (the first attempt only looked there, missing `blog/2023/` from `blog/2024/`). For a project component, skip specifiers from the package modules the builder knows about. Otherwise a project `Card` would copy another file's Starlight `Card` import.
  4. Otherwise use a relative path from this file to the component, keeping the extension.

  Generating aliases from tsconfig `paths` (the first attempt's `oxc_resolver` and path inversion) is left out. So the first time a component is used anywhere, a site that uses aliases gets a relative import. It works but doesn't match the rest of the site, which is fine for an experimental feature. Revisit if writers ask for it.
- **Style:** quotes and semicolons follow this file's imports, then the collection's, then Astro's docs (single quotes, semicolons).
- **Merging:** a named import goes into an existing `import { … }` with the same specifier (compared as text). A default import always gets its own line.
- **Default or named export:** the component scanner records it, since it already finds the component function in React files. Astro, Vue and Svelte components are always default exports. The import code doesn't parse component files again.
- **Slot templates:** components the slot template inserts get imported too.
- **The splitter moves to swc.** Use the detection from the first attempt, without its legacy fallback. If detection gives up, the whole text is body, which is visible rather than hidden. Saving writes the block and the body back with exactly one blank line between them (the `rebuild_markdown_*` functions in `files.rs`), so moving the split never loses text. It can add a blank line where there was none, or collapse several into one, as the current heuristic already does. The case to guard against is prose being hidden in the block, where the writer can't see or edit it. Detection only takes what parses as module declarations, so it shouldn't happen. Even so, run it over the corpus and look at every file where it disagrees with the old heuristic.
- **Undo** removes the tag but not the import. An unused import is harmless in MDX, so that's accepted.
- **The builder previews the import.** When the setting is on, the configure step shows a row with an "Add import" toggle and the line that will be added or changed, e.g. `import Callout from '../../components/mdx/Callout.astro'`, or the merged `import { Aside, Callout } from '@/components/mdx'`. If the name is already imported, the row says so and shows that import line, so a clash (Starlight's `Card` imported, project `Card` picked) is visible. If no safe import could be planned, the row is hidden and nothing is added. The plan is made once when a component is selected, since it doesn't depend on prop values and the block can't change while the builder is open. Insert applies it if the toggle is on.
  - No diff of surrounding lines: the writer only needs the line being added.
  - No toast: they've just seen the line.
  - The toggle resets to on each time the builder opens. A remembered "off" would quietly stop imports being added later.

## Open questions

- Collection-entry props need `export const post = await getEntry('blog', 'id')` in the block. Does that build inside a content-collection MDX file? See phase 6.

## Plan

### Phase 1: Corpus

Real files to test the splitter and import insertion against, used for manual testing and automated tests, like `test/mdx-components/`.

- [ ] `test/mdx-imports/` with:
  - real MDX file heads (frontmatter, import block, first lines of body) for the splitter: multi-line imports, `export const` objects with blank lines, comments, imports followed directly by a heading or JSX, prose starting with "import"
  - small fixture projects for each style above (relative, alias, root path, barrel, Starlight), each with a few MDX files, components and a tsconfig
- [ ] Cases defined as data (file, component, expected import block) so a case found in the wild is added without writing a test
- [ ] README listing sources and licences, as in `test/mdx-components/README.md`. Candidates: danny.is and taskdn, withastro/docs and the Starlight docs (MIT), astro.build and maggieappleton.com (check licences first), this repo's `website/` (astro-auto-import).

### Phase 2: Block model and splitter

- [ ] Port the block model and detection (`mdx_esm/block.rs` in the first attempt) to the current swc, without the legacy fallback
- [ ] Replace `extract_imports_from_content()` with it
- [ ] Tests: splitting and rebuilding every corpus file gives back the original, apart from the gap between block and body; review each file where the new split differs from the old one

### Phase 3: Adding imports

- [ ] The scanner records whether a component is a default or named export
- [ ] Adding an import with span-anchored splices (`mdx_esm/edit.rs` in the first attempt): idempotent, merges named imports, leaves the block alone on name collisions or when it doesn't parse
- [ ] Choosing the specifier and inferring style, as decided above
- [ ] A Tauri command that plans without saving: it returns the new block plus the line it added or changed, for the preview. Bindings regenerated.
- [ ] Rust tests plus the corpus cases

### Phase 4: Builder and setting

- [ ] Project setting, labelled experimental, off by default
- [ ] `setImports` in `editorStore`, which must set `isDirty` in the same update, because `useEditorFileContent` overwrites `imports` from the query cache whenever the file isn't dirty
- [ ] Plan the import when a component is selected and keep it, with an `addImport` flag, in `componentBuilderStore`. `insert()` applies it if the flag is on, kept separate from `buildSnippet`. A failure never blocks inserting the tag.
- [ ] The preview row with its toggle on the configure step
- [ ] Starlight components and components from slot templates
- [ ] Make `test/dummy-astro-project` build its MDX. It has no `@astrojs/mdx`, no React, Vue or Svelte integrations, and no `@/*` alias, although its MDX imports `@/components/mdx`. `test/starlight-minimal` already builds MDX through Starlight.
- [ ] Try it in the app on the test projects, then run `astro build` in them to confirm the imports work
- [ ] Update `website/src/content/docs/editor/mdx-components.mdx` (it says imports "may" come in a future release) and `docs/developer/mdx-components.md`

### Phase 5: Image props

- [ ] An image picker for `image` props in the builder, copying the file into the project with `processFileToAssets` as `ImageField` does
- [ ] Add `import <name> from '<path>'` and insert `src={name}`. Name the binding from the file name, unique among the file's existing bindings. The image's import line joins the preview row.
- [ ] Only images under `src/` can be imported. If the collection's assets directory is in `public/`, keep the text field.
- [ ] Remove the image hint from `bindingHint`

### Phase 6: Collection-entry props

- [ ] Spike: confirm `export const x = await getEntry(…)` builds in a content-collection MDX file
- [ ] If it does: an entry picker, plus `import { getEntry } from 'astro:content'` and the `export const`. If it doesn't, keep the text field.

## The first attempt

`git show f1873e3d` (branch `mdx-imports-first-attempt`). About 1,300 lines of Rust plus 1,000 lines of tests, built against swc 39 (main is on 45).

Worth keeping:

- `mdx_esm/block.rs`: the block model and chunk-wise detection, which mirrors how MDX itself finds ESM (split at blank lines, extend when a statement runs past one)
- `mdx_esm/edit.rs`: adding imports with span-anchored splices, so untouched text is never reformatted
- `mdx_esm/style.rs`: quote and semicolon inference
- its tests, adapted

Leave out:

- the legacy line-heuristic fallback in `block.rs`
- `mdx_esm/resolve.rs`, `oxc_resolver` and the tsconfig inversion
- `binding_for_component`, which parses React files a second time
- dropping `.tsx`/`.jsx` extensions from specifiers
- the frontend changes, which predate the builder rework and use `safeLog`
