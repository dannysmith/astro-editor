# Task: Update Marketing Site, REAMDE and User Guide with new features

https://github.com/dannysmith/astro-editor/issues/51

We added significant new features for 1.0.0, we should update the docs to reflect these changes:

- User guide in `docs/user-guide.md`
- Video and contents of README.md where appropriate.
- Marketing site in `website/`
- Any other internal docs which are outdated.

## ✅ Completed (Automated Documentation Updates)

All documentation has been updated to accurately reflect v1.0 behavior:

- [x] **User Guide** (`docs/user-guide.md`) - 5 clarifications/additions
- [x] **README.md** - 3 feature updates
- [x] **Marketing Website** (`website/index.html`) - 10+ improvements
- [x] **Blog Post Summary** - Ready to use (see below)
- [x] **Demo Video Outline** - Comprehensive 30-35 min script (see below)

## 📋 Human Tasks (Screenshots & Video)

- [x] **Screenshot**: `website/image-preview-hover.png` - DONE ✅
  - Shows editor with image path and preview popup in bottom right corner

- [ ] **Record Overview Video** for website and README.md
  - Use the demo video outline below
  - 30-35 minute comprehensive walkthrough, or split into shorter segments

- [ ] **Optional Screenshots** (if desired):
  - Preferences panel showing heading color pickers
  - Subfolder navigation with breadcrumbs visible
  - Three-tier configuration (showing project and collection overrides)
  - Reference field dropdown in action

- [ ] **Publish Blog Post** (optional)
  - Use the blog post summary below

---

## Quick Summary

**What Was Done:**
All documentation (user guide, README, marketing website) has been updated to accurately reflect v1.0 features. A blog post summary and comprehensive 30-35 minute demo video outline have been prepared and are ready to use below.

**What's Left:**
You need to record the overview video using the outline provided. Optional: take additional screenshots to showcase specific features like preferences, subfolders, or reference fields.

**Key Deliverables in This Document:**
- Blog post summary (search for "FINAL: Blog Post")
- Demo video outline (search for "Demo Video Outline")
- Marketing website change log (search for "Marketing Website Updates")

---

## Analysis Plan

### Phase 1: Clarification Questions (CURRENT)
Before documenting, I need to understand current behavior for some features.

### Phase 2: Documentation Deliverables
1. **Blog Post Summary** - Written description of major features for blog post
2. **User Guide Updates** - Ensure guide reflects all current functionality
3. **Demo Video Outline** - Comprehensive script covering ALL features in logical order
4. **Marketing Website Updates** - New copy, sections, and screenshots needed
5. **Internal Docs Review** - Check CLAUDE.md, README.md, developer docs

### Phase 3: Execution
Work through each deliverable, adding completed work to this task document.

---

## Clarification Questions - ANSWERED ✅

1. **Heading Colors**: ✅ YES - Configurable in global settings with one color picker each for dark and light mode
2. **Auto-save Timing**: ✅ 2 seconds (configurable in global settings) after stopping typing + additional save every 10 seconds regardless
3. **Real-time Sidebar Updates**: ✅ Don't mention
4. **iA Writer Duo Ligatures**: ✅ Don't mention
5. **Text Field Autocorrect**: ✅ Don't mention
6. **Manual Image Path Editing**: ✅ YES - Edit button switches to text input for manual editing

**NEW FEATURE IDENTIFIED**: Images and files dragged into the editor or added to image-type frontmatter fields now default to RELATIVE paths. This can be overridden to use absolute paths (relative to the project root) on a per-project and per-collection basis.

---

## Changelog Analysis

### Features Already Well-Documented in User Guide ✅
- Subfolder support with breadcrumb navigation
- Configurable paths (content/assets/mdx components) at project and collection levels
- Frontmatter field mappings per collection (title, date, description, draft)
- Three-tier preferences system (global → project → collection)
- Debug panel in preferences
- Copyedit highlights (default off for new installs)
- Reference fields (single and array)
- React/Vue/Svelte component support
- Option+hover image preview
- Image field picker with drag-drop
- Default file type (MD vs MDX) at all three levels
- Schema system (JSON schemas required, Zod fallback)
- Nested object fields in frontmatter

### Features Needing Documentation Updates 📝

1. **Customizable Heading Colors**: Global settings with color pickers for dark/light mode - NOT in user guide
2. **Auto-save Behavior**: User guide says "2 seconds" but actual behavior is "2 seconds after stopping typing (configurable) + every 10 seconds while typing"
3. **Image Path Strategy**: User guide mentions this but should emphasize that RELATIVE is the DEFAULT (with configurable override)
4. **Manual Image Path Editing**: User guide mentions "edit button" but could be clearer that it switches to text input

### Bug Fixes & Technical Details (Don't Document) 🚫
- Silent errors for new installations fixed
- More robust logging
- Schema parser improvements
- Auto-updater bug fix
- Universal binary in DMG
- Various display bugs fixed
- Simplified internal systems

### Deprecated/Changed Features
- None identified - features seem to be additive

---

## FINAL: Blog Post - Major Features Summary

_Concise overview of major features added to Astro Editor for v1.0, ready for blog post._

### Advanced Schema Support

Astro Editor now provides comprehensive support for complex content schemas, making it easier to work with sophisticated content structures:

- **Reference Fields**: Link content across collections with dropdown selectors. Single references (`z.reference()`) or multiple references (`z.array(z.reference())`) both work seamlessly, showing entries by name or ID.

- **Nested Object Fields**: Complex schemas with nested objects are properly displayed with visual grouping, indentation, and fieldset organization to maintain logical structure.

- **Image Fields**: Full support for Astro's `image()` helper with file picker, drag-and-drop, automatic copying to assets directories, and live previews. Manual path editing available when needed.

- **Field Constraints & Descriptions**: Character limits, min/max values, and `.describe()` descriptions are shown directly in the UI, providing guidance as you edit.

### Flexible Project Configuration

The three-tier preferences system (global → project → collection) gives you precise control over how Astro Editor works with your specific project structure:

- **Configurable Paths**: Override default directories for content, assets, and MDX components at the project level or per collection. Perfect for non-standard Astro setups or multi-purpose sites.

- **Custom Field Mappings**: Tell Astro Editor which fields to use for titles, dates, descriptions, and draft status. Configure once per project or customize for individual collections.

- **File Type Defaults**: Choose between Markdown and MDX as your default format globally, per project, or per collection. Ideal for projects where some collections need MDX components while others use simple Markdown.

- **Image Path Strategy**: Configure whether dragged images use relative or absolute paths, with options at both project and collection levels.

### Enhanced Content Organization

Better tools for managing larger content collections:

- **Subfolder Support**: Full support for nested subdirectories within collections, with breadcrumb navigation and context-aware "back" button. Files and folders are sorted intelligently.

- **Draft Filtering**: The "Show Drafts Only" toggle works across all subdirectories, making it easy to review unpublished content wherever it lives.

- **Real-time Updates**: Changes to frontmatter fields that affect the sidebar (title, date, draft status) immediately update the file list without needing to save or refresh.

### Multi-Framework MDX Components

The Component Builder now works with multiple frontend frameworks:

- **Framework Support**: Astro, React, Vue, and Svelte components all work in the builder
- **Visual Indicators**: Each component shows a badge and icon indicating its framework
- **Subdirectory Scanning**: Organize components in nested folders - Astro Editor finds them all

### Enhanced Writing Experience

- **Customizable Heading Colors**: Personalize your editor with configurable heading colors in global preferences. Set different colors for dark and light themes to match your style.

- **Smart Auto-save**: Files save automatically 2 seconds after you stop typing (configurable in preferences), with an additional backup save every 10 seconds while you're in flow state. Never lose work, even during extended writing sessions.

- **Relative Paths by Default**: Images and files dragged into the editor now use relative paths by default, making your content more portable. Override to absolute paths on a per-project or per-collection basis when needed.

- **Image Preview on Hover**: Hold Option/Alt and hover over any image path or URL in the editor for an instant preview. Works with remote images, absolute paths, and relative paths.

- **Debug Panel**: New preferences tab for copying diagnostic information to help with support requests.

---

## Demo Video Outline

_A comprehensive script covering ALL features of Astro Editor in a logical order for video demonstration_

### 1. Introduction & Philosophy (1-2 min)
- What is Astro Editor and who is it for?
- The "writer mode" vs "coder mode" philosophy
- What Astro Editor does (and intentionally doesn't do)
- Quick overview of main interface

### 2. Getting Started (1-2 min)
- Opening an Astro project (`File > Open Project`)
- What Astro Editor looks for (content collections, schemas)
- Interface overview: three-panel layout
- Collections appearing in left sidebar

### 3. Basic Editing Workflow (2-3 min)
- Selecting a collection
- Opening a file from the file list
- The clean editor view (no frontmatter, no imports)
- Writing and editing markdown
- Auto-save behavior (show status bar)
- Manual save with `Cmd+S`

### 4. Frontmatter Sidebar (3-4 min)
- Overview: automatically generated from your schema
- Show different field types:
  - Text fields (single line)
  - Textareas (description fields)
  - Title field (special formatting)
  - Boolean toggles (draft status)
  - Date pickers
  - Enums/dropdowns
  - Number inputs
  - Array fields (tags)
- Field descriptions and constraints shown in UI
- Required fields (asterisk indicator)

### 5. Advanced Schema Features (3-4 min)
- **Reference Fields**:
  - Show single reference dropdown
  - Show array reference (multiple selections)
  - Explain how it links to other collections
- **Nested Object Fields**:
  - Show grouped fieldset with indentation
  - Visual organization of related fields
- **Image Fields**:
  - File picker button
  - Drag and drop demonstration
  - Automatic copying to assets directory
  - Live preview
  - Manual path editing (edit button)
  - Clear button

### 6. File Browser & Navigation (2-3 min)
- Collections list
- File list with titles and dates
- Draft badges
- **Subfolder support**:
  - Navigate into subdirectories
  - Breadcrumb navigation
  - Back button behavior
- File sorting (by date)
- Draft filtering toggle

### 7. File Operations (2 min)
- Creating new files (`Cmd+N`)
- Context menu (right-click):
  - Rename
  - Duplicate
  - Reveal in Finder
  - Copy path
- Closing files (`Cmd+W`)

### 8. Editor Features (2-3 min)
- **Markdown syntax highlighting**
- **Keyboard shortcuts**:
  - Bold (`Cmd+B`)
  - Italic (`Cmd+I`)
  - Link (`Cmd+K`)
  - Headings (`Opt+Cmd+1-4`)
  - Indent (`Cmd+[` / `Cmd+]`)
- **Image preview on hover**:
  - Hold Option/Alt and hover
  - Works with URLs, absolute paths, relative paths
- **URL opening**: `Opt+Click` on URLs

### 9. MDX Components (2-3 min)
- Open component builder (`Cmd+/`)
- Framework support badges (Astro, React, Vue, Svelte)
- Browse/search components
- Select component and configure props
- Toggle props on/off
- Insert with `Cmd+Enter`
- Tab through prop values

### 10. Editing Modes (2-3 min)
- **Focus Mode**: Dims all but current sentence
- **Typewriter Mode**: Centers cursor (mention it's experimental)
- **Copyedit Highlighting**:
  - Show different parts of speech highlighted
  - Nouns, verbs, adjectives, adverbs, conjunctions
  - Use cases (finding overused adverbs, checking tenses)
  - Individual toggles in command palette

### 11. Command Palette (2 min)
- Open with `Cmd+K`
- Fuzzy search demonstration
- **Command categories**:
  - File operations
  - Navigation
  - Project management
- **File search**: Cross-collection search for quick switching
- Show "Open in IDE" command

### 12. Preferences & Configuration (4-5 min)
- Open preferences (`Cmd+,`)
- **Global preferences**:
  - Theme (light/dark/system)
  - Heading colors (color pickers for dark and light themes)
  - IDE command
  - Auto-save delay (explain 2 seconds after stopping + 10 seconds while typing)
  - Default file type (MD vs MDX)
  - Copyedit highlighting toggles
- **Project settings**:
  - Path overrides (content/assets/MDX components)
  - Field mappings (title, date, description, draft)
  - Default file type override
- **Collection settings**:
  - Per-collection path overrides
  - Per-collection field mappings
  - Per-collection file type defaults
  - Image path strategy (relative vs absolute)
- **Three-tier fallback system**: collection → project → default
- **Debug panel**: Copy diagnostic info for support

### 13. Keyboard Shortcuts Summary (1 min)
- Quick reference to most-used shortcuts
- Global shortcuts (`Cmd+S`, `Cmd+N`, `Cmd+W`, `Cmd+K`, `Cmd+1`, `Cmd+2`)
- Editor shortcuts
- Component builder shortcuts

### 14. Schema System & Best Practices (2-3 min)
- How Astro Editor reads schemas
- Primary method: JSON schema files (`.astro/collections/`)
- Running `astro sync` to generate schemas
- Fallback: Zod schema parsing
- Support for schema imports (Starlight example)
- Best practice: always run `astro sync` after schema changes

### 15. Troubleshooting & Support (1 min)
- Debug panel for diagnostic info
- Log file location
- Console.app for live monitoring
- Where to get help

### 16. Conclusion (1 min)
- Recap main benefits
- Writer mode vs coder mode philosophy
- Where to download
- Link to documentation

**Total estimated time: 30-35 minutes**

_Note: This can be shortened by focusing on major features and skipping some details, or split into multiple shorter videos (e.g., "Getting Started", "Advanced Features", "Configuration")._

---

## Marketing Website Analysis

### Current State ✅
The website (`website/index.html`) is quite comprehensive and covers most major features effectively:

- **Hero section**: Clear value proposition with schema-aware focus
- **Video placeholder**: Ready for your demo video
- **Feature highlights**: Focus mode, copyedit, MDX components, dark mode, image fields
- **Feature grid**: 6 cards covering key features
- **"How it works" section**: Simple 3-step explanation with schema code example
- **SEO & structured data**: Well optimized
- **Current features covered**:
  - Schema-aware frontmatter with all Zod types
  - Cross-collection references
  - Nested objects
  - Image fields with previews
  - MDX components (Astro, React, Vue, Svelte)
  - Focus and typewriter modes
  - Copyedit highlighting
  - Command palette
  - Auto-save

### Missing Features That Should Be Highlighted ⚠️

1. **Customizable Heading Colors**: Not mentioned at all. Users can customize heading colors in preferences with separate pickers for dark/light themes. This personalization feature should be highlighted.

2. **Subfolder Support**: Not explicitly mentioned. This is a significant organizational feature worth highlighting.

3. **Three-Tier Configuration**: The flexible preferences system (global → project → collection) is mentioned in docs but not prominently featured on the marketing site. This is a major differentiator for complex projects.

4. **Relative Paths by Default**: The NEW default behavior (relative paths with configurable override) isn't mentioned. This makes content more portable.

5. **File Type Defaults (MD vs MDX)**: Not mentioned - the ability to configure at three levels is unique.

### Suggested Additions/Updates

**New Feature Card Ideas** (to add to the feature grid):

1. **"Flexible Configuration"**:
   - Headline: "Adapt to any project structure"
   - Copy: "Three-tier preferences system lets you override paths and field mappings globally, per project, or per collection. Works with unusual Astro setups without compromise."

2. **"Subfolder Organization"** (or combine with existing):
   - Headline: "Navigate deep collection structures"
   - Copy: "Full support for nested subdirectories with breadcrumb navigation. Files and folders sorted intelligently, with draft filtering across all levels."

**Minor Copy Updates**:

- The "auto-save" card currently says "Saves every 2 seconds" - should be updated to "Saves automatically as you write (configurable delay, with backup saves every 10 seconds)" or similar
- Consider adding heading color customization to the personalization messaging
- Emphasize relative paths as default (more portable content)

### Screenshots Needed (You'll Handle These)

Based on the image references in the HTML:
- `overview.png` ✅ (exists)
- `focus-mode.png` ✅ (exists)
- `editor-mode.png` ✅ (exists - copyedit)
- `mdx-insert-panel.png` ✅ (exists)
- `dark-mode.png` ✅ (exists)
- `image-field-in-sidebar.png` ✅ (exists)

**Potentially Useful New Screenshots**:
- Subfolder navigation with breadcrumbs
- Preferences panel showing three-tier configuration
- Reference field dropdowns in action
- Command palette file search

### README.md Analysis

The README is concise and up to date. It covers:
- All major features succinctly
- Astro requirements
- Installation
- Links to docs

**Minimal changes needed**:
- Auto-save timing (pending clarification)
- Everything else looks good

---

## Completed Deliverables ✅

### 1. Blog Post Summary - COMPLETE ✅
See "FINAL: Blog Post - Major Features Summary" section above. Ready to use for blog post or release notes.

### 2. User Guide Updates - COMPLETE ✅
Updated `docs/user-guide.md` with:
- ✅ Auto-save behavior (2 seconds after stopping + 10 seconds while typing)
- ✅ Heading colors customization in preferences
- ✅ Image fields: clarified edit button switches to text input
- ✅ Image path configuration: relative paths are default, configurable override
- ✅ Image path strategy documented in project and collection settings

### 3. Demo Video Outline - COMPLETE ✅
See "Demo Video Outline" section above. Comprehensive 30-35 minute script covering ALL features in logical order.

### 4. Marketing Website Updates - COMPLETE ✅
Updated `website/index.html` with:
- ✅ Added Homebrew installation note near download button
- ✅ Updated auto-save card with accurate timing description
- ✅ Added "Navigate deep hierarchies" feature card (subfolder support)
- ✅ Added "Adapt to any project structure" feature card (three-tier configuration)
- ✅ Added "Image preview on hover" feature card
- ✅ Added visual showcase section for image preview on hover (placeholder: `image-preview-hover.png`)
- ✅ Updated structured data with all new features
- ✅ Added heading colors mention to "Beautiful dark interface" section
- ✅ Updated image fields sections to emphasize relative paths as default
- ✅ Updated smart image handling card to mention relative paths

### 5. README.md Updates - COMPLETE ✅
Updated `README.md` with:
- ✅ Heading colors feature
- ✅ Accurate auto-save timing
- ✅ Relative paths as default for images

### 6. Internal Developer Docs Review - COMPLETE ✅
Checked CLAUDE.md and developer docs. No updates needed - they reference the user guide and don't need feature-specific changes.

---

---

## Marketing Website Updates - IMPLEMENTED ✅

All suggested changes have been implemented in `website/index.html`:

### Changes Made:

1. ✅ **Added Homebrew installation note** below download button:
   - Shows `brew install --cask astro-editor` command in styled code block

2. ✅ **Updated auto-save card** text:
   - Now accurately describes: "Automatically saves as you write with configurable delay, plus backup saves every 10 seconds during flow state"

3. ✅ **Added heading colors mention** to "Beautiful dark interface" section:
   - Added: "Customize heading colors to match your style"

4. ✅ **Added two new feature cards** to the feature grid:
   - "Navigate deep hierarchies" (subfolder support)
   - "Adapt to any project structure" (three-tier configuration)

5. ✅ **Updated structured data** with new features:
   - Added "Customizable heading colors"
   - Added "Subfolder support with breadcrumb navigation"
   - Added "Three-tier configuration system"

6. ✅ **Updated image fields sections** to emphasize relative paths:
   - Main image fields section mentions "relative paths by default for portable content"
   - Smart image handling card mentions "relative paths for portability"

7. ✅ **Added image preview on hover feature**:
   - New feature card in the grid
   - New visual showcase section (needs screenshot)

### Required Screenshot

**`website/image-preview-hover.png`** - Screenshot needed for the new visual showcase section showing:
- The editor with markdown content containing an image path
- Option/Alt being held (maybe show in the screenshot somehow, or just show the preview appearing)
- The image preview appearing in the bottom right corner

### Optional Additional Screenshots

If you want to take more screenshots to showcase other features:
- Preferences panel showing heading color pickers
- Subfolder navigation with breadcrumbs visible
- Three-tier configuration (showing project and collection overrides)
- Reference field dropdown in action

The website is now fully updated and ready to deploy once you add the image-preview-hover screenshot!

---



Below is taken from the release notes for the various recent releases and I've done my best to include everything that has been done since the guides were fully created and the marketing site was created. Some of these things are bug fixes that obviously don't need to be included. You should consider this just a dump of the new features. Roughly in the chronological order they were added.

- Added customisable heading colours in Markdown.
- Made auto save duration customisable in settings.
- Addresses critical bug which caused silent errors for new installations when initialising projects.
- Added more robust logging for production builds.
- Schema fields are now read from the JSON files which astro generates rather than directly from the Zod schema. In the event these haven't been generated it will fall back to the old behaviour.
- Constraints (character limits, min/max etc), default values and .describe() descriptions are now shown in the UI of the right sidebar.
- Added support for subfolders. The file browser now shows subfolders and their contents within content collections.
- The default paths for src/content, assets and "MDX components" directories can now be configured on a per-project basis in the preferences.
- The default or project settings paths for content, assets and "MDX" components directories can be overridden on a per-collection basis in the preferences.
- Frontmatter mappings for title, pubDate, description and draft are now configured on a per-collection basis and persisted in the project settings.
- Simplified preferences storage system and project registry and introduced system to migrate old settings files to new. Preferences system is now more robust when the preferences JSON files have missing data.
- Added debug panel to preferences pane to help with support requests.
- Copyedit highlights are now off by default for new installations.
- Rebuilt and simplified schema parser so Astro's generated schema files and the Zod schemas in content.config.ts are properly parsed and merged in Rust before being passed in a sensible shape into the front-end.
- Added support for reference() fields, which can either reference single items in other collections, or multiple items.
- Added support for reading JSON-file-based content collections only when they are referenced by another collection. So given an authors.json file with the appropriate schema which is referenced in an articles collection, Author can be selected from a dropdown in the frontmatter panel.
- Improved support for field descriptions and nested fields in sidebar UI.
- Fixed bug where auto-updater would update regardless of user input. Added menu item to check for updates.
- The DMG now universal includes a universal binary which should work on both ARM and Intel-based machines. Previously only ARM binaries were included.
- Adds support for React, Vue, and Svelte components in the MDX Component Builder in addition to Astro components.
- Fixes nested properties (ie objects) in schemas so they display properly in the sidebar.
- Ligatures in iA Writer Duo are disabled. Fixes an issue where the editor would visually add extra spaces in some paragraphs.
- Updates to frontmatter fields which affect the file browser sidebar (draft, title, published date) now correctly update the sidebar.
- Text fields and textareas in the frontmatter panel now have auto-capitalise and spellcheck disabled.
- Fixed some visual display bugs in dark mode.
- Holding option/alt when hovering over an image URL or path in the editor shows a preview in the bottom right. This works for remote images (ie a URL), absolute paths relative to the Astro project route, and relative paths. Relative paths may not work reliably for unusual or complex Astro folder structures.
- Fields which use Astro's image() helper in their content.config.json schema will render an image picker and preview in the frontmatter sidebar.
  - Images can be dragged to the button or selected from the file picker. They will be copied to the collections configured assets directory (and renamed appropriately) and the path (absolute relative to the project root) will be added to the frontmatter.
  - Images added from within the astro site are not copied to assets - their absolute path is inserted as-is.
  - Image paths can be manually edited like any other text field by clicking the edit button.
  - Image previews support remote images (ie a URL), absolute paths relative to the Astro project route, and relative paths. Relative paths may not work reliably for unusual or complex Astro folder structures.
  - Fields using Astro's image() helper which are nested inside an object() in the schema currently show as simple text fields in the UI. This will be fixed in a future release.
-  Rebuilt simplified Zod schema parser to only handle information which isn't available in the generated JSON schemas. Currently this is Zod references() and Astro image() fields.
  - BREAKING CHANGE: Generated JSON schemas are now required for schema fields to show in the sidebar. While content.config.json or content/config.json schemas are still parsed, they are now only used to enrich the generated JSON schemas. Runnigh astro sync or astro dev or astro build in your Astro project will auto-generate these schemas, so this should not negatively affect many users.
- Simplified logic for handling images and files added to MD/MDX files and/or frontmatter. No change to functionality, but should make this more reliable.
- Users can now choose between Markdown or MDX as the default filetype for new files. This is configurable in the global settings, and can be overridden on a per-project and per-collection basis.
- Files now auto-save every ten seconds regardless of whether the user has stopped typing. This ensures content is written to disk when typing in flow-state. The existing autosave-after-cease-typing functionality still works as before.
- Fixed minor UI inconsistencies.
- Images and files dragged into the editor or added to an image-type frontmatter field now default to relative paths. This can be overridden to use absolute paths (relative to the project root) on a per-project and per-collection basis.
