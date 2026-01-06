# Collection Sorting & Filtering Fixes

## Overview

Address bugs and UX issues with how files are sorted and filtered in the sidebar, plus clarify the "Collections" vs "Content Folders" terminology.

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

### 3. "Collections" Terminology Confusion

**User report**: Consider renaming "Collections" to "Content Folders" to clarify these represent files on disk, whether or not they're mapped to a content collection schema.

### 4. No Visual Indicator for Schema Status

**Related to #3**: Users can't tell which folders have valid schema assignments vs which are just directories in the content folder.

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

**Approach**: When files have no dates, sort alphabetically by title (falling back to filename).

**Changes required**:

1. **sorting.ts** (`src/lib/files/sorting.ts`):
   ```typescript
   // Change line 67 from:
   if (!dateA && !dateB) return 0

   // To:
   if (!dateA && !dateB) {
     const titleA = a.frontmatter?.[mappings?.title || 'title'] as string || a.name
     const titleB = b.frontmatter?.[mappings?.title || 'title'] as string || b.name
     return titleA.localeCompare(titleB)
   }
   ```

2. **Tests**: Add test cases for alphabetical fallback

**Consideration**: Should this be the ONLY fallback, or should we also apply it as a secondary sort for files WITH dates but the same date? (Probably yes - stable sort.)

---

### Fix 3: Rename "Collections" → "Content Folders"

**Approach**: Update UI text and possibly settings terminology.

**Changes required**:

1. **LeftSidebar.tsx**:
   - Change `'Collections'` string in header (line ~230)
   - Consider whether to change variable names (probably not - internal naming can stay)

2. **Preferences UI** (`CollectionSettingsPane.tsx`):
   - Review section headers and labels
   - May need to clarify "Collection Settings" → "Content Folder Settings"?

3. **Documentation**: Update any user-facing docs

**Open question**: Should we rename throughout (including code variables/types) or just UI text? Recommend UI text only for now - internal naming as "collection" is fine since Astro uses that term.

---

### Fix 4: Schema Status Indicator

**Approach**: Add visual indicator in sidebar showing which folders have valid schema assignments.

**Current data**: Collections already have `complete_schema: string | null` - if null or empty, no schema is loaded.

**Changes required**:

1. **LeftSidebar.tsx** (collection list section, ~lines 343-380):
   - Add icon/badge next to collection name
   - Options:
     - Checkmark for valid schema, warning for no schema
     - Different text color/opacity
     - Tooltip explaining status

2. **Styling**: Define appropriate visual treatment that's subtle but noticeable

**Open questions**:
- What icon to use? (Lucide has `CheckCircle`, `AlertCircle`, `FileQuestion`)
- Should we show a tooltip explaining what it means?
- Should clicking it do anything (e.g., open settings)?

---

## Implementation Order

1. **Fix 1** (Draft bug) - Most impactful bug fix
2. **Fix 2** (Sort fallback) - Quick improvement
3. **Fix 3** (Rename) - Simple text change
4. **Fix 4** (Schema indicator) - UI enhancement

## Testing Plan

- [ ] Manual: Change draft field to custom name, verify only custom field files show in Drafts
- [ ] Manual: Collection with no date fields sorts alphabetically
- [ ] Manual: Collection with mixed dated/undated files - undated at top, sorted alphabetically among themselves
- [ ] Unit tests for filtering.ts changes
- [ ] Unit tests for sorting.ts changes
- [ ] Visual: Schema indicator appears correctly for mapped vs unmapped folders

## Out of Scope

- Sort controls in sidebar (separate task)
- Search/filter in sidebar (separate task)
- Full project manager UI (separate epic)
- CSV collection support (separate task)

---

## Notes

The draft field bug highlights a design issue: the backend was doing work that depends on user settings it doesn't have access to. Moving draft detection to frontend follows the principle of keeping settings-dependent logic where settings are available.

The sort fallback is a sensible default that matches user expectations - if there's no date to sort by, alphabetical is the next logical choice.
