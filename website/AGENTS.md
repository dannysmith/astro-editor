# Claude / AI Agent Instructions for Astro Editor Website

## Project Overview

Public-facing documentation website for Astro Editor, built with Astro + Starlight.

## Stack

- **Framework**: Astro 5.x with Starlight 0.37.x
- **Theme**: starlight-theme-flexoki (blue accent)
- **Plugins**: starlight-llms-txt, starlight-kbd
- **Package Manager**: pnpm (workspace member of root project)
- **Analytics**: Simple Analytics (privacy-first, no cookies)

## Directory Structure

```
website/
├── astro.config.mjs          # Starlight configuration
├── src/
│   ├── assets/                # Images, logos (processed by Astro)
│   ├── components/
│   │   └── Footer.astro       # Custom footer (Starlight override)
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
pnpm run dev          # Start dev server
pnpm run build        # Production build
pnpm run preview      # Preview production build
pnpm run check        # Type check + lint + format check
pnpm run lint         # ESLint
pnpm run format       # Prettier format
```

## Content Conventions

- All docs in `src/content/docs/` as `.mdx` files
- Frontmatter requires `title` and `description`
- Release pages also have a `date` field
- File naming: kebab-case

## Writing Style

- Active voice, second person, present tense
- No time estimates
- Use Starlight components (Tabs, Aside, Steps, etc.) where appropriate
