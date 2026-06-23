# Claude / AI Agent Instructions for Astro Editor Website

## CRITICAL: Package Manager

**Always use `bun`, never `pnpm` or `npm`, when working in `website/`.** This project is fully independent of the root Astro Editor pnpm workspace. It has its own `bun.lock` and `node_modules/`.

## Project Overview

Public-facing documentation website for Astro Editor, built with Astro + Starlight.

## Stack

- **Framework**: Astro 6.x with Starlight 0.40.x
- **Theme**: starlight-theme-flexoki (blue accent)
- **Plugins**: starlight-llms-txt, starlight-kbd
- **Package Manager**: bun (independent of root project's pnpm workspace)
- **Analytics**: Simple Analytics (privacy-first, no cookies)

## Directory Structure

```
website/
├── astro.config.mjs          # Starlight configuration
├── src/
│   ├── assets/                # Images, logos (processed by Astro)
│   ├── components/
│   │   ├── Footer.astro       # Custom footer (Starlight override)
│   │   ├── AEDemo.astro       # Animated "typing" editor demo (see Components)
│   │   ├── Figure.astro       # Captioned image
│   │   └── aedemo/            # AEDemo internals (highlighter + animator)
│   ├── content/
│   │   └── docs/              # Documentation content (.mdx files)
│   │       ├── privacy.mdx
│   │       ├── getting-started.mdx
│   │       └── releases/      # Release notes
│   ├── layouts/
│   │   └── Layout.astro       # Standalone layout (non-Starlight pages)
│   ├── pages/
│   │   ├── index.astro        # Homepage (standalone, not Starlight)
│   │   └── releases/
│   │       └── index.astro    # Releases list (StarlightPage)
│   └── content.config.ts      # Content collection schema
└── public/                    # Static assets (copied as-is to dist/)
```

## Commands

```bash
bun run dev          # Start dev server
bun run build        # Production build
bun run preview      # Preview production build
bun run check        # Type check + lint + format check
bun run lint         # ESLint
bun run format       # Prettier format
```

## Content Conventions

- All docs in `src/content/docs/` as `.mdx` files
- Frontmatter requires `title` and `description`
- Release pages also have a `date` field
- File naming: kebab-case

## Components

Custom components live in `src/components/`. Import them at the top of an `.mdx` file, adjusting the relative depth to the file's location (e.g. `../../../components/` for a page in `docs/editor/`).

### AEDemo — animated editor demo

`AEDemo` renders a faux Astro Editor pane that types markdown out and styles it exactly as the app does (dimmed syntax marks, iA Writer font, editor colours). Prefer it over recording GIFs when showing off markdown or editor behaviour.

```mdx
import AEDemo from '../../../components/AEDemo.astro'

Inline: <AEDemo inline code="This is **bold text** here" />

<AEDemo code={`# A heading

Some **bold** and *italic* text, plus \`inline code\`.

- a list item
`} />
```

- `code` (required) — the markdown to type. Use a template literal with `\n` for multi-line block examples.
- `inline` (optional) — render inline (flows in a sentence) instead of as a block pane.
- `speed` (optional) — milliseconds per character (default 48).
- `animate` (optional) — `loop` (default) types out, holds, and repeats; `once` types out a single time then stops; `none` shows the finished state with no animation.
- Supports CommonMark: headings, bold, italic, inline code, links/images, lists, blockquotes, fenced code blocks, horizontal rules. It does **not** support GFM (tables, task lists, strikethrough) — neither does the app (see issue #266). Don't write demos using those.
- Honours `prefers-reduced-motion` and server-renders a styled final state, so it degrades gracefully without JS. The iA Writer fonts it relies on live in `public/fonts/`.

### Figure — captioned image

Starlight/Astro have no built-in figure component. `Figure` wraps an optimised image with an optional caption — import the image asset and pass it as `src`.

```mdx
import Figure from '../../../components/Figure.astro'
import shot from '../../../assets/my-shot.png'

<Figure src={shot} alt="Required, descriptive alt text" caption="Optional caption." />
```

## Starlight Components

Prefer Starlight's built-in components over hand-rolled markup. Import from `@astrojs/starlight/components` and use them where they fit:

- **`Steps`** — numbered, sequential instructions (install → open → write).
- **`Aside`** (`note` / `tip` / `caution` / `danger`) — callouts. Don't put backticks in the `title` attribute; it renders as plain text.
- **`FileTree`** — directory/file structure diagrams.
- **`Tabs` / `TabItem`** — alternative paths, e.g. per-OS instructions.
- **`LinkButton`** — prominent download/CTA links. The built-in icon set is small (~19 icons, no OS logos); `cloud-download` suits downloads.
- **`Card` / `CardGrid` / `LinkCard`** — feature grids and "next steps" navigation.

Always give images real, descriptive alt text (never the placeholder "alt text"). Internal links use absolute, trailing-slash paths (e.g. `/preferences/`).

## Documentation Structure

The sidebar is manually defined in `astro.config.mjs` using explicit `slug` entries. Sections are organised into directories under `src/content/docs/`.

- **Main docs** are grouped by topic directory (e.g. `getting-started/`, `editor/`, `file-management/`, `frontmatter/`). Most sections have an `overview.mdx` as their first page.
- **Single top-level pages** live at the docs root: `getting-started.mdx` (Quick Start), `preferences.mdx`, and `privacy.mdx`.
- **Reference section** (`reference/`) is for technical reference — keyboard shortcuts, the command list, override settings, the URL scheme, YAML handling, troubleshooting, etc. These document *what* things do, not how to use them.
- **Releases** (`releases/`) are generated from GitHub releases by the `scripts/generate-release-pages.ts` script (run manually, e.g. `npx tsx scripts/generate-release-pages.ts [--all] [--dry-run]`). The releases index page at `src/pages/releases/index.astro` lists them sorted by date. Don't create release pages by hand.

## Writing Style

- Active voice, second person, present tense
- No time estimates
- Reach for the components above (Starlight's and our own) rather than hand-rolled markup — see [Components](#components) and [Starlight Components](#starlight-components)
