# Task: Write Documentation Content

Write the actual documentation for Astro Editor to the starlight site in `website/`. Most content will be written by hand with AI assistance and new screenshots will be taken to replace/supplement the current ones. The existing user guide at `docs/user-guide.md` is the starting point for content but is somewhat out of date.

## Main Docs Section

### Getting Started

- [ ] Intro & Overview (of the Main Window)
- [ ] Fundamental Concepts
- [ ] A Simple Example - example schema, file tree and file + how they look in the editor
- [ ] Installation - mention cross-platform stuff
- [ ] Opening a Project - briefly mention how to configure most common path overrides

### Philosophy

- [ ] Overview and Why - The first bit of the demo video but simplified
- [ ] Core Principles

### The Editor

- [ ] Overview
  - How it looks & what's not shown
  - responsive typography
  - hanging headers
  - Custom heading color & font size
- [ ] Focus mode
- [ ] Typewriter mode
- [ ] Copyedit modes
- [ ] Auto-Saving

### Editing Features

- [ ] Overview
  - Basic Markdown Features
  - Headers (Keyboard shortcut)
- [ ] Inserting Links
  - [ ] Cmd+K and paste over text
  - [ ] Clicking links
- [ ] Inserting links to other content items (Content Linker)
- [ ] Inserting and Previewing Images & Files
  - [ ] Inserting images and files
  - [ ] Previewing images on hover
- [ ] Inserting Components in MDX files
  - [ ] "MDX" Astro Components
  - [ ] React/Vue/Svelte Components

### File Management (Left Sidebar)

- [ ] Overview
  - Opening a Project & Viewing Collections
  - What's shown + MDX label + Subfolders etc
- [ ] Drafts (+ Drafts filter)
- [ ] Filtering and sorting
- [ ] IDE Integration & Context Menu
- [ ] Creating new files

### Frontmatter & Schemas (Right Sidebar)

- [ ] Overview
  - Intro & Screenshot
  - How schemas & frontmatter are parsed/ordered in the sidebar
- [ ] Basic Field Types (& their Display)
  - [ ] Nested fields
- [ ] Image Fields
- [ ] Reference Fields
- [ ] Special Fields
    - Title
    - Description
- [ ] Required Fields & Descriptions
- [ ] Examples

### Preferences

- [ ] General Pane
- [ ] Project Pane
- [ ] Collections Pane
- [ ] Advanced Pane

### Other Bits

- [ ] The Command Palette
- [ ] Troubleshooting

## Reference Section

These docs are technical reference docs for users rather than guides. Their job is not to teach.

- [ ] Keyboard Shortcuts - Full list of shortcuts
- [ ] Special Fields - reference for special field names & their behaviours
  - title
  - description
  - pubdate/date
  - draft?
  - slug (used when inserting links to other content items if a URL override is set)
- [ ] Overrides - Reference for **exactly** what each path/field override field does
- [ ] Advanced Preferences & Project Store (The preferences JSON files etc)
- [ ] How YAML is read/written/formatted

## Releases Section

This is already implemented.
