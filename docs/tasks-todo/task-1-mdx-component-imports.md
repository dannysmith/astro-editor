# MDX Component Imports

Make the component builder add the `import` a component needs when it inserts it, and build a small, reliable way to read and edit the code between an MDX file's frontmatter and its body, so image and collection-entry props can use it too. Covers #287. It's an experimental, per-project setting, off by default.

Branch: `mdx-component-imports`. A first attempt is on the local branch `mdx-imports-first-attempt` (one commit, `f1873e3d`). It was written before the builder rework (#350) and was never reviewed or tried in the app. Lift pieces from it rather than merging it; see "The first attempt" below.

## Background

MDX files are split into three parts in `src-tauri/src/commands/files.rs`: frontmatter, the "imports" block, and the body. `split_esm_block()` in `src-tauri/src/mdx_esm/` finds the block by parsing it with swc (a line heuristic until phase 2). The block is hidden from the editor, held as a string in `editorStore` (`imports`), and written back exactly as read.

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
  1. If the name is already imported anywhere in this file, do nothing. If it points somewhere else, the writer's import wins. "Anywhere" includes imports further down the body, outside code fences: MDX allows them, the Astro and Starlight docs use them a lot, and adding a second import of the same name breaks the build. So the command needs the body as well as the block.
  2. Package components (`import_source`) import from that module.
  3. If another MDX file in the same collection imports this name, copy its specifier: aliases, root paths (`/src/…`), barrels and packages as they are; relative paths only from a file in the same directory. Copy how it imports the name as well as the path: a barrel gives `{ Callout }`, a named import, though `Callout.astro` is a default export. "Same collection" means anywhere under the collection's directory, not just the current file's folder (the first attempt only looked there, missing `blog/2023/` from `blog/2024/`). For a project component, skip imports from packages in the project's `package.json`. Otherwise a project `Card` would copy another file's Starlight `Card` import, or a project `Video` another file's `import { YouTube as Video } from '@astro-community/astro-embed-youtube'` (the corpus caught this one).
  4. Otherwise use a relative path from this file to the component, keeping the extension.

  Generating aliases from tsconfig `paths` (the first attempt's `oxc_resolver` and path inversion) is left out. So the first time a component is used anywhere, a site that uses aliases gets a relative import. It works but doesn't match the rest of the site, which is fine for an experimental feature. Revisit if writers ask for it.
- **Style:** quotes and semicolons follow this file's imports, then the collection's, then Astro's docs (single quotes, semicolons).
- **Merging:** a named import goes into an existing `import { … }` with the same specifier (compared as text). In a multi-line import it goes on its own line, matching the others' indentation and trailing comma. A default import always gets its own line.
- **Placement:** a new import goes after the block's last import, or above the first statement when there are no imports, never after `export` statements. The editor reads every file with LF line endings, so the new line does too.
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

Real files to test the splitter and import insertion against, used for manual testing and automated tests, like `test/mdx-components/`. See `test/mdx-imports/README.md`.

- [x] `test/mdx-imports/files/`: 15 whole MDX files from the Astro docs, the Starlight docs, danny.is and taskdn, plus 19 handwritten edge cases
- [x] `test/mdx-imports/sites/`: a fixture project for each style (relative, alias, root path, barrel, Starlight), with 30 cases in `cases.toml` files. The harness in phase 3 needs `toml` as a dev-dependency.
- [x] README listing sources and licences. astro.build and maggieappleton.com have no licence, so the `root-path` and `relative` sites only copy their style, not their files. `website/` uses astro-auto-import, so it has no imports to test.

### Phase 2: Splitter

- [x] Port the detection (`mdx_esm/block.rs` in the first attempt) to the current swc, without the legacy fallback, in `src-tauri/src/mdx_esm/`
- [x] Replace `extract_imports_from_content()` and its helpers with it
- [x] Tests: `mdx_corpus_tests` in `files.rs` checks that saving every corpus file changes only blank lines and reads back the same, and snapshots each file's hidden block in `test/mdx-imports/files/blocks.txt`
- [x] Reviewed the 8 corpus files where the old heuristic and the new splitter disagree. The new split is right in each. The old one hid a paragraph starting with "import", hid broken and indented imports, cut statements with a blank line inside them in half, and dropped blank lines between import groups on save. Every real-world file splits the same either way.

### Phase 3: Adding imports

- [x] The scanner records `named_export` on `MdxComponent`: React files with no default export and an export named after the component. Starlight's list is regenerated with `named_export: true`.
- [x] The model of ESM code (`mdx_esm/imports.rs`): each statement's range, and each import's module, quote, semicolon and names
- [x] Adding an import by splicing text in (`mdx_esm/edit.rs`): merges named imports on one line or one per line, with or without a trailing comma, and adds braces to a default-only import
- [x] Choosing the path and inferring style, as decided above (`mdx_esm/plan.rs`). Imports from the project's `package.json` dependencies are skipped for project components, which replaces "the package modules the builder knows about".
- [x] Finding imports further down the body, outside code fences (`body_esm`), for the "already imported" check
- [x] `plan_component_import` command, which takes the block and the body and returns an `ImportPlan`: `add` with the new block and the statement added or changed, `alreadyImported` with the statement that has the name, or `null`. Bindings regenerated.
- [x] Unit tests for each part, and `cases_in_test_sites`, which runs all 30 cases in `test/mdx-imports/sites/*/cases.toml`

### Phase 4: Builder and setting

- [x] Project setting `addComponentImports`, under "Experimental" in Project Settings, off by default
- [x] `setImports` in `editorStore`, which sets `isDirty` in the same update, because `useEditorFileContent` overwrites `imports` from the query cache whenever the file isn't dirty. The save's "changed while saving" check now compares `imports` too.
- [x] Plan the import when a component is selected and keep it, with an `addImport` flag, in `componentBuilderStore`. `insert()` adds the tag, then the import if the flag is on. A plan that arrives after going back to the list is dropped. Tests in `componentBuilderStore.test.ts`.
- [x] The import row under the tag preview: "Add import" with its switch, or "Already imported", expanding to show the line
- [x] Starlight components and components from slot templates: inserting `Tabs` in `starlight-minimal`'s index gave `import { Card, CardGrid, Tabs, TabItem } from '@astrojs/starlight/components';`
- [x] Make `test/dummy-astro-project` build its MDX: the MDX, React, Vue and Svelte integrations, the `@/*` alias, `astro-embed` and `unfurl.js` (which the danny.is components import), the missing `NotionIcon` and `Loom` components, and a page that renders every entry
- [x] Tried it in the app: Embed (relative, matching the file's quote style), Callout (already imported through the barrel), Alert with the switch off (nothing added), and Alert, Card, Badge and Timeline (one per framework). `bun run build` passed in both projects and the components rendered.
- [x] Updated `website/src/content/docs/editor/mdx-components.mdx`, `preferences.mdx` and `docs/developer/mdx-components.md`

### Phase 5: Image props

- [x] An image picker for `image` props in the builder (`ImagePropField`), copying the file into the project with `processFileToAssets` as `ImageField` does. Shown when the setting is on; otherwise image props keep the text field and its hint.
- [x] Add `import <name> from '<path>'` and insert `image={name}`. The plan command takes the picked images and names each after its file (`hero-image.png` gives `heroImage`, dates and other leading numbers dropped, reserved words get `Image`), unique among every name the file binds, including `export const`s. An image the file already imports keeps its name. The plan now lists every statement it adds (`added`), plus the component's `existing` import, and the row shows them all. The switch covers the image imports too, and with it off a picked image goes in as its path, `image="../../assets/a.png"`, which is easier to fix in a code editor than a name nothing imports.
- [x] Only images under `src/` can be imported: the picker only shows when the collection's assets directory is under `src/`, and the command refuses an image elsewhere (one already in `public/`, say), which the builder shows as a toast
- [x] The image hint in `bindingHint` stays for the text field fallback
- [x] Drops on the picker no longer also go to the editor behind the dialog: the editor's drop handler and `FileUploadButton` ignore drops on anything covering them
- [x] Tried in the app: dropping an image onto Figure's picker copied it, named it `styleguideImage`, and the inserted Figure and both imports built, with Astro optimising the image

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
