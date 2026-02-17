# Task: Replace Static Website with Starlight Documentation Site

Replace the current static `index.html` in `website/` with an Astro + Starlight documentation site, modelled on the Taskdn project's website (`~/dev/taskdn/website/`). The homepage content stays essentially the same for now (Task 3 will redesign it). Documentation content is stub-only (Task 2 will write it).

## Context

- **Current state**: `website/` contains a static `index.html` (Tailwind CDN, dark theme, marketing page with feature sections, YouTube embed, download buttons), favicon assets, screenshot PNGs, and three installer binaries (`astro-editor-latest.{dmg,msi,AppImage}`).
- **Deployment**: Two GitHub Actions workflows:
  - `deploy-website.yml` — deploys `website/` to GitHub Pages on push to `main` when `website/**` changes
  - `publish-website-artifacts.yml` — on release publish, downloads binaries from the GH release, copies them as `astro-editor-latest.*` into `website/`, commits to `main`, triggers deploy
- **Domain**: `astroeditor.danny.is` (CNAME on GitHub Pages)
- **Analytics**: Simple Analytics (privacy-first, no cookies)
- **Reference**: Taskdn website at `~/dev/taskdn/website/` — same stack but multi-product (has `product` enum in schema, multiple sidebar sections). Astro Editor is single-product so simpler.
- **33 historical releases** on GitHub (v0.1.1 through v1.0.10). Release bodies range from minimal ("No user-facing changes") to rich markdown with images. Post-1.0.0 releases should all get changelog pages; pre-1.0.0 are case-by-case.

## Follow-up Tasks

- **Task 2** — Write actual documentation content (by hand with AI help, new screenshots)
- **Task 3** — Complete homepage redesign (rebuild `index.astro` from scratch with proper Astro features)

---

## Phase 0: Repo Setup

- [ ] Backup current website: `mv website/ website-old/` (git-tracked, recoverable)
- [ ] Add website build artifacts to root `.gitignore`: `website/dist/`, `website/.astro/`, `website/node_modules/`

No GH Actions changes yet — they'll be broken on this branch which is fine.

---

## Phase 1: Build Out Starlight Site [✅ DONE]

Core scaffolding, config, and all structural pages.

### 1.1 Scaffold & Dependencies

- [ ] Scaffold Starlight project in `website/` using the CLI to get latest configs:
  ```bash
  npm create astro@latest -- --template starlight website
  ```
  (`website/` won't exist after Phase 0 backup, so this should work directly)
- [ ] Ensure `package.json` has `"type": "module"` and standard scripts:
  ```json
  {
    "scripts": {
      "dev": "astro dev",
      "start": "astro dev",
      "build": "astro build",
      "preview": "astro preview",
      "astro": "astro",
      "check": "astro check && tsc --noEmit && bun run lint && bun run format:check",
      "lint": "eslint .",
      "lint:fix": "eslint . --fix",
      "format": "prettier --write .",
      "format:check": "prettier --check ."
    }
  }
  ```
- [ ] Install runtime deps: `@astrojs/starlight`, `astro`, `sharp`, `starlight-theme-flexoki`, `starlight-llms-txt`, `starlight-kbd`
- [ ] Install dev deps: `@astrojs/check`, `typescript`, `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-astro`, `prettier`, `prettier-plugin-astro`

### 1.2 Configuration Files

- [ ] `astro.config.mjs` — Starlight with:
  - Site: `https://astroeditor.danny.is`
  - Plugins: Flexoki theme (blue accent), llms.txt, kbd (macOS default + Windows)
  - Title: `Astro Editor`
  - Description: `Schema-aware markdown editor for Astro content collections`
  - Footer component override
  - Logo from `src/assets/`
  - Favicon: `/favicon.png`
  - Social: GitHub (`https://github.com/dannysmith/astro-editor`)
  - Head: OG meta, Twitter card, Simple Analytics script
  - Sidebar: Getting Started link + Releases link (expand in Phase 4)
- [ ] `tsconfig.json` — extends `astro/tsconfigs/strict`, path aliases (`@components`, `@layouts`, `@assets`)
- [ ] `eslint.config.js` — JS recommended + TS recommended + Astro recommended, ignoring `dist/`, `.astro/`, `node_modules/`
- [ ] `prettier.config.js` — no semi, single quotes, tab width 2, trailing comma es5, astro plugin
- [ ] `.prettierignore` — `dist/`, `.astro/`, `node_modules/`, `bun.lock`, `*.md`, `*.mdx`
- [ ] `website/.gitignore` — `dist/`, `.astro/`, `node_modules/`, `npm-debug.log*`, `.env`, `.env.production`, `.DS_Store`
- [ ] `website/AGENTS.md` — Starlight/Astro-specific AI instructions (build up over time). Include: Astro/Starlight version, key patterns, content conventions
- [ ] `website/CLAUDE.md` — just `@AGENTS.md` (same pattern as root project)

### 1.3 Content Collection & Components

- [ ] `src/content.config.ts` — docs collection with `date` field extension (no `product` field)
- [ ] `src/components/Footer.astro` — wraps Starlight default footer, adds copyright ("Danny Smith") + privacy policy link
- [ ] `src/layouts/Layout.astro` — standalone layout for non-Starlight pages (homepage). Flexoki palette, full meta tags, Simple Analytics. See reference implementation appendix below.

### 1.4 Homepage

- [ ] `src/pages/index.astro` — port current `index.html` content into Astro component using standalone `Layout.astro`
  - Keep Tailwind CDN for now (Task 3 will handle properly)
  - **Gotcha**: Inline `<script>` tags need `is:inline` or Astro's build pipeline will process them. Applies to the Tailwind config script AND the JSON-LD structured data. The CDN `<script src="...">` is fine as-is (Astro leaves external URLs alone).
  - Same hero, feature sections, YouTube embed, download buttons, "how it works", footer
  - Move screenshot images to `src/assets/` (Astro-optimized) or keep in `public/` as-is
  - Update "Docs" nav link to point to `/getting-started/` instead of GitHub user guide
  - Preserve structured data (schema.org JSON-LD)

### 1.5 Static Files & Content

- [ ] `public/favicon.png` (and other favicon variants from current site)
- [ ] `public/robots.txt` — `User-agent: * / Allow: / / Sitemap: https://astroeditor.danny.is/sitemap-index.xml`
- [ ] `public/CNAME` — `astroeditor.danny.is`
- [ ] `public/og-image.png` — carry over from current site
- [ ] Copy installer binaries to `public/`: `astro-editor-latest.{dmg,msi,AppImage}`
- [ ] `src/content/docs/privacy.mdx` — adapted from Taskdn's privacy policy (change product name, GitHub link, product descriptions for desktop-only app)
- [ ] `src/content/docs/getting-started.mdx` — stub placeholder so docs links and sidebar work

### 1.6 Verify

- [ ] `bun run build` succeeds
- [ ] `bun run preview` — homepage looks right, docs shell works, privacy page renders, getting started stub loads

---

## Phase 2: Changelog System & Release Integration  [✅ DONE]

### 2.1 Releases Pages

- [ ] `src/pages/releases/index.astro` — uses `StarlightPage`, lists all releases sorted by date descending
- [ ] Add `Releases` sidebar entry in `astro.config.mjs` linking to `/releases/`

### 2.2 Historical Release Generation

- [ ] Write a one-off script (e.g. `scripts/generate-release-pages.ts`) that:
  - Fetches all releases via `gh release list` + `gh release view`
  - For post-1.0.0 releases: generates `.mdx` file in `src/content/docs/releases/`
  - For pre-1.0.0 releases: presents each to the user for approval before generating
  - Strips "Installation Instructions" boilerplate from release bodies
  - Converts GitHub-flavoured markdown to MDX-safe content. Known issues in existing releases:
    - v1.0.5, v0.1.37 have HTML `<img>` tags — self-closing, so valid JSX/MDX
    - v1.0.9 has `{slug}` in prose — MDX will interpret `{}` as expressions and break. Must escape as `\{slug\}` or wrap in a code span
  - Both the one-off script AND the CI workflow (Phase 2.3) need this escaping logic
  - File naming: `{version}.mdx` (e.g. `1.0.5.mdx`)
  - Each file has frontmatter: `title`, `description`, `date`
  - Adds "View on GitHub" link at bottom of each page
- [ ] Run the script, review output, commit the generated release pages
- [ ] Verify releases index page lists them all correctly

### 2.3 Update Release Pipeline

- [ ] Update `publish-website-artifacts.yml` to also:
  - Fetch release body via `gh release view "$RELEASE_TAG" --json body`
  - Generate a new `.mdx` file in `website/src/content/docs/releases/`
  - Copy binaries to `website/public/` (not `website/` — Astro serves from `public/`)
  - Commit both the binaries AND the new release page
  - Keep the explicit `gh workflow run deploy-website.yml` trigger — commits from the GitHub bot user don't trigger `on: push` workflows, so the explicit dispatch is required

---

## Phase 3: Deployment [✅ DONE]

### 3.1 Update GitHub Actions

- [ ] Update `deploy-website.yml`:
  - Add `oven-sh/setup-bun@v2` step
  - Add `bun install` step (working-directory: `website`)
  - Add `bun run build` step (working-directory: `website`)
  - Change upload artifact path from `./website` to `./website/dist`
- [ ] Update `publish-website-artifacts.yml`:
  - Binary destination: `website/public/` (Astro copies `public/` into `dist/` at build)
  - Release page generation (from Phase 2.3) already wired in

### 3.2 Cleanup & Verify

- [ ] Remove `website-old/` directory
- [ ] End-to-end verification: manually trigger `deploy-website.yml` via `workflow_dispatch` or push to main
- [ ] Confirm: site builds, deploys, homepage loads, docs work, releases list, download links work

---

## Phase 4: Documentation Stubs

Placeholder pages so the sidebar has structure. Actual content is Task 2.

- [ ] Create stub `.mdx` pages in `src/content/docs/` based on current user guide structure:
  - Overview / philosophy
  - Installation (macOS, Windows, Linux, Homebrew)
  - Getting started (opening a project, writing, frontmatter)
  - Features (schema-aware forms, focus mode, MDX insertion, etc.)
  - Configuration (three-tier preferences)
- [ ] Update sidebar in `astro.config.mjs` with the documentation structure
- [ ] Each stub has proper frontmatter (`title`, `description`) and a brief placeholder paragraph
- [ ] Verify build still passes with all stubs in place

---

## Reference Implementation Details

The sections below are carried over from the original task document. Since we're scaffolding via CLI (which gives us the latest config formats), treat these as **guidance for what to customize**, not as copy-paste. The CLI-generated configs take precedence for structure/syntax; these snippets show what needs adding on top.

### Directory Structure

```
website/
├── astro.config.mjs
├── package.json
├── tsconfig.json
├── eslint.config.js
├── prettier.config.js
├── .prettierignore
├── .gitignore
├── src/
│   ├── assets/              # Images, logos (processed by Astro)
│   ├── components/
│   │   └── Footer.astro     # Custom footer (Starlight override)
│   ├── content/
│   │   └── docs/            # Documentation content (.mdx files)
│   │       ├── privacy.mdx
│   │       ├── getting-started.mdx
│   │       └── releases/    # Release notes
│   ├── layouts/
│   │   └── Layout.astro     # Standalone page layout (non-Starlight pages)
│   ├── pages/
│   │   ├── index.astro      # Homepage (standalone)
│   │   └── releases/
│   │       └── index.astro  # Releases list (uses StarlightPage)
│   ├── styles/
│   └── content.config.ts
└── public/
    ├── favicon.png
    ├── og-image.png
    ├── robots.txt
    ├── CNAME
    └── astro-editor-latest.{dmg,msi,AppImage}
```

### Content Collection Config

```ts
import { defineCollection } from 'astro:content'
import { docsLoader } from '@astrojs/starlight/loaders'
import { docsSchema } from '@astrojs/starlight/schema'
import { z } from 'astro:content'

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        date: z.coerce.date().optional(),
      }),
    }),
  }),
}
```

### Footer Component

```astro
---
import Default from '@astrojs/starlight/components/Footer.astro'
---

<Default><slot /></Default>

<footer class="sl-footer-links">
  <span>&copy; {new Date().getFullYear()} Danny Smith</span>
  <span class="separator">&middot;</span>
  <a href="/privacy/">Privacy Policy</a>
</footer>

<style>
  .sl-footer-links {
    padding: 1rem var(--sl-content-pad-x);
    text-align: center;
    font-size: var(--sl-text-2xs);
    color: var(--sl-color-gray-3);
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;

    a {
      color: var(--sl-color-gray-3);
      text-decoration: none;

      &:hover {
        color: var(--sl-color-white);
        text-decoration: underline;
      }
    }

    .separator {
      opacity: 0.5;
    }
  }
</style>
```

### Standalone Layout

```astro
---
interface Props {
  title: string
  description: string
  image?: string
}

const { title, description, image = '/favicon.png' } = Astro.props
const canonicalURL = new URL(Astro.url.pathname, Astro.site)
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/png" href="/favicon.png" />
    <link rel="canonical" href={canonicalURL} />

    <title>{title}</title>
    <meta name="title" content={title} />
    <meta name="description" content={description} />

    <meta property="og:type" content="website" />
    <meta property="og:url" content={canonicalURL} />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:image" content={new URL(image, Astro.site)} />
    <meta property="og:site_name" content="Astro Editor" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content={canonicalURL} />
    <meta name="twitter:title" content={title} />
    <meta name="twitter:description" content={description} />
    <meta name="twitter:image" content={new URL(image, Astro.site)} />

    <script is:inline async src="https://scripts.simpleanalyticscdn.com/latest.js"></script>
  </head>
  <body>
    <slot />
  </body>
</html>

<style is:global>
  :root {
    color-scheme: light dark;

    --color-bg: #100f0f;
    --color-bg-2: #1c1b1a;
    --color-text: #cecdc3;
    --color-text-muted: #878580;
    --color-accent: #4385be;
    --color-accent-hover: #5b9fd3;
    --color-border: #403e3c;

    --font-sans: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
      Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    --font-mono: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas,
      'Liberation Mono', monospace;
  }

  @media (prefers-color-scheme: light) {
    :root {
      --color-bg: #fffcf0;
      --color-bg-2: #f2f0e5;
      --color-text: #100f0f;
      --color-text-muted: #6f6e69;
      --color-accent: #205ea6;
      --color-accent-hover: #4385be;
      --color-border: #e6e4d9;
    }
  }

  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  img, picture, video, canvas {
    display: block;
    max-width: 100%;
    height: auto;
    margin-inline: auto;
  }

  svg { max-width: 100%; }

  html {
    font-family: var(--font-sans);
    background: var(--color-bg);
    color: var(--color-text);
    line-height: 1.6;
  }

  body {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  a {
    color: var(--color-accent);
    text-decoration: none;
    &:hover {
      color: var(--color-accent-hover);
      text-decoration: underline;
    }
  }
</style>
```

### Releases Index Page

```astro
---
import { getCollection } from 'astro:content'
import StarlightPage from '@astrojs/starlight/components/StarlightPage.astro'

const allDocs = await getCollection('docs')
const releases = allDocs.filter(
  (doc) => doc.id.startsWith('releases/') && doc.data.date
)

const sortedReleases = releases.sort(
  (a, b) => b.data.date!.getTime() - a.data.date!.getTime()
)

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}
---

<StarlightPage
  frontmatter={{
    title: 'Releases',
    description: 'Release notes and changelog',
    tableOfContents: false,
  }}
>
  <p>All releases.</p>

  <ul class="release-list">
    {
      sortedReleases.map((release) => (
        <li>
          <a href={`/${release.id.replace(/\.mdx?$/, '')}/`}>
            {release.data.title}
          </a>
          <span class="release-meta">
            <time datetime={release.data.date!.toISOString()}>
              {formatDate(release.data.date!)}
            </time>
          </span>
        </li>
      ))
    }
  </ul>
</StarlightPage>

<style>
  .release-list {
    list-style: none;
    padding: 0;
  }
  .release-list li {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--sl-color-gray-5);
  }
  .release-meta {
    font-size: 0.875rem;
    color: var(--sl-color-gray-3);
  }
</style>
```

### Release Page Format

Each file in `src/content/docs/releases/` (e.g. `1.0.5.mdx`):

```mdx
---
title: 'v1.0.5'
description: 'Astro Editor v1.0.5'
date: 2026-01-07
---

Summary of what changed.

## What's Changed

* Feature X
* Bug fix Y

---

[View on GitHub](https://github.com/dannysmith/astro-editor/releases/tag/v1.0.5)
```

### Writing Documentation Content

All docs go in `src/content/docs/` as `.mdx` files. Starlight routes them automatically based on file path.

**Frontmatter** — every page requires:

```yaml
---
title: 'Page Title'
description: 'One sentence for SEO'
---
```

**Available Components** (import from `@astrojs/starlight/components`):

- **Tabs / TabItem** — OS/package-manager variants. Use `syncKey` for cross-page sync (`pkg`, `os`, `shell`)
- **Aside** — callout boxes (`note`, `tip`, `caution`, `danger`). Also `:::tip` markdown syntax
- **LinkCard / Card / CardGrid** — navigation cards and feature grids
- **Steps** — styled numbered step lists (wrap around ordered list)
- **FileTree** — directory structure diagrams
- **Badge** — inline labels
- **Kbd** (from `starlight-kbd/components`) — keyboard shortcuts: `<Kbd mac="Command+S" windows="Control+S" />`

**Code Blocks** (Expressive Code):

- Always specify language: `` ```bash ``, `` ```json ``, etc.
- `bash` renders as terminal frame
- `title="filename.ext"` for file name header
- `frame="none"` for non-runnable snippets
- Line highlighting: `{2,4-5}`, text markers: `"config"`, diff: `ins={2} del={1}`

**Images** — live in `src/assets/`, import with `@assets` alias:

```mdx
import { Image } from 'astro:assets'
import screenshot from '@assets/my-screenshot.png'

<Image src={screenshot} alt="Description" />
```
