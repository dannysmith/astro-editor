# Task: Set Up Starlight Documentation Website

Set up an Astro + Starlight documentation site in `website/`, replacing the existing static `index.html`. The setup mirrors the Taskdn project's website architecture. The existing `index.html` has Simple Analytics already configured — that should be carried over.

For reference, the Taskdn website is at `~/dev/taskdn/website/`. Unlike the Astro Editor repo, `~/dev/taskdn/` is a monorepo with multiple products in it and the website is the documentation for them all.

## Starting Point

The project already has a `website/` directory with a static `index.html` and Simple Analytics. The existing GitHub Actions deploy a static site to GitHub Pages and the production build moves "latest" artefacts into the website dir and commits new releases. The deployment infra stays as-is — this task is about replacing the static site with a proper Astro/Starlight build.

---

## Step 1: Scaffold the Starlight Project

From the repo root:

```bash
cd website
bun create astro@latest -- --template starlight .
```

If the directory isn't empty, you may need to scaffold into a temp dir and move files in. The template gives you a minimal working Starlight site.

After scaffolding, ensure `package.json` has `"type": "module"` and the standard scripts (the template provides these).

---

## Step 2: Install Dependencies

### Runtime Dependencies

```bash
bun add @astrojs/starlight astro sharp starlight-theme-flexoki starlight-llms-txt starlight-kbd
```

- `sharp` — image optimization (used by Astro's `<Image>` component)
- `starlight-theme-flexoki` — Flexoki colour palette theme
- `starlight-llms-txt` — generates `/llms.txt` for LLM consumption of docs
- `starlight-kbd` — keyboard shortcut components with OS variant switching

### Dev Dependencies

```bash
bun add -d @astrojs/check typescript eslint @eslint/js typescript-eslint eslint-plugin-astro prettier prettier-plugin-astro
```

---

## Step 3: Configuration Files

### `astro.config.mjs`

```js
// @ts-check
import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'
import starlightThemeFlexoki from 'starlight-theme-flexoki'
import starlightLlmsTxt from 'starlight-llms-txt'
import starlightKbd from 'starlight-kbd'

export default defineConfig({
  site: 'https://YOUR_SITE_URL',
  integrations: [
    starlight({
      plugins: [
        starlightThemeFlexoki({ accentColor: 'blue' }),
        starlightLlmsTxt(),
        starlightKbd({
          types: [
            { id: 'mac', label: 'macOS', default: true },
            { id: 'windows', label: 'Windows' },
          ],
        }),
      ],
      title: 'Astro Editor',
      // customCss: ['./src/styles/custom.css'],  // Add when needed
      components: {
        Footer: './src/components/Footer.astro',
      },
      logo: {
        src: './src/assets/logo.png',  // Replace with actual logo
        alt: 'Astro Editor Logo',
      },
      favicon: '/favicon.png',  // Place in public/
      description: 'YOUR_SITE_DESCRIPTION',
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/YOUR_REPO',
        },
      ],
      head: [
        // Open Graph
        { tag: 'meta', attrs: { property: 'og:type', content: 'website' } },
        { tag: 'meta', attrs: { property: 'og:site_name', content: 'Astro Editor' } },
        // Twitter Card
        { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
        // Simple Analytics (carry over from existing site)
        {
          tag: 'script',
          attrs: {
            async: true,
            src: 'https://scripts.simpleanalyticscdn.com/latest.js',
          },
        },
      ],
      sidebar: [
        // Structure this for your content. Examples:
        //
        // Manual items:
        // {
        //   label: 'Getting Started',
        //   items: [
        //     { slug: 'getting-started' },
        //     { slug: 'installation' },
        //   ],
        // },
        //
        // Auto-generated from directory:
        // {
        //   label: 'Guides',
        //   autogenerate: { directory: 'guides' },
        // },
        //
        // Collapsed section:
        // {
        //   label: 'Reference',
        //   collapsed: true,
        //   items: [{ slug: 'reference/api' }],
        // },
        //
        // Bare link (e.g. for releases page):
        // {
        //   label: 'Releases',
        //   link: '/releases/',
        // },
      ],
    }),
  ],
})
```

### `tsconfig.json`

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"],
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@components/*": ["src/components/*"],
      "@layouts/*": ["src/layouts/*"],
      "@assets/*": ["src/assets/*"]
    }
  }
}
```

### `eslint.config.js`

```js
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import eslintPluginAstro from 'eslint-plugin-astro'

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...eslintPluginAstro.configs.recommended,
  {
    ignores: ['dist/', '.astro/', 'node_modules/'],
  },
]
```

### `prettier.config.js`

```js
/** @type {import("prettier").Config} */
export default {
  semi: false,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'es5',
  plugins: ['prettier-plugin-astro'],
  overrides: [
    {
      files: '*.astro',
      options: {
        parser: 'astro',
      },
    },
  ],
}
```

### `.prettierignore`

```
dist/
.astro/
node_modules/
bun.lock

# Prettier breaks Starlight-specific syntax
*.md
*.mdx
```

### `.gitignore`

```
dist/
.astro/
node_modules/
npm-debug.log*
.env
.env.production
.DS_Store
```

### `package.json` scripts

Ensure these scripts exist:

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

---

## Step 4: Directory Structure

Create this structure inside `website/`:

```
src/
├── assets/              # Images, logos etc (processed by Astro)
├── components/          # Custom Astro components
│   └── Footer.astro     # Custom footer (Starlight override)
├── content/
│   └── docs/            # All documentation content (.mdx files)
│       └── releases/    # Release notes (changelog entries)
├── layouts/
│   └── Layout.astro     # Standalone page layout (for non-Starlight pages)
├── pages/
│   ├── index.astro      # Homepage (standalone, not Starlight)
│   └── releases/
│       └── index.astro  # Releases index page (uses StarlightPage)
├── styles/              # Global CSS files
└── content.config.ts    # Content collection configuration
public/
├── favicon.png          # Favicon
├── robots.txt           # Robots file
└── CNAME                # GitHub Pages custom domain (if applicable)
```

---

## Step 5: Content Collection Config

Create `src/content.config.ts`:

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

The `date` field is used by release pages. Unlike the reference project (which has multiple products and uses a `product` enum), this project has a single product, so no `product` field is needed.

---

## Step 6: Custom Footer Component

Create `src/components/Footer.astro`:

```astro
---
import Default from '@astrojs/starlight/components/Footer.astro'
---

<Default><slot /></Default>

<footer class="sl-footer-links">
  <span>&copy; {new Date().getFullYear()} YOUR_NAME</span>
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

This wraps Starlight's default footer and adds custom links below it. Registered as a component override in `astro.config.mjs` via `components: { Footer: './src/components/Footer.astro' }`.

---

## Step 7: Standalone Layout for Non-Starlight Pages

Create `src/layouts/Layout.astro` — used by the homepage and any other standalone pages that live outside Starlight's docs shell:

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

    <!-- Primary Meta Tags -->
    <title>{title}</title>
    <meta name="title" content={title} />
    <meta name="description" content={description} />

    <!-- Open Graph -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content={canonicalURL} />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:image" content={new URL(image, Astro.site)} />
    <meta property="og:site_name" content="Astro Editor" />

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content={canonicalURL} />
    <meta name="twitter:title" content={title} />
    <meta name="twitter:description" content={description} />
    <meta name="twitter:image" content={new URL(image, Astro.site)} />

    <!-- Analytics -->
    <script is:inline async src="https://scripts.simpleanalyticscdn.com/latest.js"></script>
  </head>
  <body>
    <slot />
  </body>
</html>

<style is:global>
  :root {
    color-scheme: light dark;

    /* Flexoki-inspired palette */
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

This provides the Flexoki colour palette and a clean baseline for standalone pages. It handles its own meta tags and analytics independently from Starlight (which handles these for docs pages via the config).

---

## Step 8: Homepage (`src/pages/index.astro`)

Create `src/pages/index.astro` using the standalone `Layout.astro`. This is a marketing/splash page that lives **outside** Starlight — it has its own design and doesn't render the Starlight sidebar/nav.

The homepage should include:
- Hero section with product name, tagline, and CTA buttons (link to docs, GitHub, etc.)
- Feature sections showcasing what the product does
- Footer with copyright and links

**Key implementation notes:**

- Import `Layout` from `@layouts/Layout.astro`
- For optimized images, use Astro's `<Image>` component: `import { Image } from 'astro:assets'`
- Link to docs pages using absolute paths (e.g. `/getting-started/`)
- The page is fully standalone — style it however you want, it doesn't inherit Starlight styles

The homepage content will be specific to Astro Editor, so the actual sections and copy should be written when this task is implemented.

---

## Step 9: Releases / Changelog System

The changelog is a collection of hand-written `.mdx` files in `src/content/docs/releases/`. Each release is a separate file.

### Release page format

Each file in `src/content/docs/releases/` follows this pattern:

```mdx
---
title: 'v1.2.0'
description: 'Astro Editor v1.2.0'
date: 2026-02-15
---

Summary of what changed.

## What's Changed

* Feature X by @author in https://github.com/REPO/pull/123
* Bug fix Y by @author in https://github.com/REPO/pull/124

---

[View on GitHub](https://github.com/REPO/releases/tag/v1.2.0)
```

**File naming convention:** `{version}.mdx` (e.g. `1.2.0.mdx`, `0.5.0-beta.1.mdx`).

### Releases index page

Create `src/pages/releases/index.astro`:

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

This page uses `StarlightPage` so it renders inside the Starlight shell (with sidebar, nav, etc.) even though it's a custom Astro page, not a content page.

Add a sidebar link to this page in `astro.config.mjs`:

```js
sidebar: [
  // ... other items ...
  {
    label: 'Releases',
    link: '/releases/',
  },
],
```

---

## Step 10: Static Files in `public/`

Place these in `public/`:

| File          | Purpose                                                                   |
| ------------- | ------------------------------------------------------------------------- |
| `favicon.png` | Site favicon                                                              |
| `robots.txt`  | `User-agent: * / Allow: / / Sitemap: https://YOUR_SITE/sitemap-index.xml` |
| `CNAME`       | GitHub Pages custom domain (if applicable)                                |

Astro auto-generates a sitemap at `/sitemap-index.xml` — the `robots.txt` should reference it.

---

## Step 11: GitHub Actions / Deployment

The existing GitHub Actions workflow deploys a static site to GitHub Pages. Update it so that:

1. The build step runs `bun run build` inside `website/` (instead of just copying static files)
2. The output directory is `website/dist/` (Astro's default build output)
3. The workflow still copies "latest" artefacts into the appropriate location before or after the Astro build

The key change: `website/` is now an Astro project that needs to be **built**, not just served as static files. The GH Actions workflow needs a Node/Bun setup step and a build step.

Typical workflow additions:

```yaml
- uses: oven-sh/setup-bun@v2
- run: bun install
  working-directory: website
- run: bun run build
  working-directory: website
# Then deploy website/dist/ to GitHub Pages
```

---

## Writing Documentation Content

All docs go in `src/content/docs/` as `.mdx` files. Starlight routes them automatically based on file path.

### Frontmatter

Every page requires:

```yaml
---
title: 'Page Title'
description: 'One sentence for SEO'
---
```

### Available Components

In `.mdx` files, import from `@astrojs/starlight/components`:

- **Tabs / TabItem** — for OS/package-manager variants. Use `syncKey` to keep tabs in sync across pages (standard keys: `pkg`, `os`, `shell`)
- **Aside** — callout boxes. Types: `note`, `tip`, `caution`, `danger`. Also available as `:::tip` markdown syntax
- **LinkCard / Card / CardGrid** — navigation cards and feature grids
- **Steps** — styled numbered step lists (wrap around a markdown ordered list)
- **FileTree** — directory structure diagrams
- **Badge** — inline labels
- **Kbd** (from `starlight-kbd/components`) — keyboard shortcuts with OS variants: `<Kbd mac="Command+S" windows="Control+S" />`

### Code Blocks

Starlight uses [Expressive Code](https://expressive-code.com/):

- Always specify language: `` ```bash ``, `` ```json ``, `` ```yaml ``, `` ```typescript ``
- `bash` renders as a terminal frame automatically
- `title="filename.ext"` adds a file name header
- `frame="none"` for syntax snippets that aren't runnable
- Line highlighting: `{2,4-5}`, text markers: `"config"`, diff: `ins={2} del={1}`

### Images

Images live in `src/assets/`. Import with the `@assets` alias and render with Astro's `<Image>`:

```mdx
import { Image } from 'astro:assets'
import screenshot from '@assets/my-screenshot.png'

<Image src={screenshot} alt="Description" />
```

### Custom Components

Custom components live in `src/components/`. Import with the `@components` alias:

```mdx
import MyComponent from '@components/MyComponent.astro'

<MyComponent />
```

---

## Summary Checklist

- [ ] Scaffold Starlight project in `website/`
- [ ] Install all dependencies (runtime + dev)
- [ ] Configure `astro.config.mjs` with plugins, SEO, sidebar
- [ ] Set up `tsconfig.json` with path aliases
- [ ] Set up ESLint, Prettier, and `.prettierignore`
- [ ] Create `src/content.config.ts` with `date` schema extension
- [ ] Create custom `Footer.astro` component override
- [ ] Create standalone `Layout.astro` for non-Starlight pages
- [ ] Create `src/pages/index.astro` homepage (standalone, outside Starlight)
- [ ] Create `src/pages/releases/index.astro` (uses `StarlightPage`)
- [ ] Add initial docs content in `src/content/docs/`
- [ ] Set up `public/` with favicon, robots.txt, CNAME
- [ ] Update GitHub Actions to build the Astro site before deploying
- [ ] Verify Simple Analytics carries over correctly (in both Starlight `head` config and standalone `Layout.astro`)
- [ ] Create a sample release in `src/content/docs/releases/` to verify the changelog works
