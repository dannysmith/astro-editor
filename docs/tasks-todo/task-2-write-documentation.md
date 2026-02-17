# Task: Write Documentation Content

Write the actual documentation for Astro Editor to the starlight site in `website/`. Most content will be written by hand with AI assistance and new screenshots will be taken to replace/supplement the current ones. The existing user guide at `docs/user-guide.md` is the starting point for content but is somewhat out of date.

## Main Docs Section

### Getting Started

- [ ] Intro & Overview of the Main Window
- [ ] Fundamentals Concepts
- [ ] A Simple Example
- [ ] Installation
- [ ] Opening a Project
- [ ] Troubleshooting
- [ ] Philosophy
  - [ ] Why? - The first bit of the demo video but simplified
  - [ ] Core Principles

### The Editor

- [ ] How it looks: responsive typography | hanging headers | Custom heading color
- [ ] Focus mode
- [ ] Typewriter mode
- [ ] Copyedit modes

### Editing Features

- [ ] Basic Markdown Features
- [ ] Headers (Keyboard shortcut)
- [ ] Inserting Links
  - [ ] Cmd+K and paste over text
  - [ ] Clicking links
- [ ] Inserting links to other content items
- [ ] Inserting and Previewing Images & Files
  - [ ] Inserting images and files
  - [ ] Previewing images
- [ ] Inserting Components
  - [ ] "MDX" Astro Components
  - [ ] React/Vue/Svelte Components

### File Management (Left Sidebar)

- [ ] Opening a Project & Viewing Collections
- [ ] What's shown + MDX label + Subfolders etc
- [ ] Drafts + Drafts filter
- [ ] Filtering and sorting
- [ ] Context Menu
- [ ] Openingfiles, collections and projects in your IDE

### Frontmatter & Schemas (Right Sidebar)

- [ ] Basics of the sidebar
  - [ ] How schemas & frontmatter are parsed/ordered
- [ ] Basic Types & their Display
- [ ] Image Fields
- [ ] Reference Fields
- [ ] Special Fields
    - [ ] Title
    - [ ] Description
    - [ ] Slug
- [ ] Required Fields & Descriptions
- [ ] Examples


### The Command Palette & Keyboard Shortcuts

- [ ] Commands
- [ ] Global Keyboard Shortcuts

### Preferences

- [ ] General Pane
- [ ] Project Pane
- [ ] Collections Pane
- [ ] Advanced Pane

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
