# Content Link Insertion

> GitHub Issue: #10

## Problem

Users writing content in the editor often need to link to other content items. Currently they must manually look up the title and path of the target item, switch context, and type the link by hand. This is tedious and error-prone.

The deeper challenge: the editor knows about content collections (names, files, slugs, frontmatter) but does **not** know the Astro site's routing configuration. A collection called `articles` might render at `/writing/thing`, not `/articles/thing`. We cannot reliably generate final URLs without parsing the site's routing layer.

## Solution

A **Content Linker Picker** - a dedicated dialog (similar to the MDX Component Builder) that lets users:

1. **Search** all content items across all collections with fuzzy matching
2. **Open** a content item for editing (Enter)
3. **Insert a markdown link** to a content item at the cursor position (Cmd+Enter)

Link URLs are constructed using a **configurable per-collection URL pattern** in project preferences. When no pattern is configured, the default is a relative file path (e.g. `[Title](../other-collection/filename.md)`).

## Requirements

### Content Linker Picker Dialog

- Triggered by **Cmd+Shift+K** from the editor (new keyboard shortcut)
- Also available as a command in the command palette (eg "Insert Content Link" or "Content Linker")
- Uses `cmdk`-based dialog UI, consistent with the MDX Component Builder and Command Palette
- Fuzzy-searches all content items across all loaded collections
- Each result shows: title (from frontmatter, falling back to filename), collection name, file extension badge
- **Enter**: opens the selected content item for editing (same as command palette file open)
- **Cmd+Enter**: inserts a markdown link at the current cursor position and closes the dialog
- The dialog should indicate both actions (e.g. subtle hint text at the bottom: "Enter to open · Cmd+Enter to insert link")
- When inserting, the editor should regain focus with cursor positioned after the inserted link

### Link Format & URL Patterns

- Each collection can have an optional **URL pattern** in project preferences
- URL pattern is a string template with `{slug}` placeholder, e.g. `/writing/{slug}`
- `{slug}` resolves to the content item's frontmatter `slug` field if present, otherwise falls back to the `id` (relative path from collection root, without extension - matching Astro's behavior)
- When a URL pattern is configured: `[Article Title](/writing/my-post)`
- When no URL pattern is configured (default): `[Article Title](../articles/my-post.md)` (relative file path from current file to target file)
- The link text is the frontmatter `title` field (respecting `frontmatterMappings.title` preference), falling back to the filename

### Preferences UI

- Add a "URL Pattern" field to the per-collection settings in the Preferences pane
- Simple text input with placeholder showing the template format: `/path/{slug}`
- Help text explaining the `{slug}` variable and that it resolves to the content item's ID

### Command Palette Integration

- Remove the existing fuzzy file search from the command palette (the `search` command group from `generateSearchCommands`)
- The content linker picker replaces this functionality with better UX, and adds the link insertion capability
- Keep collection navigation commands in the palette (those are different - they switch to a collection)

## Implementation Plan

### Phase 1: Content Linker Store & Data Layer

Create the Zustand store and link generation logic.

**New files:**
- `src/store/contentLinkerStore.ts` - Store managing dialog state, search, and EditorView reference (follow `componentBuilderStore.ts` pattern)
- `src/lib/content-linker/link-builder.ts` - Pure functions for generating markdown links from content items
- `src/lib/content-linker/index.ts` - Barrel export

**Store shape (contentLinkerStore):**
- `isOpen: boolean`
- `editorView: EditorView | null` - captured when opened from editor
- `open(view: EditorView): void`
- `close(): void`
- `insert(file: FileEntry, collections: Collection[]): void` - generates and inserts the link

**Link builder functions:**
- `buildContentLink(sourceFile, targetFile, urlPattern?, titleField?)` → `[Title](url)`
- `buildRelativePath(sourceFilePath, targetFilePath)` → relative file path between two content files
- `resolveUrlPattern(pattern, file)` → resolved URL string (uses `file.frontmatter.slug` if present, otherwise `file.id`)

### Phase 2: Content Linker Dialog UI

Build the picker dialog component.

**New files:**
- `src/components/content-linker/ContentLinkerDialog.tsx` - Main dialog component
- `src/components/content-linker/index.ts` - Barrel export

**Component details:**
- `cmdk`-based `CommandDialog` (same as ComponentBuilderDialog and CommandPalette)
- Custom filter function for fuzzy matching against title + filename + collection name
- Each item displays: title, collection badge, file extension
- Footer hint bar showing "↩ Open · ⌘↩ Insert link"
- `onSelect` (Enter) → opens file via `useEditorStore.getState().openFile(file)`
- Cmd+Enter handler → calls `contentLinkerStore.getState().insert(file, collections)`
- Sources content items from TanStack Query cache (same pattern as `generateSearchCommands`)

### Phase 3: Keyboard Shortcut & Editor Integration

Wire up the trigger and integrate with the editor.

**Modified files:**
- `src/lib/editor/extensions/keymap.ts` - Add `Mod-Shift-k` shortcut that opens the content linker
- `src/components/editor/Editor.tsx` - Pass content linker handler to keymap (same pattern as component builder handler)
- `src/components/layout/Layout.tsx` - Mount `ContentLinkerDialog`

**Command palette integration:**
- `src/lib/commands/types.ts` - No changes needed (use existing group or add to navigation)
- `src/lib/commands/app-commands.ts` - Add "Insert Content Link" command, remove `generateSearchCommands`
- `src/hooks/useCommandPalette.ts` - Remove search-related logic that's no longer needed

### Phase 4: URL Pattern Preferences

Add per-collection URL pattern configuration.

**Modified files:**
- `src/lib/project-registry/types.ts` - Add `urlPattern?: string` to `CollectionSpecificSettings`
- `src/lib/project-registry/collection-settings.ts` - Include `urlPattern` in three-tier fallback resolution
- `src/components/preferences/panes/CollectionSettingsPane.tsx` - Add URL pattern input field

**Link builder integration:**
- The `insert()` action reads the effective settings for the target file's collection
- If `urlPattern` exists, use it; otherwise fall back to relative file path

### Phase 5: Testing & Polish

- Unit tests for `link-builder.ts` (relative path calculation, URL pattern resolution, edge cases)
- Unit tests for `contentLinkerStore.ts`
- Component test for `ContentLinkerDialog.tsx` (search, selection, keyboard interactions)
- Integration: verify Cmd+Shift+K → picker → Cmd+Enter → link inserted correctly
- Edge cases: linking to items in the same collection, nested subdirectories, items without titles

## Technical Notes

### Existing Patterns to Follow

- **Store pattern**: `componentBuilderStore.ts` - same open/close/insert with EditorView capture
- **Dialog pattern**: `ComponentBuilderDialog.tsx` - cmdk dialog with custom filter
- **Data access**: `generateSearchCommands` in `app-commands.ts` - reading cached query data
- **Insertion**: `insertSnippet.ts` for snippet-based insertion, or direct `view.dispatch()` for simple text
- **Settings**: `CollectionSpecificSettings` type + `useEffectiveSettings` hook

### Content Item Data Available

From `FileEntry` (via TanStack Query cache):
- `id` - relative path from collection root without extension (this is the slug)
- `path` - absolute file path
- `name` - filename without extension
- `extension` - `md` or `mdx`
- `collection` - collection name
- `frontmatter` - all frontmatter fields (including `title`)

### Relative Path Calculation

When no URL pattern is configured, we need to compute a relative path from the source file to the target file. Both files live under `src/content/`, so:
- Source: `src/content/articles/my-post.md`
- Target: `src/content/notes/idea.md`
- Relative path: `../notes/idea.md`

Use the files' `path` properties and compute the relative path between their parent directories.

### Data Availability Caveat

Content items are only searchable if their collection has been loaded into the TanStack Query cache (i.e. the user has visited the collection in the sidebar). This matches the existing behavior from command palette search. We could consider eagerly loading all collections when the project opens, but that's a separate concern.
