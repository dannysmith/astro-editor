# MDX Component Builder

The component builder (Cmd+/ in an MDX file) lists a project's MDX components and shows a form with a field for each prop, then inserts the tag with every value written in MDX syntax. This doc covers how props are read and why.

## Reading props without running the project

Props are read statically in Rust (`src-tauri/src/mdx_components/`) with swc. There's no type checker: none is embeddable in Rust, and bundling one (or running the project's own toolchain) would tie the app to each project's setup. Instead, `prop_types.rs` resolves what a form needs:

- local interfaces, type aliases and string enums, `(typeof LIST)[number]` and `keyof typeof OBJ`
- intersections and `extends` of local interfaces; anything inherited from types it can't see (`HTMLAttributes<'a'>`) is skipped, which is what writers want
- relative imports, followed into sibling `.ts` and `.d.ts` files inside the project. tsconfig aliases (`@/types`) and packages aren't followed
- defaults from destructuring (`const { a = 'x' } = Astro.props`, React parameters, Vue `withDefaults`, Svelte `$props()`), and JSDoc on props

Each prop gets a `PropKind`, which decides its field. Anything unresolved is `unknown` and gets a text field, inserted as a string. A component whose code won't parse is still listed, with no props.

Each framework finds its props differently (`mod.rs`): `interface Props` / `type Props` in Astro frontmatter, the typed first parameter (or `FC<Props>`) of a React component, `defineProps` in Vue's `<script setup>` (typed or runtime), and `export let` or `$props()` in Svelte. A `children` prop means the component takes a slot; it isn't a field.

## Inserting

`src/lib/editor/snippet-builder.ts` turns the form's values into a CodeMirror snippet: each value in MDX syntax, empty required props as tab stops, braces escaped so the snippet parser leaves them alone, and line breaks in strings written as `\n` because CodeMirror re-indents every line of a snippet. A component with a slot template, or any slotted component inserted on an empty line, goes in as a block: its content on a line of its own, with the blank lines around it that MDX needs to render markdown inside it.

## Adding the import

With the experimental project setting `addComponentImports` on, the builder also adds the `import` a component needs to the file's hidden import block. Off by default: a site using astro-auto-import breaks if a component is also imported by hand, and the setting shows a reminder when `package.json` lists it.

`componentBuilderStore` asks the `plan_component_import` command for a plan when a component is selected and whenever a pick changes, sending the import block and the body as the editor holds them. Rust works it out without saving (`src-tauri/src/mdx_esm/plan.rs`). The form shows an "Add import" row under the tag preview, with a switch to leave the imports out (on each time the builder opens), or "Already imported"; the row expands to show the lines. `insert()` plans again against the file as it is at that moment and applies that plan, so an Insert before the first plan arrives, or a block that changed on disk while the builder was open, can't give a missing or stale import. It puts the tag in, then the new block through `editorStore.setImports`, which marks the file dirty in the same update; otherwise `useEditorFileContent` would put back the block from disk.

- **Nothing is added if the name is already bound anywhere in the file:** imported, including further down the body (docs sites do this a lot), or declared like an inline `export const Callout`. Two bindings of one name break the build, and if the existing one is something else (Starlight's `Card` where the project has its own), the writer's import wins.
- **The path copies another file's import where it can,** looking at the collection's files and then the other collections' (the collections' parent folder, unless that's the project root), reading each file only until one imports the name, without parsing its YAML. This is how a site's aliases and barrels carry over without reading tsconfig. A relative path is only copied from the same folder, a relative or root path only if it leads to the component (or its folder, a barrel), and imports from Astro's modules (`astro:assets`) or the project's `package.json` packages never, since those are different components with the same name. Otherwise it's a relative path with the extension, as Astro's docs write it.
- **Edits splice text into the block** (`edit.rs`), so the writer's formatting, comments and blank lines survive. `added` is worked out at the end by comparing the block's statements before and after.
- **There's no plan** (`null`) for a component whose name isn't a capitalised identifier (`my-callout.astro` would give an invalid import, and MDX reads a lowercase tag as HTML), or when the setting is off.
- **React components can be named exports.** The scanner records `named_export`; Astro, Vue and Svelte components are always default exports, and Starlight's are named.

**Picks.** Picked images and entries are kept by prop in the store (`images`, `entries`) as soon as they're picked, so a second pick builds on the first, and the plan's `names` gives the name each prop's pick is imported or loaded as. `withPicks` (`snippet-builder.ts`) works out the tag's values from both: `cover={heroImage}` with a name, or the pick's path or id as text (`cover="../../assets/a.png"`, `review="first-post"`) when the switch is off or there's no plan, which is easier to fix by hand than a name nothing imports. Names come from the image's file name or the id's last part, avoiding every name the file binds, JavaScript's reserved words and the names Astro defines in MDX files (`frontmatter`, `file`, `url`…), and an image or entry the file already has keeps its name.

**Image props** get a picker (`ImagePropField`) when `canImportImages` holds: the setting is on and the collection's assets directory is under `src/`, the only place Astro imports images from. Otherwise they keep a text field for a name the writer imports themselves. The picked file goes through `processFileToAssets`, like the frontmatter's image fields, and Rust refuses an image outside `src/`, which drops the pick with a toast.

**Collection-entry props** get a picker (`EntryPropField`) when the setting is on, listing the collection's entries with `useCollectionEntriesQuery`, which the frontmatter's reference fields share, and falling back to the text field when the collection can't be listed. Values are Astro's entry ids (`astroEntryId` in `src/lib/entry-id.ts`), not the app's `FileEntry.id`, which is `<collection>/<path>`. Rust adds `import { getEntry } from 'astro:content'` (joining an existing `astro:content` import) and `export const firstArticle = await getEntry('articles', 'first-article')` at the end of the block. `getEntry` reads Astro's data store rather than importing the other entry's module, so an entry can load one from its own collection without a cycle. Saving refreshes the entry list when the frontmatter changed, since a `slug` is an id.

The editor's own drop handler and `FileUploadButton` both use `isDropWithinElement`, which ignores drops on something covering the target (`document.elementFromPoint`), so a drop on the builder's picker doesn't also insert a markdown image into the editor behind the dialog.

`test/mdx-imports/sites/` has a small site for each way sites write imports, with cases in `cases.toml` that `cases_in_test_sites` runs. Add a case there for anything found in the wild. The corpus snapshot (`test/mdx-imports/files/blocks.txt`) records each real file's hidden block and the imports further down that count as already imported. To check that added imports work, insert components in `temp-dummy-astro-project` or a copy of `test/starlight-minimal`, then run `bun install` and `bun run build` there. The dummy project renders every entry (`src/pages/[collection]/[...id].astro`), so a missing or wrong import fails the build.

## Starlight's components

In projects whose `package.json` depends on `@astrojs/starlight`, the builder adds Starlight's built-in components. They aren't read from the project's `node_modules`: the package layout has changed between versions, and some props (Badge's come from a Zod schema) need a real type checker.

Instead `scripts/starlight-components/generate.ts` reads them at our build time with TypeScript 6's compiler API and writes `src-tauri/src/mdx_components/starlight-components.json`, which the app bundles. `scripts/starlight-components/overrides.ts` adds what types can't say: descriptions, the content inserted inside `Tabs`, `Steps` and friends, value order, and props to hide.

To update for a new Starlight release, run `bun scripts/starlight-components/generate.ts latest` and commit the JSON. With no argument it regenerates for the version already in the JSON. It fails if Starlight adds, removes or changes a component the overrides describe, so changes get looked at rather than shipped blind.

## Testing against real components

- `test/dummy-astro-project/src/components/mdx/` has a component for each prop kind and framework pattern. `src/pages/components.astro` renders the Astro ones so the project's build checks them, and a Rust test asserts what's read from them. The project has the MDX, React, Vue and Svelte integrations, so the framework components build when an MDX file imports them.
- `test/mdx-components/` holds real components from open source sites (see its README). `cargo test --lib dump_all_fixtures -- --ignored --nocapture` in `src-tauri` prints what each reads as; use it when changing the parser.
