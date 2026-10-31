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

With the experimental project setting `addComponentImports` on, the builder also adds the `import` a component needs to the file's hidden import block. Off by default: a site using astro-auto-import breaks if a component is also imported by hand.

`componentBuilderStore` asks the `plan_component_import` command for the import when a component is selected, sending the import block and the body as the editor holds them. Rust works it out without saving, and the form shows an "Add import" row under the tag preview, with a switch to leave it out (on each time the builder opens), or "Already imported". The row expands to show the line it will add or change, or the import that already has the name. `insert()` puts the tag in first and then the new block through `editorStore.setImports`, which marks the file dirty in the same update; otherwise `useEditorFileContent` would put back the block from disk. A plan that's `null` hides the row and adds nothing. The code is in `src-tauri/src/mdx_esm/` (`plan.rs`).

- **Nothing is added if the name is already imported anywhere in the file,** including imports further down the body, which docs sites use a lot. Two imports of one name break the build, and if the existing one is something else (Starlight's `Card` where the project has its own), the writer's import wins.
- **The path copies another file in the collection where it can,** so a site's aliases and barrel files carry over without reading tsconfig. Relative paths are only copied from the same folder, and imports from the project's `package.json` dependencies are never copied for a project component, since they're a different component with the same name. Otherwise it's a relative path with the extension, as Astro's docs write it.
- **Edits splice text into the block** (`edit.rs`), so the writer's formatting, comments and blank lines survive. A block that isn't only imports and exports gets no plan at all.
- **React components can be named exports.** The scanner records `named_export`; Astro, Vue and Svelte components are always default exports, and Starlight's are named.

`test/mdx-imports/sites/` has a small site for each way sites write imports, with cases in `cases.toml` that `cases_in_test_sites` runs. Add a case there for anything found in the wild. To check that added imports work, insert components in `temp-dummy-astro-project` or a copy of `test/starlight-minimal`, then run `bun install` and `bun run build` there. The dummy project renders every entry (`src/pages/[collection]/[...id].astro`), so a missing or wrong import fails the build.

## Starlight's components

In projects whose `package.json` depends on `@astrojs/starlight`, the builder adds Starlight's built-in components. They aren't read from the project's `node_modules`: the package layout has changed between versions, and some props (Badge's come from a Zod schema) need a real type checker.

Instead `scripts/starlight-components/generate.ts` reads them at our build time with TypeScript 6's compiler API and writes `src-tauri/src/mdx_components/starlight-components.json`, which the app bundles. `scripts/starlight-components/overrides.ts` adds what types can't say: descriptions, the content inserted inside `Tabs`, `Steps` and friends, value order, and props to hide.

To update for a new Starlight release, run `bun scripts/starlight-components/generate.ts latest` and commit the JSON. With no argument it regenerates for the version already in the JSON. It fails if Starlight adds, removes or changes a component the overrides describe, so changes get looked at rather than shipped blind.

## Testing against real components

- `test/dummy-astro-project/src/components/mdx/` has a component for each prop kind and framework pattern. `src/pages/components.astro` renders the Astro ones so the project's build checks them, and a Rust test asserts what's read from them. The project has the MDX, React, Vue and Svelte integrations, so the framework components build when an MDX file imports them.
- `test/mdx-components/` holds real components from open source sites (see its README). `cargo test --lib dump_all_fixtures -- --ignored --nocapture` in `src-tauri` prints what each reads as; use it when changing the parser.
