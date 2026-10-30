# MDX component fixtures

Real-world MDX components for testing how the component builder reads props. They aren't an Astro project; nothing here builds or runs.

- `dannyis/`: the MDX components from danny.is (`src/components/mdx/`), copied as they were on 2026-10-28.
- `starlight/`: Starlight 0.42.5's built-in components (`dist/user-components/`) plus the `.d.ts` files their prop types import from, keeping their relative paths. MIT licensed, see `starlight/LICENSE`.
- `astro-embed/`: MDX embed components from [delucis/astro-embed](https://github.com/delucis/astro-embed) (`packages/astro-embed-*/`, keeping each package's folder), plus the sibling `types.ts` files their props import, at commit `7c308fc4`. MIT licensed, see `astro-embed/LICENSE`.
- `astro-docs/`: components used in MDX on docs.astro.build, from [withastro/docs](https://github.com/withastro/docs) (`src/components/`, keeping `tutorial/` and `tabs/`) at commit `a4a9bcc3`. MIT licensed, see `astro-docs/LICENSE`.
- `astro-cactus/`: date, pagination and collection-entry components from [chrismwilliams/astro-theme-cactus](https://github.com/chrismwilliams/astro-theme-cactus) (`src/components/` and `src/types.ts`) at commit `728f1f4e`. They import types through the `@/` alias, which the builder doesn't follow. MIT licensed, see `astro-cactus/LICENSE`.
- `astro-examples/`: React, Preact, Svelte and Astro components from the official starters in [withastro/astro](https://github.com/withastro/astro) (`examples/*/src/components/`, one folder per example) at commit `5e476365`. MIT licensed, see `astro-examples/LICENSE`.
- `expressive-code/`: the `<Code>` component from [expressive-code/expressive-code](https://github.com/expressive-code/expressive-code) (`packages/astro-expressive-code/components/`) at commit `a303b445`. Its props come from an imported interface that extends a mapped type over a package type. MIT licensed, see `expressive-code/LICENSE`.
- `kestra-docs/`: MDX content components from [kestra-io/docs](https://github.com/kestra-io/docs) (`src/components/content/` and `src/components/docs/`), including Vue components with runtime `defineProps({...})`, at commit `98c6279a`. Apache-2.0 licensed, see `kestra-docs/LICENSE`.
