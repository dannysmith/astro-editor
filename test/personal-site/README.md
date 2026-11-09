# Personal site

A small personal site laid out the way real ones are, for trying project and collection settings: field mappings, folder and assets overrides, the MDX components folder, file name patterns and files the pattern leaves out. `bun run reset:testprojects` copies it to `temp-test-projects/personal-site`, which is gitignored. Open that copy, not this one, since trying settings renames and adds files.

| Collection | Where its files are | What it checks |
| --- | --- | --- |
| `blog` | `src/content/blog` | Everything detected. Dated file names, a `2024/` subfolder, a `slug` that clashes with a title-based name (`reading`), a draft, and `_half-finished-thought.md` left out by the pattern. Uses `Callout` and `YouTube` from `src/components/mdx`, and a cover image in `src/assets/blog` |
| `notes` | `src/content/notes` | No field AE detects: the title is `name`, the description `summary`, the date `created`, the draft `hidden`. Title-only file names. The pattern (`*.md`) only takes top-level files, so `archive/old-note.md` is left out and new files can't go in `archive/` |
| `docs` | `src/docs` | Outside `src/content`, a folder per page (`**/index.mdx`), MDX only, no date or draft. Uses `Steps`, `Tip` and `ApiTable` from `src/components/docs`, and an image next to the page |
| `journal` | `writing/journal` | A loader AE can't read, so it looks in `src/content/journal`, which doesn't exist. Fixed either with the collection's Folder or the project's Content Folder (`writing`). Date-only file names |
| `authors`, `links` | `src/data` | Data collections: a `file()` JSON referenced by `blog`'s `author`, and a glob of YAML |

There are two components folders: `src/components/mdx` (the default) and `src/components/docs`. The MDX Components Folder setting is project-wide, so pointing it at one hides the other's components everywhere. `public/favicon.svg` is a site icon.

After changing `src/content.config.ts`, run `bun install` and `bun run astro sync` here and commit the regenerated `.astro/`.
