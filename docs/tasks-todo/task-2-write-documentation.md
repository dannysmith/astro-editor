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

- [ ] Overview
  - Intro & Screenshot
  - How schemas & frontmatter are parsed/ordered in the sidebar
- [ ] Field Types
  - Basic fields (table)
  - Nested fields
  - Image Fields
  - Reference Fields
  - Required Fields, Descriptions & Constraitns
- [ ] Special Fields - reference for special field names & their behaviours
  - title
  - description
  - pubdate/date
  - draft?
  - slug (used when inserting links to other content items if a URL override is set)

### Preferences

- [ ] Preferences
  - General Pane
  - Project Pane
  - Collections Pane
  - Advanced Pane

## Reference Section

These docs are technical reference docs for users rather than guides. Their job is not to teach.

- [ ] Keyboard Shortcuts - Full list of shortcuts
- [ ] Overrides - Reference for **exactly** what each path/field override field does
- [x] The URL Scheme
- [ ] The Command Pelette
- [ ] Advanced Preferences & Project Store (The preferences JSON files etc)
- [ ] How YAML is read/written/formatted

## Releases Section

This is already implemented.

## Other Files

- [x] Privacy
