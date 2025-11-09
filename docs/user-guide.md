# Astro Editor User Guide

![overview-clean](assets/overview-clean.png)
![overview-editor](assets/Editor-mode.png)

## Overview

Astro Editor provides a clean, pleasant user experience for authoring and editing [Markdown](https://www.markdownguide.org/) & [MDX](https://mdxjs.com/) files in the content collections of local [Astro](https://astro.build/) sites.

### Philosophy

Most folks who publish content with Astro work in two distinct _modes_. We're in **coder mode** when we're editing Astro components, pages, CSS etc. This is best done in a _coding tool_ like VSCode. Whe're in **writer mode** when we're writing or editing prose in markdown. Editors designed for coding are not well suited to this - they have too many distractions and lack the kinds of tools which help with writing and editing prose.

Because of this, it's common for folks to **write** in tools like iA Writer or Obsidian and then switch to VSCode to add frontmatter, build and publish. The workflow often looks something like this:

1. Create a new draft markdown file & start writing
2. Edit and tweak (maybe over a number of sessions)
3. Add frontmatter for things like description, tags etc
4. Build & run locally to check everything works
5. Push to github and deploy/publish

Steps 1-3 are very much _writer mode_ tasks, while 4 & 5 are definitely _coder mode_ tasks. Astro Editor is only concerned with the former, which means:

- Code blocks are not syntax highlighted. If you have code examples in your files you're better off authoring them in a coding tool which can properly lint, format and check your code examples.
- There's no mechanism for comitting or publishing in Astro Editor. You should do that in a code editor or terminal.
- There's no way to preview your writing. The best way to do that is by running your astro site locally with `pnpm run dev` and looking at it there.

Because the goal of this **simplicity when in writer mode**, Astro Editor is intentionally opinionated about its UI and limits the user customisation features to _"making it work with your Astro project and no more"_. It's not possible to customise the colour schemes, typeface etc. If you need fine-grained customization & extensibility we recommend using a custom profile in VSCode (or Obsidian) which you've set up for Markdown editing.

### Astro Requirements

Astro Editor will only work properly with Astro projects which:

- Are using Astro 5+ _(it might work with Astro 4+ but you should expect a few bugs)_
- Use Astro [Content Collections](https://docs.astro.build/en/guides/content-collections/) and have a `src/content/config.ts` or `src/content.config.ts` file.
- Have at least one collection defined with `defineCollection`. It **must** use the `glob` loader and have a `schema`.
- Have all collections in a single directory: `src/content/[collectionname]`

Content collections can contain non-markdown/MDX files, but they will not be shown in the editor.

Some features require you to have certain properties in your schema. A date field is required for proper ordering in the file list. A boolean field is required to show and filter drafts. A text field is required to show titles in the sidebar. Etc.

By default, Astro Editor expects the following structure in your Astro project:

```
my-astro-site
└── src
    ├── assets
    │   └── mycollection
    │       └── image1.png
    ├── content
    │   └── mycollection
    │       └── blog-post.mdx
    ├── components
    │   └── mdx
    │       └── ExampleAstroComponent.astro
    └── content.config.ts
```

The paths to the _Assets_, _Content_, and _MDX Components_ directories (relative to the project root) are configurable per project and per collection (see [Configuration](#preferences--configuration)).

### Directory Restrictions

For security reasons, Astro Editor cannot open projects located in certain system directories. If you attempt to open a project in one of these locations, you'll see an error message asking you to choose a different location.

### Quick Start

Getting started with Astro Editor takes just a few steps. The application is designed to work with existing Astro projects that use content collections.

1. **Open an Astro Project**: Use `File > Open Project` to select your Astro project directory. Astro Editor will automatically scan for content collections defined in your `src/content/config.ts` file.

2. **Select a Collection**: Once your project opens, you'll see your content collections listed in the left sidebar. Click on any collection name to view the files it contains.

3. **Open a File**: Click on any markdown or MDX file in the file list to open it in the main editor. The editor will show your content without the frontmatter, which appears in the right sidebar.

4. **Start Writing**: Begin editing. Your changes are automatically saved every 2 seconds, and you can manually save anytime with `Cmd+S`.

5. **Edit Frontmatter**: Use the right sidebar to edit metadata fields. These forms are automatically generated from your Astro content collection schemas.

That's it. Astro Editor handles project discovery, file management, and frontmatter editing automatically based on your existing Astro setup.

### Interface Overview

![overview of app](assets/Overview.png)

![overview of app in with file open ](<assets/Overview 2.png>)

Astro Editor uses a clean three-panel layout designed to minimize distractions while providing easy access to files and metadata:

| Interface Area    | Purpose                                                                      |
| ----------------- | ---------------------------------------------------------------------------- |
| **Left Sidebar**  | Browse collections and files, with draft indicators and context menu options |
| **Main Editor**   | Clean writing space with markdown syntax highlighting                        |
| **Right Sidebar** | Dynamic frontmatter forms generated from your Astro collection schemas       |
| **Top Bar**       | Project name, window controls, and menu access                               |

Both sidebars can be hidden using `Cmd+1` (left) and `Cmd+2` (right) for distraction-free writing. The panels remember their sizes and visibility between sessions.

## The Editor

The editor window shows the entire contents of your markdown or MDX files with the exception of the YAML frontmatter and any JSX `import` lines immediately following the frontmatter. It's designed to provide an extremely clean writing interface, especially when both sidebars are closed. It provides markdown syntax highlighting.

### Auto-Save

Astro Editor automatically saves your work with two complementary mechanisms:

1. **Pause-based save**: Automatically saves your changes after you stop typing (configurable in preferences, default is 2 seconds)
2. **Flow-state backup**: An additional save occurs every 10 seconds while you're actively typing, ensuring content is written to disk during extended writing sessions

You can manually save at any time using `Cmd+S`.

### Image Preview on Hover

When you're editing in the main editor, you can quickly preview images by holding the Option/Alt key and hovering over any image path or URL. A preview will appear in the bottom right corner of the editor.

**How it works:**

- **Remote images**: Any http:// or https:// URL shows a preview
- **Absolute paths**: Paths like `/src/assets/article/image.png` (relative to your project root)
- **Relative paths**: Paths like `./image.png` or `../images/photo.jpg` (resolved relative to the current file)

**Note**: Preview for relative paths works in most cases but may be unreliable in unusual folder structures. For the most reliable results, use absolute paths from your project root.

### Editor Keyboard Shortcuts

Astro Editor includes the following keyboard shortcuts.

| Shortcut     | Action            | Description                                |
| ------------ | ----------------- | ------------------------------------------ |
| `Cmd+B`      | Bold              | Toggle bold formatting for selected text   |
| `Cmd+I`      | Italic            | Toggle italic formatting for selected text |
| `Cmd+K`      | Link              | Create or edit a link for selected text    |
| `Cmd+]`      | Indent Right      | Indent current line right                  |
| `Cmd+[`      | Indent Left       | Indent current line left                   |
| `Cmd+Z`      | Undo              | Undo the last edit action                  |
| `Cmd+Y`      | Redo              | Redo the last undo action                  |
| `Ctrl+Cmd+F` | Toggle Focus Mode | Enable/disable focus writing mode          |
| `Opt+Click`  | Open URL          | Open URL under mouse cursor in browser     |
| `Opt+Hover`  | Image Preview     | Preview image at path/URL under cursor     |
| `Opt+Cmd+1`  | Heading 1         | Convert current line to H1                 |
| `Opt+Cmd+2`  | Heading 2         | Convert current line to H2                 |
| `Opt+Cmd+3`  | Heading 3         | Convert current line to H3                 |
| `Opt+Cmd+4`  | Heading 4         | Convert current line to H4                 |
| `Opt+Cmd+0`  | Plain Text        | Convert current line to plain paragraph    |

## The Frontmatter Sidebar

The frontmatter sidebar automatically generates editing forms based on your Astro content collection schemas. This means you get proper validation, appropriate input types, and a clean editing experience without any manual configuration.

### How Schema Parsing Works

Astro Editor uses a flexible multi-source approach to read your content collection schemas, ensuring maximum compatibility with different Astro project setups.

**Primary Method: JSON Schema Files** (Recommended)

Astro Editor first looks for JSON schema files in your project. These can be in two locations:

1. **Astro-generated schemas**: Files in `.astro/collections/` directory (like `blog.schema.json`)
2. **Custom schema files**: `content.config.json` or `content/config.json` in your project root

To ensure Astro-generated files are available:

1. Run `pnpm run dev` or `astro sync` in your project directory
2. Astro will automatically generate schema files in `.astro/collections/`
3. Astro Editor reads these schemas and builds the frontmatter forms

**Support for Schema Imports**

Astro Editor supports `content.config.json` files that import schemas from other sources. This is particularly useful for sites using frameworks like [Starlight](https://starlight.astro.build/), which provide their own schema definitions. If your project imports schemas rather than defining them inline, Astro Editor can still read and use them.

**Fallback Method: Zod Schema Parsing**

If JSON schema files aren't found, Astro Editor falls back to parsing your Zod schema definitions directly from `src/content/config.ts` or `src/content.config.ts`. This works for most cases but has limitations with complex schemas, dynamically built schemas, or third-party schema definitions.

**Best Practice**: Always run `astro sync` after modifying your content collection schemas to ensure Astro Editor has the latest field definitions.

### How Schema Fields Become Forms

Astro Editor converts schema definitions into appropriate form controls. The mapping works as follows:

| Zod Schema Type           | Form Control      | Behavior                                   |
| ------------------------- | ----------------- | ------------------------------------------ |
| `z.string()`              | Single-line input | Standard text input                        |
| `z.string().optional()`   | Single-line input | Empty field allowed, no validation         |
| `z.enum(['a', 'b', 'c'])` | Dropdown select   | Shows all enum options                     |
| `z.boolean()`             | Toggle switch     | True/false with visual switch              |
| `z.date()`                | Date picker       | Native date selection widget               |
| `z.number()`              | Number input      | Numeric validation and steppers            |
| `z.array(z.string())`     | Tag input         | Add/remove tags with keyboard              |
| `z.reference('authors')`  | Dropdown select   | Select from another collection (see below) |
| `image()`                 | Image picker      | File picker with preview (see below)       |
| `z.object({ ... })`       | Grouped fields    | Nested fields in a fieldset (see below)    |

### Field Descriptions and Constraints

When you add descriptions or constraints to your schema fields, they appear in the frontmatter sidebar to guide your editing:

**Field Descriptions**: Any field using `.describe()` in your schema will display that description below the input field in gray text. This is helpful for explaining what the field is for or providing usage examples.

```typescript
title: z.string().describe('The main heading for your article')
```

**Field Constraints**: Character limits, min/max values, and other constraints from your schema are enforced in the form. For example:

- `z.string().min(10).max(100)` - Shows character counter and prevents saving if out of range
- `z.number().min(1).max(10)` - Number input with validation
- `z.string().length(50)` - Enforces exact length

### Special Field Handling

**Title Fields**: If your schema has a field named `title` (or configured in project settings), it renders as a larger, bold textarea that automatically expands as you type. Title fields always appear first in the panel, regardless of their position in the schema.

**Description Fields**: Fields named `description` get a multi-line textarea that grows based on content length.

**Required Fields**: Required schema fields show an asterisk (\*) next to their label and prevent saving if empty.

### Reference Fields

Reference fields let you link content collection entries together. For example, you might have an `authors` collection and want to reference an author from your blog posts.

**In your schema:**

```typescript
const blog = defineCollection({
  schema: z.object({
    author: z.reference('authors'), // Single reference
    contributors: z.array(z.reference('authors')), // Multiple references
  }),
})
```

**In the frontmatter sidebar:**

- Single references (`z.reference()`) show as a dropdown where you can select one item from the referenced collection
- Array references (`z.array(z.reference())`) show as a multi-select or tag input where you can select multiple items

**What gets displayed:** The dropdown shows the `name` field from each referenced item, or falls back to the `id` if no name field exists. This works for both markdown-based collections and data file collections (like `authors.json`).

### Image Fields

Image fields use Astro's special `image()` helper to handle images in your content collections. The frontmatter sidebar provides a complete image management experience.

**In your schema:**

```typescript
import { defineCollection, z } from 'astro:content'

const blog = defineCollection({
  schema: z.object({
    cover: image().optional(),
    thumbnail: image(),
  }),
})
```

**In the frontmatter sidebar:**

When you have an image field, you'll see:

- **Current image preview**: A small thumbnail of the current image (if one is set)
- **Current path**: The path to the image file, displayed as text
- **File picker button**: Click to browse and select an image, or drag and drop an image directly onto the button
- **Edit button**: Click to switch to a text input field where you can manually type or paste a path directly
- **Clear button**: Remove the current image

**How image copying works:**

When you select or drag an image into an image field, Astro Editor:

1. Copies the image to your collection's configured assets directory
2. Renames it following the same pattern as the current file (YYYY-MM-DD-name.ext)
3. Updates the frontmatter with a **relative path** to the copied image (default behavior)
4. Shows a preview immediately

**Path configuration:**

- **Default behavior**: Images use relative paths (e.g., `./image.png`), making your content more portable
- **Override option**: Configure absolute paths (relative to project root) on a per-project or per-collection basis in preferences
- This applies to both image fields in frontmatter and images dragged into the editor

**Special cases:**

- If the image is already inside your Astro project's directory structure, it's not copied - Astro Editor uses the path as-is
- Manual path editing (via the edit button) allows you to reference images that are already in place
- Image paths are validated - you'll see an error if the path doesn't exist or is outside your project

**Known limitation**: Image fields nested inside object fields (like `metadata.image: image()`) currently show as text fields. This is a known issue that will be fixed in a future release.

### Nested Object Fields

When your schema includes nested objects, the frontmatter sidebar groups the related fields together for better organization.

**In your schema:**

```typescript
const blog = defineCollection({
  schema: z.object({
    metadata: z.object({
      category: z.string(),
      priority: z.number().optional(),
      deadline: z.date().optional(),
    }),
  }),
})
```

**In the frontmatter sidebar:**

Nested object fields are displayed in a fieldset with:

- A header showing the object name (e.g., "Metadata")
- Indentation and a left border for visual grouping
- All nested fields rendered with their appropriate controls

This makes it easy to see which fields belong together and maintains the logical structure of your content.

### Field Order and Defaults

Fields appear in the sidebar in the same order they're defined in your Zod schema. When you create a new file, any default values specified in your schema are automatically applied in the panel.

The frontmatter is written to your file in the same order it's shown in the schema, with any non-schema fields shown in alphabetical order by field name.

![view with frontmatter highlighted](assets/Frontmatter.png)

## The File List Sidebar

The left sidebar provides your primary interface for navigating between files and collections in your Astro project.

### Collections and File Organization

**Collection Selection**: Click on any collection name to view its files. The currently selected collection is highlighted, and its files appear below.

**Subfolder Support**: Collections can be organized into subdirectories, and Astro Editor fully supports this structure. When you open a collection, you'll see:

- **Subdirectories** listed at the top (sorted alphabetically)
- **Files** listed below subdirectories (sorted by date)

To navigate into a subdirectory, simply click on it. The sidebar header shows breadcrumb navigation so you always know where you are.

**Breadcrumb Navigation**: When you're inside a subdirectory, the header shows a breadcrumb trail. Click any segment to jump to that level:

```
Articles / 2024 / January
```

- Click "Articles" to return to the collection root
- Click "2024" to go up one level
- "January" shows your current location (not clickable)

**Back Navigation**: The back button is context-aware:

- In a subdirectory: Goes up one level
- At collection root: Returns to collections list
- Use it to quickly navigate up the hierarchy

**File Ordering**: Files are automatically sorted by their publication date (newest first), using the date field configured in your project settings (defaults to `pubDate`, `date`, or `publishedDate`). Files without dates appear at the top of the list.

**File Display**: Each file shows:

- **Title**: Taken from the `title` frontmatter field, or the filename if no title exists
- **Date**: Publication date in a readable format (e.g., "Dec 15, 2023")
- **Draft Badge**: Yellow "Draft" indicator for files marked as drafts

### Draft Management

**Draft Detection**: Files are automatically detected as drafts when their `draft` frontmatter field (or configured equivalent) is set to `true`.

**Draft Filtering**: Use the "Show Drafts Only" toggle in the toolbar to filter the file list to show only draft files. This filter works across all subdirectories within the current collection, making it easy to review all unpublished content.

### File Operations

**Opening Files**: Click any file to open it in the main editor. The currently open file is highlighted with a border.

**Context Menu**: Right-click any file to access additional operations:

- **Rename**: Edit the filename inline without changing file content
- **Duplicate**: Create a copy of the file with a new name
- **Reveal in Finder**: Open the file's location in the Finder
- **Copy Path**: Copies the file's absolute path to the clipboard

**Creating New Files**: Use `Cmd+N` or the "New File" button to create a new file. The file is created in the currently active location:

- If you're in a subdirectory, the file is created there
- If you're at the collection root, the file is created at the root
- The file will have default frontmatter values from your collection schema

![sidebar with context menu open](assets/sidebar.png)

## The Command Palette

![alt text](assets/command-palette.png)

The command palette provides quick access to all major functions in Astro Editor. It's designed for keyboard-driven workflows and fast file switching.

**Opening the Palette**: Press `Cmd+P` from anywhere in the application to open the command palette. Start typing immediately to search.

**Fuzzy Search**: The palette uses intelligent fuzzy matching, so you can type partial words or abbreviations. For example, typing "foc" will find "Toggle Focus Mode".

### Command Categories

Commands are organized into logical groups that appear at the top of the search results:

**File Operations**

- **New File**: Create a new file in the current collection
- **Save File**: Save the currently open file
- **Close File**: Close the current file

**Navigation**

- **Open Collection**: Jump to a different content collection
- **Toggle Sidebar**: Show/hide the left file browser
- **Toggle Frontmatter Panel**: Show/hide the right frontmatter editor

**Project Management**

- **Open Project**: Select and open a different Astro project
- **Reload Collections**: Refresh the project's content collections
- **Open in IDE**: Open the current project, collection, or file in your configured IDE.

### File Search

The command palette doubles as a powerful file search tool. When you type text that doesn't match a command, it automatically searches across all files in your project:

**Cross-Collection Search**: Finds files in any collection, not just the currently selected one.

**Title and Filename Matching**: Searches both the frontmatter title and the actual filename.

**Quick Switching**: Select any file from the search results to open it immediately, even if it's in a different collection.

### Opening in Your IDE

The "Open in IDE" command launches your preferred code editor with either the current file or the entire project. Configure your IDE command in preferences (`Cmd+,`). Popular options include:

- `code` for Visual Studio Code
- `cursor` for Cursor
- `subl` for Sublime Text

## Editing Modes

A number of "modes" can be toggled while writing/editing, which alter how the editor displays your content. These are generally compatible with each other (they can be toggled on and off independently).

### Focus Mode

Dims everything but the current sentence (or line for lists). Can be toggled with the 👁️ icon in the toolbar.

### Typewriter Mode

> [!WARNING]
> This is currently unreliable and could cause the editor window to behave in unexpected ways.

Keeps the editor cursor centered vertically in the window and scrolls the document – much like a typewriter.

### Copyedit Highlighting

![with highlights enabled](assets/Editor-mode.png)

Copyedit mode highlights different parts of speech in your writing with distinct colors, helping you analyze writing patterns and identify areas for improvement.

**Parts of Text Highlighted**:

- **Nouns**: Purple highlighting to identify subjects and objects
- **Verbs**: Blue highlighting to spot action words and tense patterns
- **Adjectives**: Green highlighting to review descriptive language
- **Adverbs**: Orange highlighting to catch potentially unnecessary modifiers
- **Conjunctions**: Red highlighting to see sentence connection patterns

**Individual Controls**: You can toggle highlighting for specific parts of speech using the command palette.

**Smart Exclusions**: Highlighting automatically excludes code blocks and markdown syntax, so only your actual prose is analyzed.

**Writing Use Cases**:

- Spot overuse of adverbs in your writing
- Check for consistent verb tenses
- Review the density of adjectives in descriptions
- Identify complex sentence structures with many conjunctions

_[Screenshot needed: Editor with copyedit mode enabled showing different colored highlights]_

## MDX Components

When editing an MDX file, `Cmd+/` will open the component builder. This shows all the components inside your configured `/components/mdx` directory.

**Framework Support**: The component builder works with components written in multiple frameworks:

- **Astro** (`.astro` files)
- **React** (`.tsx`, `.jsx` files)
- **Vue** (`.vue` files)
- **Svelte** (`.svelte` files)

Each component in the list shows a small badge indicating which framework it's written in, along with an icon for quick visual identification.

**Using the component builder:**

1. Press `Cmd+/` in any MDX file
2. Browse or search for a component
3. Select a component to see its configuration options
4. Toggle the props you want to include
5. Press `Cmd+Enter` to insert the component into your document

After insertion, you can tab through the various prop values to fill them in. The component builder automatically detects which props are available by reading the component's source code.

**Subdirectory Support**: Components can be organized in subdirectories within your MDX components folder. Astro Editor scans recursively and shows all available components regardless of how deeply nested they are.

_[Gif needed: Using the component builder]_

## Preferences & Configuration

Astro Editor provides global preferences, project-specific settings, and collection-scoped overrides to accommodate different workflows and project structures.

### General Preferences

![alt text](assets/Preferences.png)

Access global preferences through `Cmd+,` or the application menu. These settings apply across all projects:

**Theme**: Choose between light mode, dark mode, or system theme (follows macOS setting).

**Heading Colors**: Customize the color of markdown headings in the editor. Separate color pickers for dark theme and light theme allow you to personalize your writing environment while maintaining good contrast in both modes.

**IDE Command**: Configure the command used for "Open in IDE" functionality. Common values:

- `code` for Visual Studio Code
- `cursor` for Cursor
- `subl` for Sublime Text

**Auto-save Delay**: Configure how frequently Astro Editor automatically saves your work (default is 2 seconds).

**Default File Type for New Files**: Choose whether newly created files use Markdown (`.md`) or MDX (`.mdx`) format. Applies across all projects unless overridden at the project or collection level.

**Copyedit Highlighting**: Choose which parts of speech to highlight in copyedit mode.

**Important**: Global settings contain ONLY truly global preferences (theme, IDE command, copyedit highlights, auto-save delay, default file type). There are no global defaults for project or collection settings.

### Project Settings

Each project has its own settings that apply to the entire project. Access project settings through the preferences panel (only visible when a project is open).

**Path Overrides**: Customize directory locations if your project uses non-standard paths:

- **Content Directory**: Default is `src/content/`, but you might use `content/` or `docs/`
- **Assets Directory**: Default is `src/assets/`, useful for projects using `public/images/` or `static/`
- **MDX Components Directory**: Default is `src/components/mdx/`, can be changed if your components are elsewhere

Project-level path overrides apply to all collections unless a collection has its own override.

**File Defaults**:

- **Default File Type for New Files**: Override the global default for newly created files in this project. Choose between Markdown (`.md`) or MDX (`.mdx`), or inherit the global setting.

**Field Mappings**: Configure which fields Astro Editor should use for common purposes:

- **Title Field**: Which field to display as the title in the file list (default: `title`)
- **Date Field**: Which field(s) to use for sorting files by date (e.g., `pubDate`, `date`, or `publishedDate`)
- **Description Field**: Which field should render as a multi-line textarea (default: `description`)
- **Draft Field**: Which boolean field indicates draft status (default: `draft`)

### Collection Settings

You can configure settings for individual collections, allowing different collections to have different paths and field mappings. This is useful when different parts of your site have different structures.

**When to Use Collection Settings**:

- Blog posts in `content/blog/` while docs remain in `src/content/docs/`
- Different collections using different field names (e.g., blog uses `publishDate`, docs use `date`)
- Collection-specific asset directories (e.g., blog images in `public/blog-images/`)

**Available Collection Settings**:

**Path Overrides** (per collection):

- **Content Directory**: Where this collection's files are located (absolute path from project root)
  - Example: `content/blog/` means files are in `<project_root>/content/blog/`, not `<project_root>/src/content/blog/`
- **Assets Directory**: Where this collection's assets should be copied (absolute path from project root)
  - Example: `public/blog-images/` for blog, `public/docs-images/` for docs
- **MDX Components Directory**: Where this collection's MDX components are located
  - Example: `src/components/blog/` for blog-specific components

**File Defaults** (per collection):

- **Default File Type for New Files**: Override the project/global default for newly created files in this collection. Useful when one collection uses MDX while others use Markdown.
  - Example: Blog collection uses `.mdx` for interactive components, docs collection uses `.md` for simple content

**Image Path Strategy** (per collection):

- **Use Relative Paths for Images**: By default, images dragged into the editor or added to image fields use relative paths (e.g., `./image.png`), making content more portable. Disable this option to use absolute paths (relative to project root, e.g., `/src/assets/image.png`) instead.
  - Can be configured at project level (applies to all collections) or per collection (overrides project setting)
  - Useful when different collections have different portability requirements

**Frontmatter Field Mappings** (per collection):

- **Title Field**: Which field to use for file titles in sidebar (e.g., `title` or `heading`)
- **Date Field**: Which field(s) to use for sorting files (e.g., `publishDate` or `["pubDate", "date"]`)
- **Description Field**: Which field to style as a textarea (e.g., `description` or `summary`)
- **Draft Field**: Which boolean field indicates draft status (e.g., `draft` or `published`)

**How Settings Work (Three-Tier Fallback)**:

When Astro Editor needs a setting (like content directory), it looks in this order:

1. **Collection setting** (if configured for this collection)
2. **Project setting** (if configured at project level)
3. **Hard-coded default** (built into the app)

**Example**: If you set project content directory to `content/`, all collections use `content/`. But if you configure the "blog" collection to use `content/blog-posts/`, only the blog collection uses that path while other collections still use `content/`.

### Settings Storage

Settings are automatically saved to your system:

- **Location**: `~/Library/Application Support/is.danny.astroeditor/`
- **Global Settings**: Theme, IDE command, and other app-wide preferences
- **Project Registry**: Remembers all opened projects and their metadata
- **Project Files**: Individual settings files for each project (includes collection overrides)
- **Auto-Recovery**: Settings persist across app restarts and crashes

Projects are identified by their `package.json` name and automatically migrate if you move the project folder.

## Troubleshooting & Support

If you're experiencing issues with Astro Editor, you can collect detailed logs to help with troubleshooting.

### Getting Diagnostic Logs

Astro Editor automatically logs detailed information to help diagnose setup problems, crashes, or other issues.

**To collect logs for support:**

**Method 1: Debug Panel (Recommended)**

1. Open Preferences (`Cmd+,`)
2. Navigate to the Debug tab
3. Click "Copy Debug Info" to copy system and project information to your clipboard
4. Send this information along with a description of your issue

**Method 2: Complete Log File**

1. **Open Finder** and navigate to: `~/Library/Logs/is.danny.astroeditor/`
2. **Copy the file** `Astro Editor.log`
3. **Send this file** along with a description of your issue

**Method 3: Console.app for Live Monitoring**

1. **Open Console.app** (Applications > Utilities > Console)
2. **Search for "Astro Editor"** in the search bar
3. **Reproduce the issue** you're experiencing (try opening the project again, etc.)
4. **Filter the results** by typing "Astro Editor" to see only relevant log entries
5. **Select and copy** the relevant log entries
6. **Send the logs** along with a description of your issue

**Note:** The debug info and log files contain no personal content - only technical information about file paths, app operations, and error details needed for debugging.

**Useful search terms in Console.app:**

- `Astro Editor [PROJECT_SETUP]` - Project opening and setup issues
- `Astro Editor [PROJECT_SCAN]` - Collection and file discovery problems
- `Astro Editor [PROJECT_REGISTRY]` - Project registration and management
- `Astro Editor [PROJECT_DISCOVERY]` - Project metadata detection

## Global Keyboard Shortcuts

These work anywhere in the application

| Shortcut | Action                   | Description                                             |
| -------- | ------------------------ | ------------------------------------------------------- |
| `Cmd+S`  | Save File                | Save the currently open file                            |
| `Cmd+N`  | New File                 | Create a new file in the selected collection            |
| `Cmd+W`  | Close File               | Close the currently open file                           |
| `Cmd+P`  | Command Palette          | Open the command palette to search and execute commands |
| `Cmd+,`  | Preferences              | Open application preferences                            |
| `Cmd+0`  | Focus Editor             | Focus the main editor from anywhere in the app          |
| `Cmd+1`  | Toggle Sidebar           | Show/hide the left sidebar (file browser)               |
| `Cmd+2`  | Toggle Frontmatter Panel | Show/hide the right sidebar (frontmatter editor)        |

### Component Builder Keyboard Shortcuts

When the Component Builder dialog is open:

| Shortcut    | Action           | Description                                                |
| ----------- | ---------------- | ---------------------------------------------------------- |
| `Backspace` | Go Back          | Return to component selection (when in configuration step) |
| `Cmd+A`     | Toggle All Props | Select/deselect all optional component properties          |
| `Cmd+Enter` | Insert Component | Insert the configured component into the editor            |
