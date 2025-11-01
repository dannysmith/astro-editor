# Quick Wins: Architecture & Utilities

## Overview

Establish architectural patterns and extract key utilities to improve testability. These are quick wins (1-2 days total) that provide foundational improvements before tackling larger refactorings and testing work.

**Total Time:** 10-15 hours (~1-2 days)

**Impact:**
- Clear architectural boundaries
- More testable code structure
- Reusable utilities across codebase
- Prevention of future violations

---

## ⚠️ CRITICAL: Lessons from Previous Attempt

**A previous implementation attempt caused a bug where clicking files in the sidebar loaded the wrong file.**

### Root Cause Analysis

The bug was likely caused by **Item 2.2 (LeftSidebar Extraction)**:
- **Boolean logic confusion**: Parameter naming (`showDrafts` vs `showDraftsOnly`) led to inverted filtering
- **Incorrect file references**: File object references may have been duplicated instead of preserved
- **Missing useMemo dependencies**: Stale file lists caused clicks to target wrong files
- **getPublishedDate changes**: Different sorting behavior changed file positions

### Implementation Strategy to Prevent Recurrence

1. **ONE ITEM AT A TIME**: Complete and test each item fully before moving to the next
2. **Manual file-click testing AFTER EACH ITEM**: Don't batch testing
3. **Use exact parameter names from existing code**: Avoid renaming that could cause confusion
4. **Preserve file object references**: Don't create new file objects, filter/sort existing ones
5. **Maintain exact useMemo dependencies**: Don't change memoization behavior
6. **Item 2.2 requires EXTREME CARE**: This is the highest-risk item

---

## Phase 1: Architecture Boundaries (4-6 hours)

Fix directory convention violations by moving React hooks from `/lib/` to `/hooks/`.

### Item 1.1: Move useCommandContext to hooks/

**File:** `lib/commands/command-context.ts` → `hooks/commands/useCommandContext.ts`
**Time:** 2-3 hours
**Risk:** LOW

#### Current Issue

```typescript
// lib/commands/command-context.ts - WRONG LOCATION
export function useCommandContext(): CommandContext {
  const { currentFile, isDirty } = useEditorStore()
  // ... React hook in /lib/
}
```

#### Implementation

1. Create `src/hooks/commands/` directory
2. Move file: `git mv src/lib/commands/command-context.ts src/hooks/commands/useCommandContext.ts`
3. Update imports (~5-10 files):
   ```bash
   grep -r "from.*command-context" src/
   ```
   Change to: `import { useCommandContext } from '@/hooks/commands/useCommandContext'`
4. Add barrel export in `src/hooks/commands/index.ts`
5. Remove export from `lib/commands/index.ts` if present

#### Testing

```bash
pnpm run check:ts
```

**Manual Testing (REQUIRED before proceeding to Item 1.2):**
1. Open command palette (Cmd+K) - verify all commands work
2. Open a collection and click on 3 different files - verify each opens correctly
3. Toggle "Show Drafts Only" - verify files filter correctly
4. Click on a file after filtering - verify correct file opens

**✅ Only proceed to Item 1.2 if all tests pass**

---

### Item 1.2: Move useEffectiveSettings to hooks/

**File:** `lib/project-registry/effective-settings.ts` → Split into hook + pure function
**Time:** 2-3 hours
**Risk:** LOW-MEDIUM (need to split file)

#### Current Issue

```typescript
// lib/project-registry/effective-settings.ts
export const useEffectiveSettings = (collectionName?: string) => {
  const { currentProjectSettings } = useProjectStore()
  // ... React hook
}

export const getEffectiveSettings = (...) => {
  // ... pure function (should stay in lib/)
}
```

File exports both hook AND pure function. Need to split.

#### Implementation

1. Create `src/hooks/settings/useEffectiveSettings.ts`:
   ```typescript
   import { useProjectStore } from '@/store/projectStore'
   import { getEffectiveSettings } from '@/lib/project-registry/effective-settings'

   export const useEffectiveSettings = (collectionName?: string) => {
     const { currentProjectSettings } = useProjectStore()
     return getEffectiveSettings(currentProjectSettings, collectionName)
   }
   ```

2. Update `lib/project-registry/effective-settings.ts`:
   - Remove `useEffectiveSettings` hook
   - Keep `getEffectiveSettings` pure function
   - Remove `useProjectStore` import

3. Update imports (~15-20 files):
   ```bash
   grep -r "useEffectiveSettings" src/
   ```
   Change to: `import { useEffectiveSettings } from '@/hooks/settings/useEffectiveSettings'`

   **Important:** Files importing ONLY `getEffectiveSettings` keep existing import.

4. Add barrel export in `src/hooks/settings/index.ts`

#### Testing

```bash
pnpm run check:ts
```

**Manual Testing (REQUIRED before proceeding to Item 2.1):**
1. Open preferences (Cmd+,) - change collection settings
2. Verify settings apply correctly in editor
3. Test with multiple collections - verify effective settings merge correctly (global + collection)
4. Open a collection and click on 3 different files - verify each opens correctly
5. Toggle "Show Drafts Only" - verify files filter correctly

**✅ Only proceed to Item 2.1 if all tests pass**

---

## Phase 2: Extract Utilities (4-6 hours)

Extract pure functions from components/stores to improve testability and reusability.

### Item 2.1: Extract Nested Value Operations

**File:** `src/store/editorStore.ts` → `src/lib/object-utils.ts`
**Time:** 2-3 hours
**Risk:** LOW

**Reference:** See original Task 1, Item 4 for full details.

#### Quick Summary

Extract three utility functions from editorStore (lines 17-176):
- `setNestedValue` - Safely set nested values with prototype pollution protection
- `getNestedValue` - Get nested values by path
- `deleteNestedValue` - Delete nested values

#### Implementation

1. Create `src/lib/object-utils.ts` with the three functions
2. Update `src/store/editorStore.ts` to import from new location
3. Create `src/lib/object-utils.test.ts` with comprehensive tests
4. Export from `src/lib/index.ts`

#### Benefits

- Store file: 462 lines → ~300 lines
- Reusable across entire codebase
- Dedicated test coverage

#### Testing

```bash
pnpm run check:ts
pnpm run test:run  # Run the new object-utils tests
```

**Manual Testing (REQUIRED before proceeding to Item 2.2):**
1. Open a file and edit frontmatter fields (test setNestedValue)
2. Verify nested object fields work (e.g., author.name)
3. Delete frontmatter fields - verify they're removed (test deleteNestedValue)
4. Open a collection and click on 3 different files - verify each opens correctly
5. Toggle "Show Drafts Only" - verify files filter correctly

**✅ Only proceed to Item 2.2 if all tests pass**

---

### Item 2.2: Extract LeftSidebar Filtering and Sorting

**File:** `src/components/layout/LeftSidebar.tsx` → `src/lib/files/`
**Time:** 3-4 hours
**Risk:** 🔴 **HIGHEST RISK - EXTREME CARE REQUIRED**

**⚠️ THIS ITEM CAUSED THE BUG IN THE PREVIOUS ATTEMPT**

**Reference:** See original Task 1, Item 5 for full details.

#### Quick Summary

Extract file filtering and sorting logic from LeftSidebar (lines 228-263) to reusable functions:

Create `src/lib/files/filtering.ts`:
```typescript
// CRITICAL: Use showDraftsOnly (NOT showDrafts) to match existing code
export function filterFilesByDraft(
  files: FileEntry[],
  showDraftsOnly: boolean,  // ⚠️ EXACT SAME NAME as existing code
  mappings: FieldMappings | null
): FileEntry[]
```

Create `src/lib/files/sorting.ts`:
```typescript
export function sortFilesByPublishedDate(
  files: FileEntry[],
  mappings: FieldMappings | null
): FileEntry[]

// ⚠️ MUST be IDENTICAL to FileItem.tsx implementation (lines 42-60)
export function getPublishedDate(
  frontmatter: Record<string, unknown>,
  publishedDateField: string | string[]
): Date | null
```

#### Implementation

**CRITICAL PRECAUTIONS:**

1. **✅ BEFORE extracting - Document current behavior:**
   ```bash
   # Test manually and take notes:
   # - Open a collection
   # - Note which files appear
   # - Toggle "Show Drafts Only"
   # - Note which files appear after toggle
   # - Click on first, middle, last file
   # - Note which file opens for each click
   ```

2. **Create `src/lib/files/filtering.ts`:**
   - ⚠️ **MUST use `showDraftsOnly` parameter name**
   - ⚠️ **MUST preserve file object references** - use `files.filter()` not `files.map()`
   - ⚠️ Copy exact logic from LeftSidebar.tsx lines 230-237

3. **Create `src/lib/files/sorting.ts`:**
   - ⚠️ **Move `getPublishedDate` from FileItem.tsx (lines 42-60) WITHOUT CHANGES**
   - ⚠️ **MUST preserve array spreading** - use `[...files].sort()` not `files.sort()`
   - ⚠️ Copy exact sorting logic from LeftSidebar.tsx lines 240-257

4. **Update LeftSidebar.tsx:**
   - Import the new functions
   - Replace inline logic with function calls
   - ⚠️ **MUST preserve useMemo dependencies exactly:**
     ```typescript
     const filteredAndSortedFiles = React.useMemo((): FileEntry[] => {
       const filtered = filterFilesByDraft(files, showDraftsOnly, frontmatterMappings)
       return sortFilesByPublishedDate(filtered, frontmatterMappings)
     }, [files, frontmatterMappings, showDraftsOnly])
     // ⚠️ Keep ALL these dependencies: files, frontmatterMappings (object), showDraftsOnly
     ```

5. **Update FileItem.tsx:**
   - Remove `getPublishedDate` export (now imported from lib/files/sorting)
   - Import from `@/lib/files/sorting`

6. **Create comprehensive tests:**
   - `filtering.test.ts` - test both showDraftsOnly=true and false
   - `sorting.test.ts` - test various date scenarios, missing dates

7. **Export from `src/lib/files/index.ts`**

#### Benefits

- Reusable for command palette, search, other file lists
- Testable in isolation
- Easy to add new filter types (tags, categories)

#### Testing

```bash
pnpm run check:ts
pnpm run test:run  # Run the new filtering/sorting tests
```

**Manual Testing (CRITICAL - DO NOT SKIP):**

**🚨 COMPARE WITH NOTES FROM "BEFORE EXTRACTING" STEP 🚨**

1. **Basic file clicking:**
   - Open the same collection as before
   - Verify the SAME files appear in the SAME order
   - Click on first file - verify SAME file opens as before
   - Click on middle file - verify SAME file opens as before
   - Click on last file - verify SAME file opens as before

2. **Draft filtering:**
   - Toggle "Show Drafts Only"
   - Verify the SAME files appear as before
   - Click on a draft file - verify correct file opens
   - Toggle back - verify full list returns

3. **Different collections:**
   - Switch to a different collection
   - Click on 3 different files - verify each opens correctly
   - Toggle "Show Drafts Only" - verify filtering works

4. **Edge cases:**
   - Collection with no draft files - toggle "Show Drafts Only"
   - Collection with files without dates - verify they appear at top
   - Collection with nested subdirectories - navigate and click files

**❌ IF ANY TEST FAILS: STOP IMMEDIATELY AND DEBUG BEFORE PROCEEDING**

**✅ Only proceed to Phase 3 if ALL tests pass and behavior EXACTLY matches pre-extraction behavior**

---

## Phase 3: Update Documentation (1-2 hours)

Document the new architectural patterns for future development.

1. **Add to `docs/developer/architecture-guide.md`:**

```markdown
### Directory Purpose and Boundaries

| Directory | Purpose | Can Import From | Cannot Import From | Exports |
|-----------|---------|-----------------|-------------------|---------|
| `lib/` | Pure business logic, utilities, classes | Other lib modules | store (except getState), hooks | Functions, classes, types |
| `hooks/` | React hooks, lifecycle logic | lib, store | - | Hooks |
| `store/` | Zustand state management | lib (for utilities) | hooks | Stores (which are hooks) |

**Rule:** If a module exports a React hook (`use*`), it belongs in `hooks/`, not `lib/`.

**Exception:** Context providers (ThemeProvider, QueryClientProvider) can live in lib/ if they're framework integrations.

**Example of getState() pattern (acceptable):**
```typescript
// lib/ide.ts - This is OK
export async function openInIde(filePath: string) {
  const ideCommand = useProjectStore.getState().globalSettings?.general?.ideCommand
  // One-way call, no React coupling
}
```

**Example of hook in lib (violation):**
```typescript
// lib/commands/command-context.ts - WRONG
export function useCommandContext() {
  const { currentFile } = useEditorStore() // This is a React hook!
  // Should be in hooks/commands/useCommandContext.ts
}
```
```

2. **Update CLAUDE.md:**

Add under "Development Practices":

```markdown
### Directory Boundaries

- **Hooks belong in `/hooks/`**: If it exports a `use*` function, it goes in `/hooks/`
- **Pure functions in `/lib/`**: Business logic, utilities, classes
- **getState() is allowed**: One-way calls from lib to store using `getState()` are acceptable
- See `docs/developer/architecture-guide.md` for complete rules
```

---

## Overall Testing Strategy

### Before Starting

```bash
# Establish baseline
pnpm run check:all
pnpm run test:run
```

### ⚠️ CRITICAL: Test After EACH Item (Not Each Phase)

**ONE ITEM AT A TIME:**
1. Complete implementation for one item
2. Run TypeScript check: `pnpm run check:ts`
3. Run tests if new tests were added: `pnpm run test:run`
4. **PERFORM MANUAL TESTING** (see each item's testing section)
5. **ONLY proceed to next item if ALL tests pass**

### After ALL Items Complete

```bash
# Full quality check before committing
pnpm run check:all
```

### File-Click Testing (CRITICAL for Each Item)

**EVERY item must pass this test:**
1. Open a collection
2. Click on first file - verify it opens correctly
3. Click on middle file - verify it opens correctly
4. Click on last file - verify it opens correctly
5. Toggle "Show Drafts Only" - verify filtering works
6. Click on a file after filtering - verify correct file opens

**If file clicking breaks at any step, STOP and revert that item's changes before proceeding.**

---

## Success Criteria

### Task Complete When

- [ ] **Phase 1 Complete:**
  - [ ] Item 1.1: useCommandContext moved to `/hooks/commands/`
  - [ ] Item 1.2: useEffectiveSettings moved to `/hooks/settings/`
  - [ ] All Phase 1 manual tests pass

- [ ] **Phase 2 Complete:**
  - [ ] Item 2.1: Nested value utilities extracted to `lib/object-utils.ts` with tests
  - [ ] Item 2.2: File filtering/sorting extracted to `lib/files/` with tests
  - [ ] All Phase 2 manual tests pass
  - [ ] **CRITICAL: File clicking works correctly after Item 2.2**

- [ ] **Phase 3 Complete:**
  - [ ] Architecture guide updated
  - [ ] CLAUDE.md updated

- [ ] **Overall Quality:**
  - [ ] All TypeScript compiles without errors
  - [ ] All tests passing (`pnpm run test:run`)
  - [ ] `pnpm run check:all` succeeds
  - [ ] All manual file-click testing confirms correct behavior

---

## Implementation Order

**⚠️ CRITICAL: ONE ITEM AT A TIME, FULLY TESTED BEFORE MOVING TO THE NEXT**

1. **Item 1.1** (LOW RISK) - Move useCommandContext → Test → Verify
2. **Item 1.2** (LOW RISK) - Move useEffectiveSettings → Test → Verify
3. **Item 2.1** (LOW RISK) - Extract object-utils → Test → Verify
4. **Item 2.2** (🔴 HIGHEST RISK) - Extract LeftSidebar filtering/sorting → **Document behavior first** → Extract → **Test extensively** → Verify
5. **Phase 3** - Update documentation

**Do NOT skip ahead. Do NOT batch items. Test after EACH item.**

---

## Key Files Reference

**Files to create:**
- `src/hooks/commands/useCommandContext.ts`
- `src/hooks/commands/index.ts`
- `src/hooks/settings/useEffectiveSettings.ts`
- `src/hooks/settings/index.ts`
- `src/lib/object-utils.ts`
- `src/lib/object-utils.test.ts`
- `src/lib/files/filtering.ts`
- `src/lib/files/filtering.test.ts`
- `src/lib/files/sorting.ts`
- `src/lib/files/sorting.test.ts`

**Files to modify:**
- `src/lib/commands/command-context.ts` (delete, moved to hooks)
- `src/lib/project-registry/effective-settings.ts` (remove hook, keep pure function)
- `src/store/editorStore.ts` (remove utilities, import from lib)
- `src/components/layout/LeftSidebar.tsx` (🔴 HIGHEST RISK - use extracted functions, preserve useMemo)
- `src/components/layout/FileItem.tsx` (remove getPublishedDate, import from lib)
- `docs/developer/architecture-guide.md` (add section)
- `CLAUDE.md` (add note)

**Search commands:**
```bash
# Find useCommandContext imports
grep -r "command-context" src/

# Find useEffectiveSettings imports
grep -r "useEffectiveSettings" src/

# Find all hooks in lib/ (to verify we got them all)
grep -r "export.*use[A-Z]" src/lib/
```

---

## Notes

- **Total effort:** 10-15 hours (~1-2 days)
- **Risk level:** Varies by item (LOW to HIGHEST)
  - Items 1.1, 1.2, 2.1: LOW risk
  - Item 2.2: 🔴 HIGHEST RISK - caused bug in previous attempt
- **High value:** Establishes patterns, improves testability
- **Enables Task 2:** Extracted utilities are easier to test
- **getState() pattern is fine:** Don't refactor these (7 files use it correctly)

### Critical Success Factors

1. **One item at a time** - Do not batch or skip ahead
2. **Test after each item** - Manual file-click testing is non-negotiable
3. **Document before extracting Item 2.2** - Know what behavior to preserve
4. **Exact parameter names** - Use `showDraftsOnly` not `showDrafts`
5. **Preserve object references** - Don't create new file objects
6. **Maintain useMemo dependencies** - Don't change memoization

### If You Get Stuck on Item 2.2

**STOP. Don't try to fix it with more changes.**

1. Revert Item 2.2 changes: `git checkout -- src/`
2. Review the "CRITICAL PRECAUTIONS" section again
3. Compare your implementation with the exact code in LeftSidebar.tsx
4. Check parameter names match exactly
5. Verify file object references are preserved
6. Ask for help if needed

---

**Created:** 2025-11-01
**Updated:** 2025-11-01 (after failed first attempt)
**Status:** Ready for implementation (revised plan)
