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

### Phase 1: Recursive Collection Scan & Data Layer

The existing `scanDirectory` and `scanCollectionFiles` Rust commands are **non-recursive** - they only return files in the immediate directory. The command palette search only queries the `'root'` cache key, so files in nested subdirectories (e.g. `posts/2024/january/my-post.md`) are invisible unless the user has browsed into that subdirectory. For a content linker, we need to find *all* content items regardless of nesting.

**New Rust command:**
- Add `scan_collection_files_recursive` to `src-tauri/src/commands/project.rs` - walks the entire collection directory tree and returns all `.md`/`.mdx` files with frontmatter parsed. Similar to `scan_collection_files` but uses recursive directory traversal.
- Register in `src-tauri/src/bindings.rs`
- The content linker dialog will call this directly rather than relying on cached `directoryContents` queries

**New TypeScript files:**
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
- Fetches all content items via `scan_collection_files_recursive` when the dialog opens (or uses a dedicated TanStack Query with appropriate cache key)

**Cmd+Enter handling (important):**
The `cmdk` library fires `onSelect` on bare Enter. To support two actions (Enter = open, Cmd+Enter = insert link), we need to intercept Cmd+Enter via `onKeyDown` on `CommandInput` or `CommandItem` *before* `onSelect` fires. This is the same pattern used by `ComponentBuilderDialog` (see lines 119-127) where `onKeyDown` checks for `e.metaKey || e.ctrlKey` and calls `e.preventDefault()` + `e.stopPropagation()` to prevent `onSelect` from also firing. We need to track the currently-highlighted item to know which file to insert - either via `cmdk`'s value state or by tracking selection in our store.

### Phase 3: Keyboard Shortcut & Editor Integration

Wire up the trigger and integrate with the editor.

**Modified files:**
- `src/lib/editor/extensions/keymap.ts` - Add `Mod-Shift-k` shortcut that opens the content linker
- `src/components/editor/Editor.tsx` - Create content linker handler and pass to keymap
- `src/components/layout/Layout.tsx` - Mount `ContentLinkerDialog`

**Keymap handler signature change:**
`createMarkdownKeymap` currently takes a single `componentBuilderHandler` parameter. Rather than adding a second positional parameter, refactor to accept a handlers object:
```typescript
// Before:
createMarkdownKeymap(componentBuilderHandler?: (view: EditorView) => boolean)

// After:
createMarkdownKeymap(handlers?: {
  componentBuilder?: (view: EditorView) => boolean
  contentLinker?: (view: EditorView) => boolean
})
```
This avoids parameter bloat if more handlers are added later. Update `createExtensions`, `useEditorSetup`, and `Editor.tsx` to pass the new shape.

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

- Unit tests for `link-builder.ts`:
  - Relative path: cross-collection (`../notes/idea.md`)
  - Relative path: same collection (`./other-post.md`)
  - Relative path: source at root, target nested (`./2024/january/deep-post.md`)
  - Relative path: source nested, target at root (`../../other-post.md`)
  - Relative path: both nested at different depths
  - URL pattern with frontmatter `slug` field present
  - URL pattern with no `slug` field (falls back to `id`)
  - Title resolution respecting `frontmatterMappings.title`
  - Fallback to filename when no title in frontmatter
- Unit tests for `contentLinkerStore.ts`
- Component test for `ContentLinkerDialog.tsx`:
  - Fuzzy search filters correctly
  - Enter opens file (onSelect behavior)
  - Cmd+Enter inserts link and does NOT also trigger onSelect
  - Dialog closes and editor regains focus after both actions
- Rust test for `scan_collection_files_recursive` (finds files in nested subdirectories)

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

When no URL pattern is configured, we need to compute a relative path from the source file to the target file. Both files live under `src/content/`, so we use their `path` properties and compute the relative path between their parent directories.

**Cross-collection example:**
- Source: `src/content/articles/my-post.md`
- Target: `src/content/notes/idea.md`
- Relative path: `../notes/idea.md`

**Same-collection example:**
- Source: `src/content/articles/my-post.md`
- Target: `src/content/articles/other-post.md`
- Relative path: `./other-post.md`

**Nested subdirectory examples:**
- Source: `src/content/posts/my-post.md` (root level)
- Target: `src/content/posts/2024/january/deep-post.md` (nested)
- Relative path: `./2024/january/deep-post.md`

- Source: `src/content/posts/2024/january/deep-post.md` (nested)
- Target: `src/content/posts/other-post.md` (root level)
- Relative path: `../../other-post.md`

These cases should all have explicit unit tests in `link-builder.test.ts`.

### Data Availability

The content linker uses `scan_collection_files_recursive` to fetch all files across all collections when the dialog opens. This is independent of the sidebar's `directoryContents` cache - the user doesn't need to have visited a collection for its files to appear in the linker. The results can be cached with a dedicated TanStack Query key (e.g. `queryKeys.allContentFiles(projectPath)`) so repeated opens don't re-scan.
