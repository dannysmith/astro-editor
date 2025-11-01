# High-Value Testing

## Overview

Add tests for critical data flows and improve test organization. This task addresses:
1. **Schema parsing** (0% coverage, single point of failure)
2. **File workflow integration** (query → store → editor data flows)
3. **Test file organization** (split monolithic test files)
4. **Cleanup** (remove orphaned test)

**Total Time:** 1-2 weeks

**Why This Matters:**
- Schema parsing is a critical path with no test coverage
- File workflows are the core user journey
- Better test organization improves maintainability
- Task 1 extracted utilities that are now easier to test

---

## Item 1: Schema Parsing Tests

**Priority:** CRITICAL
**File:** Create `src/lib/schema.test.ts`
**Target:** `src/lib/schema.ts` (currently untested)
**Time:** 2-3 days

### Current State

The `deserializeCompleteSchema` function has **0% test coverage** and is a single point of failure for the entire schema system. It deserializes Rust-generated JSON into TypeScript types.

### Test Cases Required

```typescript
describe('deserializeCompleteSchema', () => {
  describe('Field Type Mapping', () => {
    // Test all FieldType enum values map correctly from Rust strings
    it('should map all field types correctly')
    // string, number, integer, boolean, date, email, url, image, array, enum, reference, object
  })

  describe('Field Properties', () => {
    it('should parse required fields correctly')
    it('should parse optional fields (description, default, enumValues)')
    it('should parse constraints (min, max, minLength, maxLength, pattern, format)')
    it('should parse array subType')
    it('should parse reference and subReference')
    it('should parse nested fields (isNested, parentPath, nestedFields)')
  })

  describe('Error Handling', () => {
    it('should return null for malformed JSON')
    it('should return null for invalid schema structure')
    it('should default unknown types to FieldType.Unknown')
    it('should handle missing optional fields gracefully')
  })

  describe('Edge Cases', () => {
    it('should handle empty fields array')
    it('should handle deeply nested object structures')
    it('should preserve backwards compatibility (referenceCollection)')
  })
})
```

### Implementation Pattern

```typescript
import { describe, it, expect } from 'vitest'
import { deserializeCompleteSchema, FieldType } from './schema'

describe('deserializeCompleteSchema', () => {
  it('should parse basic string field', () => {
    const schemaJson = JSON.stringify({
      collectionName: 'posts',
      fields: [{
        name: 'title',
        label: 'Title',
        fieldType: 'string',
        required: true
      }]
    })

    const result = deserializeCompleteSchema(schemaJson)

    expect(result).toEqual({
      collectionName: 'posts',
      fields: [{
        name: 'title',
        label: 'Title',
        type: FieldType.String,
        required: true,
        referenceCollection: undefined,
        // ... other fields
      }]
    })
  })

  // Add remaining test cases following this pattern
})
```

### Reference Examples

- Pure function testing: `src/lib/editor/markdown/formatting.test.ts`
- Error handling: `src/lib/editor/paste/handlers.test.ts`

### Success Criteria

- [ ] Comprehensive test coverage for all field types
- [ ] Error handling tests for malformed input
- [ ] Edge case coverage for nested structures
- [ ] All tests passing

---

## Item 2: File Workflow Integration Tests

**Priority:** HIGH
**File:** Enhance `src/store/__tests__/storeQueryIntegration.test.ts`
**Current State:** Tests basic store operations, needs complete data flow tests
**Time:** 3-4 days

### Test Suites to Add

#### A. File Loading Workflow

```typescript
describe('File Loading Workflow', () => {
  it('should load file content into store', async () => {
    // 1. Mock Tauri invoke to return file content
    // 2. Call store.openFile(fileEntry)
    // 3. Simulate query success by calling store methods that would be called after query resolves
    // 4. Verify store state matches loaded content
  })

  it('should handle file load errors gracefully', async () => {
    // Mock Tauri error
    // Verify store remains in safe state
  })
})
```

#### B. File Saving Workflow

```typescript
describe('File Saving Workflow', () => {
  it('should save file and mark clean', async () => {
    // 1. Setup: file open, dirty state
    // 2. Call store.saveFile()
    // 3. Verify Tauri invoke called with correct params
    // 4. Verify isDirty reset to false
    // 5. Verify lastSaveTimestamp updated
  })

  it('should not save when not dirty', async () => {
    // Verify saveFile returns early if !isDirty
  })

  it('should preserve imports during save', async () => {
    // Already tested in editorStore.integration.test.ts - verify still passing
  })
})
```

#### C. File Switching Workflow

```typescript
describe('File Switching Workflow', () => {
  it('should clean up state when switching files', () => {
    // 1. Open file A, set content, frontmatter
    // 2. Open file B
    // 3. Verify file A's content not in store
    // 4. Verify clean state for file B
  })

  it('should not leak dirty state between files', () => {
    // 1. Open file A, make dirty
    // 2. Open file B
    // 3. Verify isDirty = false for file B
  })
})
```

### Implementation Notes

- Mock Tauri commands using existing `globalThis.mockTauri` pattern (see existing tests)
- Use fake timers for debouncing tests (already set up in existing integration tests)
- Reference existing integration test setup in `editorStore.integration.test.ts` lines 23-72

### Success Criteria

- [ ] File loading workflow fully tested
- [ ] File saving workflow fully tested
- [ ] File switching workflow fully tested
- [ ] All tests passing
- [ ] No test flakiness (run multiple times to verify)

---

## Item 3: Test New Utilities from Task 1

**Priority:** HIGH
**Time:** 1-2 days

### Utilities to Test

Now that Task 1 extracted these utilities, add comprehensive test coverage:

#### A. Object Utilities (`src/lib/object-utils.test.ts`)

Created in Task 1, Item 2.1. See original task for test cases:
- `setNestedValue` - nested paths, arrays, prototype pollution
- `getNestedValue` - missing paths, arrays
- `deleteNestedValue` - nested deletion, empty parent cleanup

#### B. File Filtering (`src/lib/files/filtering.test.ts`)

Created in Task 1, Item 2.2. Test cases:
- Show all files when `showDrafts` is true
- Filter drafts when `showDrafts` is false
- Handle missing draft mapping
- Handle undefined frontmatter

#### C. File Sorting (`src/lib/files/sorting.test.ts`)

Created in Task 1, Item 2.2. Test cases:
- Sort by date, newest first
- Files without dates go to bottom
- Handle invalid dates
- Handle missing `published` mapping

### Success Criteria

- [ ] All utilities have >90% test coverage
- [ ] Edge cases covered
- [ ] All tests passing

---

## Item 4: Decompose Long Test Files

**Priority:** MEDIUM
**Files:** Multiple test files >300 lines
**Time:** 2-3 days

**Note:** This was Item 8 in the original Task 1, moved here since it's organizational testing work.

### Current Issues

- Monolithic test files with many test cases
- Difficult to find specific tests quickly
- Long scroll distances when debugging
- Test setup duplication across describe blocks

### Proposed Solution

Split by feature/concern and extract shared setup:

**For FrontmatterPanel.test.tsx (552 lines):**
- `FrontmatterPanel.rendering.test.tsx` - Display and layout tests
- `FrontmatterPanel.validation.test.tsx` - Field validation tests
- `FrontmatterPanel.interactions.test.tsx` - User interaction tests
- `FrontmatterPanel.test-helpers.ts` - Shared setup utilities

**For migrations.test.ts (452 lines):**
- `migrations.v1-to-v2.test.ts` - Version 1 to 2 migration tests
- `migrations.v2-to-v3.test.ts` - Version 2 to 3 migration tests
- `migrations.helpers.test.ts` - Shared migration utilities

### Implementation Steps

1. **Analyze test groupings:**
   - Read the test file
   - Identify natural groupings (usually by `describe` blocks)
   - Look for common setup code
   - Decide on split strategy

2. **Create shared test helpers:**
   ```typescript
   // FrontmatterPanel.test-helpers.ts
   export function createMockSchema() {
     return {
       title: z.string(),
       date: z.date().optional(),
       // ...
     }
   }

   export function createMockFile() {
     return {
       slug: 'test-file',
       frontmatter: {
         title: 'Test',
         date: '2025-11-01'
       }
     }
   }

   export function renderFrontmatterPanel(props = {}) {
     const defaultProps = {
       schema: createMockSchema(),
       file: createMockFile(),
       // ...
     }

     return render(
       <FrontmatterPanel {...defaultProps} {...props} />
     )
   }
   ```

3. **Split test files**

4. **Verify test count matches** (before vs after)

5. **Delete original monolithic file**

### Testing Strategy

**Before splitting:**
```bash
# Run tests and capture output
pnpm test FrontmatterPanel > before.txt
pnpm test migrations > before-migrations.txt
```

**After splitting:**
```bash
# Run all split test files
pnpm test FrontmatterPanel > after.txt
pnpm test migrations > after-migrations.txt

# Compare outputs - all tests should still pass
diff before.txt after.txt
diff before-migrations.txt after-migrations.txt
```

**Verification checklist:**
- [ ] All tests from original file are present in split files
- [ ] Test count matches (check test runner output)
- [ ] Coverage reports show same coverage %
- [ ] No duplicate tests
- [ ] Shared setup extracted to helpers
- [ ] Test file names are descriptive

### Expected Benefits

- Faster test file navigation
- Parallel test execution benefits (Vitest can run files in parallel)
- Easier to run focused test suites
- Better test organization and discoverability
- Reduced setup duplication
- Easier to add new tests (clearer where they belong)

### Files to Split (in order of priority)

1. `FrontmatterPanel.test.tsx` (552 lines) - High usage, complex component
2. `migrations.test.ts` (452 lines) - Clear version-based split
3. Any other test files >300 lines (find with):
   ```bash
   find src -name "*.test.ts*" -exec wc -l {} + | sort -rn | head -20
   ```

---

## Item 5: Remove Orphaned Test

**Priority:** LOW
**Time:** 5 minutes

**Delete:** `src/store/sorting.test.ts`

This file tests functions that don't exist in the codebase. The functions were never implemented.

```bash
rm -f src/store/sorting.test.ts
```

---

## Overall Testing Strategy

### Before Starting

```bash
# Establish baseline
pnpm run check:all
pnpm run test:run

# Check current coverage
pnpm run test:coverage
```

### During Implementation

```bash
# Run tests in watch mode while developing
pnpm run test

# Run specific test file
pnpm run test src/lib/schema.test.ts
```

### After Completing

```bash
# Run all tests
pnpm run test:run

# Check coverage improvement
pnpm run test:coverage

# Compare coverage/index.html before vs after

# Run all quality checks
pnpm run check:all
```

---

## Success Criteria

### Task Complete When

- [ ] `src/lib/schema.test.ts` created with comprehensive coverage
- [ ] `storeQueryIntegration.test.ts` enhanced with file workflow tests
- [ ] All utilities from Task 1 have test coverage
- [ ] Long test files decomposed (FrontmatterPanel, migrations)
- [ ] `sorting.test.ts` deleted
- [ ] All tests passing: `pnpm run test:run`
- [ ] Test coverage improved (check `pnpm run test:coverage`)
- [ ] Quality checks pass: `pnpm run check:all`
- [ ] No test flakiness observed

---

## Key Files Reference

**Test utilities:**
- `src/test/mocks/` - Tauri mocks, toast mocks

**Example patterns:**
- `src/store/__tests__/editorStore.integration.test.ts` - Integration test setup
- `src/lib/editor/markdown/formatting.test.ts` - Pure function tests
- `src/lib/editor/paste/handlers.test.ts` - Error handling tests

**Types:**
- `src/types/index.ts` - FileEntry, MarkdownContent, etc.

**Testing Commands:**
```bash
# Run tests in watch mode while developing
pnpm run test

# Run tests once
pnpm run test:run

# Run specific test file
pnpm run test src/lib/schema.test.ts

# Run all quality checks
pnpm run check:all

# Check coverage
pnpm run test:coverage
```

---

## Notes

- **Depends on Task 1:** Utilities extracted in Task 1 need testing here
- **Total effort:** 1-2 weeks
- **Critical for safety:** Schema parsing is untested single point of failure
- **Improves maintainability:** Better test organization helps future development
- **Coverage goal:** Aim for >90% on critical paths (schema parsing, file workflows)

---

**Created:** 2025-11-01
**Status:** Ready for implementation (after Task 1 complete)
