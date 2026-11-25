# Loaders

The personal site's collections plus the loader shapes AE can't read from the content config: custom loaders, third-party ones, inline ones, and collections imported or spread into the config. It's for comparing what AE infers about each collection with what Astro writes to its data store. `bun run reset:testprojects` copies it to `temp-test-projects/loaders`, which is gitignored. Open that copy, not this one.

`.astro/data-store.json` is committed with the other generated files, so the copy has a data store without anyone running Astro. After changing the content config or the content, run `bun run dev` here briefly to regenerate it, and commit what changes.

Run `bun install`, then `bun run dev` or `bun run build`. Nothing needs the network or secrets. The home page lists every collection's entries with their files and resolved references, and each Markdown or MDX entry has a page at `/<collection>/<id>/`, so a loader that's set up wrong shows up as a missing collection or a failed build. `astro dev` writes the data store to `.astro/data-store.json`; `astro sync` and `astro build` write it to `node_modules/.astro/data-store.json`.

Three warnings are expected:

- `astro-loader-obsidian` declares its schema as a function, which Astro 7 ignores.
- Astro can't make a JSON schema for `garden`, because `ObsidianDocumentSchema` is a zod 3 schema. Its entries still validate.
- `bookmarks` doesn't exist or is empty, because its loader stores nothing.

| Collection | Loader | Files | What AE infers from the config |
| --- | --- | --- | --- |
| `blog`, `notes`, `docs` | `glob()` | `src/content/blog`, `src/content/notes`, `src/docs` | Read from the config |
| `authors`, `links` | `file()` JSON, `glob()` YAML | `src/data` | Data, read from the config |
| `journal` | Inline object loader that calls `glob()` | `writing/journal` | Unknown: looks in `src/content/journal`, which doesn't exist |
| `bookmarks` | Custom loader that stores nothing | None | Unknown. Absent from the store, like a loader that failed |
| `recipes` | `markdownFolder()` from `src/loaders`, wraps `glob()` | `src/content/recipes` | Unknown, but the `src/content/<name>` guess is right |
| `talks` | `markdownFolder()` | `talks/`, with year subfolders and MDX | Unknown: looks in `src/content/talks` |
| `pages` | `i18nLoader()` from `astro-loader-i18n`, wraps `glob()` | `src/i18n-pages/{en,de}` | Data, since Starlight's `i18nLoader` has the same name |
| `garden` | `ObsidianMdLoader()` from `astro-loader-obsidian` | `vault/`, file names with spaces | Unknown. Astro can't generate its JSON schema (zod 3), and its ids are slugs, not file names |
| `podcasts` | `glob()`, imported from `src/collections/podcasts.ts` | `src/podcasts` | Unknown. Its `host` references `team` |
| `team` | `jsonRecords()` from `src/loaders`, wraps `file()` | `src/data/team.json` | Unknown |
| `scrobbles` | `apiRecords()`, a stand-in for an AT Protocol or Notion loader | None | Unknown. In the store with ids and data, no files |
| `guides` | `glob()`, spread in from `src/collections/extra.ts` | `src/guides` | Missing entirely |

`astro-loader-obsidian` 0.10.0 needs `hast-util-from-html` installed alongside it on Astro 7. The MDX files use their components without importing them, so the entry page passes them to `<Content components>`.
