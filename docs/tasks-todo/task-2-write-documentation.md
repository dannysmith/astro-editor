# Task: Write Documentation Content

Write the actual documentation for Astro Editor to the starlight site in `website/`. Most content will be written by hand with AI assistance and new screenshots will be taken to replace/supplement the current ones. The existing user guide at `docs/user-guide.md` is the starting point for content but is somewhat out of date.

## Main Docs Section

### Getting Started

- [x] Quick Start
- [x] Installation
- [x] Philosophy
  - Intro
  - The first bit of the demo video but simplified
  - Core Principles
- [x] Introduction to AE
  - The Interface
  - A Simple Example - example schema, file tree and file + how they look in the editor
  - Astro Requirements

### The Editor

- [x] Overview
  - Intro
  - Auto-Save
  - How it looks & what's not shown
  - Styling: responsive typography, hanging headersng & typeface etc
- [x] Markdown Formatting
  - Basic Markdown Features
  - Headers (Keyboard shortcut)
- [x] Links
  - Cmd+K and paste over text
  - Clicking links
  - Inserting links to other content items (Content Linker)
- [x] Images & Files
  - Inserting images and files
  - Previewing images on hover
- [x] MDX components
  - "MDX" Astro Components
  - React/Vue/Svelte Components
- [x] Focus & Typewriter Modes
  - Distractionless mode
  - Focus mode
  - Typewriter mode
- [x] Copyedit modes


### File Management (Left Sidebar)

- [x] Overview
  - Opening a Project & Viewing Collections
  - What's shown + MDX label + Subfolders etc
  - Creating new files
  - Context Menu
- [x] Drafts, filtering and sorting
- [x] IDE Integration

### Frontmatter & Schemas (Right Sidebar)

- [x] Overview
  - Intro & Screenshot
  - How schemas & frontmatter are parsed/ordered in the sidebar
- [x] Field Types
  - Basic fields (table)
  - Nested fields
  - Image Fields
  - Reference Fields
  - Required Fields, Descriptions & Constraitns
- [x] Special Fields - reference for special field names & their behaviours
  - title
  - description
  - pubdate/date
  - draft?
  - slug (used when inserting links to other content items if a URL override is set)

### Preferences

- [x] Preferences
  - General Pane
  - Project Pane
  - Collections Pane
  - Advanced Pane

## Reference Section

These docs are technical reference docs for users rather than guides. Their job is not to teach.

- [x] Keyboard Shortcuts - Full list of shortcuts
- [x] Overrides - Reference for **exactly** what each path/field override field does
- [x] The URL Scheme
- [x] The Command Pelette
- [x] Advanced Preferences & Project Store (The preferences JSON files etc)
- [x] How YAML is read/written/formatted

## Releases Section

This is already implemented.

## Other Files

- [x] Privacy

## Reviews
- [x] Full review of docs for anything I've missed.
- [x] Full review of docs for spelling and grammar and correctness and cross-linking and external linking
- [x] Add https://github.com/dlcastillop/starlight-page-actions
- [x] Rejig homepage so it includes linux builds and the like - we'll rebuild properly once this is merged to main.
- [x] Update releases with latest releases
- [x] Review of docs for opportunities to use Starlight and Astro features better
  - Asides (we can use `:::` format and perhaps use the available types better, we can also use custom titles and icons?)
  - Blockquotes and `<details>`.
  - Expressive code features: line highlights, filenames, titles
  - Starlight components: Cards & LinkCards, Steps, Badges, LinkCards, Tabs - Do not overuse these for the sake of it
- [ ] Manual review of styling: underlines under headings? Amy other tweaks to the theme?
- [ ] Remove old user-guide
- [ ] Code Review
- [ ] Merge
