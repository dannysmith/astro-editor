# Collection Sorting & Filtering Fixes

## Overview

Address bugs and UX issues with how files are sorted and filtered in the sidebar, and add visual clarity for schema status.

## Problems to Solve

### 1. Draft Field Override Bug

**User report**: "I changed the drafts tag to something else (an optional field called `archived`), but both archived and items with the default draft tag now show up in Drafts."

**Root cause**: Draft detection happens in two places with different logic:

1. **Rust backend** (hardcoded):
   ```rust
   // src-tauri/src/models/file_entry.rs:79-82
   self.is_draft = frontmatter
       .get("draft")  // ← ALWAYS checks "draft", ignores custom field
       .and_then(|v| v.as_bool())
       .unwrap_or(false);
   ```

2. **Frontend filter** (uses settings):
   ```typescript
   // src/lib/files/filtering.ts:37
   file.isDraft || file.frontmatter?.[mappings?.draft || 'draft'] === true
   ```

The frontend uses OR logic, so files matching EITHER the backend's hardcoded `draft` field OR the user's custom field are shown.

### 2. Haphazard Sort Order

**User report**: "The sorting seems to be haphazard—it's neither sorted alphabetically by title or file name, nor chronologically."

**Root cause**: When files have no date fields, the sort preserves filesystem order:
```typescript
// src/lib/files/sorting.ts:66-67
if (!dateA && !dateB) return 0  // ← Preserves OS-dependent order
```

Filesystem order varies by OS and is effectively random to users.

### 3. No Visual Indicator for Schema Status

Users can't tell which folders have valid schema assignments vs which are just directories in the content folder. The header "Collections" also implies all folders are schema-mapped collections, which isn't always true.

---

## Proposed Solutions

### Fix 1: Remove Backend Draft Detection

**Approach**: Remove `isDraft` field from Rust entirely; do all draft detection in frontend.

**Why this approach**:
- Simpler than passing settings to Rust
- Draft field is already in frontmatter which frontend has access to
- Settings are already resolved in frontend via `useEffectiveSettings`
- `isDraft` was an optimization that created coupling

**Changes required**:

1. **Rust** (`src-tauri/src/models/file_entry.rs`):
   - Remove `is_draft` field from `FileEntry` struct
   - Remove `#[serde(rename = "isDraft")]` annotation
   - Remove draft detection logic in `with_frontmatter()`
   - Update tests

2. **TypeScript bindings** will auto-regenerate without `isDraft`

3. **Frontend filter** (`src/lib/files/filtering.ts`):
   - Remove `file.isDraft` check
   - Only use `file.frontmatter?.[mappings?.draft || 'draft'] === true`

4. **FileItem** (`src/components/layout/FileItem.tsx`):
   - Update `isFileDraft` logic to remove `file.isDraft`

5. **Tests**: Update all test fixtures that use `isDraft`

**Files to modify**:
- `src-tauri/src/models/file_entry.rs`
- `src/lib/files/filtering.ts`
- `src/lib/files/filtering.test.ts`
- `src/components/layout/FileItem.tsx`
- Various test files with mock `FileEntry` objects

---

### Fix 2: Alphabetical Fallback Sort

**Approach**: Ensure completely deterministic sort ordering:
1. Undated files at top, sorted alphabetically by title (falling back to filename)
2. Dated files below, sorted newest first
3. Same-date files use alphabetical tiebreaker

**Changes required**:

1. **sorting.ts** (`src/lib/files/sorting.ts`) - refactor sort function:
   ```typescript
   export function sortFilesByPublishedDate(
     files: FileEntry[],
     mappings: FieldMappings | null
   ): FileEntry[] {
     const getTitle = (file: FileEntry): string => {
       return (file.frontmatter?.[mappings?.title || 'title'] as string) || file.name
     }

     return [...files].sort((a, b) => {
       const dateA = getPublishedDate(a.frontmatter || {}, mappings?.publishedDate || 'publishedDate')
       const dateB = getPublishedDate(b.frontmatter || {}, mappings?.publishedDate || 'publishedDate')

       // Undated files go to top, sorted alphabetically among themselves
       if (!dateA && !dateB) {
         return getTitle(a).localeCompare(getTitle(b))
       }
       if (!dateA) return -1
       if (!dateB) return 1

       // Dated files: newest first, alphabetical tiebreaker
       const dateDiff = dateB.getTime() - dateA.getTime()
       if (dateDiff !== 0) return dateDiff
       return getTitle(a).localeCompare(getTitle(b))
     })
   }
   ```

2. **Tests**: Add test cases for:
   - Undated files sorted alphabetically
   - Same-date files sorted alphabetically
   - Mixed dated/undated files (undated first, then dated newest-first)

---

### Fix 3: Schema Status Indicator

**Approach**: Add visual indicator for folders WITHOUT valid schema assignments (the exception case). Also simplify the header text.

**Current data**: Collections have `complete_schema: string | null` - if null or empty, no schema is loaded.

**Changes required**:

1. **LeftSidebar.tsx** - header text:
   - Change header from "Collections" to "Content" (neutral term)

2. **LeftSidebar.tsx** - collection list (~lines 343-380):
   - Add subtle warning icon next to collection name ONLY when `complete_schema` is null/empty
   - Use `AlertTriangle` from Lucide, small size, muted color (`text-muted-foreground`)
   - Include tooltip on hover: "No schema found - using defaults"
   - No click action for now (future: could link to Project Manager UI)

3. **No indicator for valid schemas** - the normal case needs no visual noise

---

## Implementation Order

1. **Fix 1** (Draft bug) - Most impactful bug fix
2. **Fix 2** (Sort fallback) - Quick improvement
3. **Fix 3** (Schema indicator + header text) - UI enhancement

## Testing Plan

- [ ] Manual: Change draft field to custom name, verify only custom field files show in Drafts
- [ ] Manual: Collection with no date fields sorts alphabetically
- [ ] Manual: Collection with mixed dated/undated files - undated at top, sorted alphabetically among themselves
- [ ] Unit tests for filtering.ts changes
- [ ] Unit tests for sorting.ts changes
- [ ] Visual: Schema indicator appears correctly for mapped vs unmapped folders
- [ ] Visual: Header shows "Content" instead of "Collections"

## Out of Scope (Separate Tasks)

- Sort controls and search/filter in sidebar → `task-2-sidebar-sorting-filtering-ui.md`
- CSV collection support → `task-3-csv-collection-support.md`
- Full project manager UI → `task-4-project-manager-epic.md`

---

## Notes

The draft field bug highlights a design issue: the backend was doing work that depends on user settings it doesn't have access to. Moving draft detection to frontend follows the principle of keeping settings-dependent logic where settings are available.

The sort fallback is a sensible default that matches user expectations - if there's no date to sort by, alphabetical is the next logical choice.
