# MDX component fixtures

Real-world MDX components for testing how the component builder reads props. They aren't an Astro project; nothing here builds or runs.

- `dannyis/`: the MDX components from danny.is (`src/components/mdx/`), copied as they were on 2026-10-28.
- `starlight/`: Starlight 0.42.5's built-in components (`dist/user-components/`) plus the `.d.ts` files their prop types import from, keeping their relative paths. MIT licensed, see `starlight/LICENSE`.
