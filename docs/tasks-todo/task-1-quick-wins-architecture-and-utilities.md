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
# Manual: Open command palette (Cmd+K), verify commands work
```

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
# Manual: Open preferences (Cmd+,), change collection settings, verify they apply
```

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

---

### Item 2.2: Extract LeftSidebar Filtering and Sorting

**File:** `src/components/layout/LeftSidebar.tsx` → `src/lib/files/`
**Time:** 3-4 hours
**Risk:** LOW

**Reference:** See original Task 1, Item 5 for full details.

#### Quick Summary

Extract file filtering and sorting logic from LeftSidebar (lines 228-263) to reusable functions:

Create `src/lib/files/filtering.ts`:
```typescript
export function filterFilesByDraft(
  files: FileEntry[],
  showDrafts: boolean,
  mappings: FieldMappings | null
): FileEntry[]
```

Create `src/lib/files/sorting.ts`:
```typescript
export function sortFilesByPublishedDate(
  files: FileEntry[],
  mappings: FieldMappings | null
): FileEntry[]

export function getPublishedDate(
  file: FileEntry,
  mappings: FieldMappings | null
): Date | null
```

#### Implementation

1. Create `src/lib/files/filtering.ts` and `src/lib/files/sorting.ts`
2. Update LeftSidebar.tsx to use new functions
3. Create test files: `filtering.test.ts` and `sorting.test.ts`
4. Export from `src/lib/files/index.ts`

#### Benefits

- Reusable for command palette, search, other file lists
- Testable in isolation
- Easy to add new filter types (tags, categories)

---

## Phase 3: Add Architectural Guardrails (2-3 hours)

Prevent future violations with ESLint rules and documentation.

### Item 3.1: Add ESLint Rule

Update `.eslintrc.cjs`:

```javascript
module.exports = {
  // ... existing config
  rules: {
    // ... existing rules

    // Enforce hooks in /hooks/ directory
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['**/lib/**'],
            message: 'Do not import hooks from /lib/. Hooks must be in /hooks/ directory.',
          }
        ]
      }
    ]
  }
}
```

### Item 3.2: Update Documentation

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

### After Each Phase

```bash
# TypeScript check
pnpm run check:ts

# Run all tests
pnpm run test:run

# Full quality check
pnpm run check:all
```

### Manual Testing Checklist

- [ ] Open command palette (Cmd+K) - verify all commands work
- [ ] Open preferences (Cmd+,) - change collection settings
- [ ] Verify settings apply correctly in editor
- [ ] Test with multiple collections
- [ ] Verify effective settings merge correctly (global + collection)
- [ ] Test file list filtering (show/hide drafts)
- [ ] Test file list sorting (by published date)

---

## Success Criteria

### Task Complete When

- [ ] All hooks moved to `/hooks/` directory
- [ ] Nested value utilities extracted to `lib/object-utils.ts`
- [ ] File filtering/sorting extracted to `lib/files/`
- [ ] ESLint rule prevents future violations
- [ ] Architecture guide and CLAUDE.md updated
- [ ] All TypeScript compiles without errors
- [ ] All tests passing
- [ ] `pnpm run check:all` succeeds
- [ ] Manual testing confirms functionality

---

## Implementation Order

1. **Phase 1 first** - Establishes patterns
2. **Phase 2 second** - Makes code more testable (important for Task 2)
3. **Phase 3 last** - Locks in the patterns

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
- `src/components/layout/LeftSidebar.tsx` (use extracted functions)
- `.eslintrc.cjs` (add rule)
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
- **Low risk:** Mostly file moves and extractions
- **High value:** Establishes patterns, improves testability
- **Enables Task 2:** Extracted utilities are easier to test
- **getState() pattern is fine:** Don't refactor these (7 files use it correctly)

---

**Created:** 2025-11-01
**Status:** Ready for implementation
