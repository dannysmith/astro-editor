# Unusual structure

An Astro site whose collections are laid out in ways Astro Editor has to work out from the content config rather than assume `src/content/<name>`. Open it in the dev app with `bun run app open-project test/unusual-structure`.

| Collection | Where its files are | What it checks |
| --- | --- | --- |
| `posts` | `src/posts` | Content outside `src/content`; a draft field (`unpublished`) that has to be set, because it isn't detected; `_idea.md` left out by the pattern |
| `field-notes` | `src/notes` | A quoted key that isn't the variable's name; a `new URL(…, import.meta.url)` base; an array pattern leaving out `README.md` and `archive/` |
| `guides` | `content/guides` | A pattern prefix (`guides/**`) on a shared base; MDX only, so new files are `.mdx` |
| `projects` | `content/projects` | A folder per entry (`**/index.md`); new files are `<date>/index.md` |
| `feed` | `src/content/feed` | A loader Astro Editor can't read, so it looks in the content folder by name |

`.astro-editor.json` sets some settings for everyone who edits the site: the project's assets folder and frontmatter reordering, `field-notes`' file names and skipped files, and `guides`' link URLs and sort. It also has settings for `recipes`, which the content config doesn't have, so Project Settings warns about it. `posts`' draft field is left for you to set.

The site icon is `public/favicon.ico`, to check the project icon reads ICO files. (`personal-site` has an SVG, `dummy-astro-project` a PNG, and `starlight-minimal` none.)

After changing `src/content.config.ts`, run `bun install` and `bun run astro sync` here and commit the regenerated `.astro/collections/`.
