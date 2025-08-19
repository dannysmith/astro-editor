# Astro Editor

![Screenshots of Astro Editor](docs/assets/header.png)

## Features

- Super-clean, minimal markdown editor inspired by iA Writer, supporting markdown and MDX files. Hides YAML frontmatter and component imports so you can focus on your writing.
- User-friendly frontmatter panel based on the file's frontmatter **and the collection schema**, including validation and a specific UI for common fields like `title` and `description` (configurable).
- In MDX files, `Cmd + /` opens a palette to quickly insert Astro components intended for use in MDX files (e.g., `<Callout>`). Props can be selected and tabbed through after insertion. Available components and their props are read from your Astro project. Defaults, slots, and required props are respected.
- File List sidebar ordered by `pubDate` field (not filename), with drafts clearly marked (configurable).
- Dragging images/files into the editor copies them to your Astro `assets` folder (with a web-safe filename) and inserts the correct markdown tag.
- Focus and typewriter mode à la iA Writer.
- Command palette for quick access to all commands, including _Open Project/Collection/Current File_ in your configured IDE.
- Duplicate, rename, and create new files easily.
- Keyboard shortcuts for inline markdown formatting, toggling headings, etc. Pasting URLs over selected text inserts a link tag. Holding option makes URLs clickable. Multiple cursors à la VSCode.
- Autosave & crash recovery.

https://github.com/user-attachments/assets/89b87f98-88c0-4845-a020-284201464b86

## Supported Astro Projects

- Supported Astro Versions: > 5.x
- Supported Content Collections: Astro 4+ [content collections](https://docs.astro.build/en/guides/content-collections/) defined in `content.config.ts` using the `glob` loader. Non-`.md/.mdx` files in these collections will be ignored.

By default, Astro Editor expects the following structure in your Astro project:

```
my-astro-site
└── src
    ├── assets
    │   └── mycollection
    │       └── image1.png
    ├── components
    │   └── mdx
    │       └── ExampleAstroComponent.astro
    ├── content
    │   └── mycollection
    │       └── blog-post.mdx
    └── content.config.ts
```

The paths to the _Assets_, _Content_, and _MDX Components_ directories (relative to the project root) are configurable per project, but their internal structures are not.

## Installation

Download the [latest Release](https://github.com/dannysmith/astro-editor/releases)

## Documentation

[Read the documentation](https://astroeditor.danny.is/guides/overview/)

## Disclaimer ⚠️

This is a work in progress so it's probably best to commit regularly in your Astro project if you're writing a lot of stuff in Astro Editor.

## Feature Requests & Bug Reports

### Bug Reports

**Please** file an issue if you experience:

- Problems handling your Astro schema, frontmatter, or directory structure
- Problems reading or writing your Markdown/MDX files – especially if it caused corruption or data loss in your Astro site
- Problems handling your "MDX" Astro components
- Changes to how Astro works which have broken something
- Crashes or bugs
- Confusing or unexpected UI behavior or UX
- Debilitating performance issues

### Feature Requests

Feature requests are **always** welcome.

1️⃣ This project is designed to provide a pleasant user experience when authoring or editing markdown & MDX files in the content collections of local Astro sites. It's for when you're in "writer mode", not "coder mode". Everything else about managing an Astro site should happen when you're in "coder mode", and therefore in your text editor & terminal. Anything to do with git, publishing, deploying, or code is **explicitly out of scope** and will remain so.

2️⃣ The goal of this project is **simplicity when writing**, so the UI/UX is intentionally opinionated. Configuration options are deliberately limited to "making it work with your Astro project and no more". I'm unlikely to accept features which add complexity to the UI or customization/extensibility.

I appreciate all feature requests which are mindful of 👆 and are written clearly enough for me to understand them.

### Pull Requests

PRs are most welcome. See [CONTRIBUTING.md](docs/CONTRIBUTING.md)

## Roadmap

See the [GitHub Project](https://github.com/users/dannysmith/projects/5/)

## Thanks 🙏

- [iA Writer](https://ia.net/writer) for the inspiration and [beautiful typefaces](https://github.com/iaolo/iA-Fonts).
- [DarkMatter](https://getdarkmatter.dev/) because [Vadim](https://vadimdemedes.com/) did this before me.

# Development

## Quick Start

### Installation

Ensure you have the Xcode command line tools, node and rust installed (see [here](https://v2.tauri.app/start/prerequisites) for more)

```
xcode-select --install # Command line tools
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh # install rust
node -v # Check you have node installed
```

The clone the repo and run

```
npm install # Install node deps
npm reset:testdata # Create a local astro project for manual testing
npm run tauri:dev # Start the development app (which will install any missing rust dependencies)
```

### Basic Workflow

## Developer Docs

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) and the [developer docs](docs/developer/).
