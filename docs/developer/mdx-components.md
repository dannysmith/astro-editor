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

## Starlight's components

In projects whose `package.json` depends on `@astrojs/starlight`, the builder adds Starlight's built-in components. They aren't read from the project's `node_modules`: the package layout has changed between versions, and some props (Badge's come from a Zod schema) need a real type checker.

Instead `scripts/starlight-components/generate.ts` reads them at our build time with TypeScript 6's compiler API and writes `src-tauri/src/mdx_components/starlight-components.json`, which the app bundles. `scripts/starlight-components/overrides.ts` adds what types can't say: descriptions, the content inserted inside `Tabs`, `Steps` and friends, value order, and props to hide.

To update for a new Starlight release, run `bun scripts/starlight-components/generate.ts latest` and commit the JSON. With no argument it regenerates for the version already in the JSON. It fails if Starlight adds, removes or changes a component the overrides describe, so changes get looked at rather than shipped blind.

## Testing against real components

- `test/dummy-astro-project/src/components/mdx/` has a component for each prop kind and framework pattern. `src/pages/components.astro` renders the Astro ones so the project's build checks them, and a Rust test asserts what's read from them.
- `test/mdx-components/` holds real components from open source sites (see its README). `cargo test --lib dump_all_fixtures -- --ignored --nocapture` in `src-tauri` prints what each reads as; use it when changing the parser.
