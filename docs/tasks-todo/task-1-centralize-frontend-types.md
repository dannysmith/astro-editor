# Centralize Frontend Types

**Priority**: MEDIUM (if time permits before 1.0.0, otherwise post-1.0.0)
**Effort**: ~2 hours (revised from original estimate)
**Type**: Code organization, maintainability, type safety
**Status**: ✅ Ready for implementation (senior engineer review completed)
**Last updated**: October 31, 2025

---

## Quick Summary

**Status**: Most types are already well-organized! Scope is much smaller than originally planned.

**What's already centralized** ✅:
- Settings types → `src/lib/project-registry/types.ts`
- Schema types → `src/lib/schema.ts`
- UI component types → `src/types/common.ts`

**What still needs work** ⚠️:
- Move 5 domain types (FileEntry, MarkdownContent, Collection, DirectoryInfo, DirectoryScanResult) from stores to `src/types/domain.ts`
- Fix Collection type duplication in FrontmatterPanel.tsx
- Delete `src/store/index.ts` (leftover from previous refactor, now just indirection)
- Update 7+ import statements across query hooks and components

**Key changes since task was written**:
- Settings and schema types were already centralized
- FileEntry has new fields: `extension`, `isDraft`, `last_modified`
- Collection structure completely changed (now uses `complete_schema` string from Rust)
- New MarkdownContent type for parsed YAML from Rust backend
- All types now mirror Rust structs for consistency

---

## Senior Engineer Review Notes

Three key improvements made during final review:

**1. No Re-exports from Other Modules**
- ❌ DON'T: `export type { CompleteSchema } from '../lib/schema'` in types/index.ts
- ✅ DO: Import schema types directly from `@/lib/schema` where they actually live
- **Rationale**: Avoid import indirection; explicit imports make code easier to trace

**2. Delete store/index.ts**
- ❌ DON'T: Keep it as a barrel file re-exporting from types/
- ✅ DO: Delete it entirely; it's leftover from a previous refactor
- **Rationale**: After types move, this file serves no purpose; removing indirection is cleaner

**3. No Unused Type Guards**
- ❌ DON'T: Add `isFileEntry()` type guards "just in case"
- ✅ DO: Follow YAGNI (You Aren't Gonna Need It)
- **Rationale**: No runtime validation needed currently; add when actually required

---

## Problem

Domain types like `FileEntry`, `Collection`, `CollectionSchema`, `Settings`, etc. are currently defined inline in multiple files throughout the codebase. This creates several issues:

1. **Type drift**: Different files may have slightly different definitions or subsets of the same type
2. **Import confusion**: Hard to know where the "canonical" type definition lives
3. **Maintenance burden**: Changing a type requires finding all definitions
4. **Inconsistent field naming**: Without a single source of truth, fields may be named differently
5. **Harder to reason about**: Domain model is scattered across many files

**Evidence from Domain Modeling Review** (⭐⭐⭐):
> "Main recommendation (centralize types) is good but non-urgent"

## Current State

### ✅ Already Centralized

**Good news!** Several type systems are already well-organized:

1. **Settings types** → `src/lib/project-registry/types.ts`:
   - `GlobalSettings`, `ProjectSettings`, `CollectionSettings`
   - `ProjectMetadata`, `ProjectData`, `ProjectRegistry`

2. **Schema types** → `src/lib/schema.ts`:
   - `CompleteSchema`, `SchemaField`, `FieldType`, `FieldConstraints`
   - `deserializeCompleteSchema()` function

3. **UI component types** → `src/types/common.ts`:
   - `FieldProps`, `InputFieldProps`, `SelectFieldProps`
   - Generic form/component helpers

### ⚠️ Still Need Centralization

**FileEntry** - Centralized in store but should be in types/:
```typescript
// Currently: src/store/editorStore.ts (line 177)
export interface FileEntry {
  id: string
  path: string
  name: string
  extension: string
  isDraft: boolean
  collection: string
  last_modified?: number
  frontmatter?: Record<string, unknown>
}
```

**Collection** - **DUPLICATED** (major issue!):
```typescript
// src/store/index.ts (lines 6-10)
export interface Collection {
  name: string
  path: string
  complete_schema?: string // Serialized CompleteSchema from Rust
}

// src/components/frontmatter/FrontmatterPanel.tsx (lines 10-14)
interface Collection {
  name: string
  path: string
  complete_schema?: string
}
```

**MarkdownContent** - New type for Rust YAML data:
```typescript
// Currently: src/store/editorStore.ts (line 188)
export interface MarkdownContent {
  frontmatter: Record<string, unknown>
  content: string
  raw_frontmatter: string
  imports: string
}
```

**Directory navigation types**:
```typescript
// Currently: src/store/index.ts (lines 12-22)
// These mirror Rust structs from src-tauri/src/models/directory_info.rs
export interface DirectoryInfo {
  name: string
  relative_path: string
  full_path: string
}

export interface DirectoryScanResult {
  subdirectories: DirectoryInfo[]
  files: FileEntry[]
}
```

**Issues**:
- Collection defined in TWO places (exact duplication)
- Domain types (FileEntry, MarkdownContent) living in store instead of types/
- Directory types in store/index.ts instead of dedicated types file

## Benefits of Centralization

1. **Single source of truth**: One canonical definition for each domain type
2. **Better IDE support**: Go-to-definition jumps to actual type, not inline definition
3. **Easier refactoring**: Change once, apply everywhere
4. **Type safety**: Catch mismatches between components
5. **Documentation**: Central place to document domain model
6. **Onboarding**: New developers can learn domain model from one file

## Requirements

**Must Have**:
- [ ] Central `src/types/domain.ts` file created
- [ ] Core domain types defined: `FileEntry`, `Collection`, `CollectionSchema`, `Settings`, `Project`
- [ ] All inline type definitions replaced with imports
- [ ] No type errors introduced
- [ ] All existing functionality preserved

**Should Have**:
- [ ] JSDoc comments documenting each type and field
- [ ] Utility types for common patterns (e.g., `Partial<FileEntry>` for drafts)
- [ ] Type guards for runtime validation
- [ ] Clear exports from `src/types/index.ts`

**Nice to Have**:
- [ ] Diagram of type relationships
- [ ] Migration guide for adding new domain types
- [ ] Validation schemas (Zod) alongside TypeScript types

## Core Types to Centralize

### 1. FileEntry (Move from store to types/)

**Current location**: `src/store/editorStore.ts:177`
**Target location**: `src/types/domain.ts`

```typescript
/**
 * Represents a markdown file in an Astro content collection.
 *
 * This type mirrors the Rust FileEntry struct from src-tauri/src/models/file_entry.rs
 * and is returned by Tauri commands like scan_collection_files.
 */
export interface FileEntry {
  /** Unique identifier (relative path from collection root without extension) */
  id: string

  /** Absolute file path */
  path: string

  /** Display name (filename without extension) */
  name: string

  /** File extension ('md' or 'mdx') */
  extension: string

  /** Is this file marked as draft? (from frontmatter or naming convention) */
  isDraft: boolean

  /** Collection this file belongs to */
  collection: string

  /** Unix timestamp of last modification */
  last_modified?: number

  /** Parsed frontmatter data (optional - not always loaded) */
  frontmatter?: Record<string, unknown>
}

/**
 * Type guard to check if an object is a FileEntry
 */
export function isFileEntry(obj: unknown): obj is FileEntry {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'name' in obj &&
    'path' in obj &&
    'extension' in obj &&
    'collection' in obj
  )
}
```

### 2. MarkdownContent (Move from store to types/)

**Current location**: `src/store/editorStore.ts:188`
**Target location**: `src/types/domain.ts`

```typescript
/**
 * Markdown file content with parsed YAML frontmatter.
 *
 * This type mirrors the Rust MarkdownContent struct and is returned
 * by the read_file_content Tauri command.
 */
export interface MarkdownContent {
  /** Parsed frontmatter as key-value pairs */
  frontmatter: Record<string, unknown>

  /** Markdown content (body, without frontmatter) */
  content: string

  /** Raw YAML frontmatter text (between --- delimiters) */
  raw_frontmatter: string

  /** MDX imports at top of file */
  imports: string
}
```

### 3. Collection (Deduplicate - remove from FrontmatterPanel)

**Current locations**:
- `src/store/index.ts:6` (exported)
- `src/components/frontmatter/FrontmatterPanel.tsx:10` (duplicate)

**Target**: Keep in `src/types/domain.ts` only

```typescript
/**
 * Represents an Astro content collection.
 *
 * This type mirrors the Rust Collection struct from src-tauri/src/models/collection.rs
 * Collections are discovered from src/content/config.ts
 */
export interface Collection {
  /** Collection name (e.g., "posts", "docs") */
  name: string

  /** Absolute path to collection directory */
  path: string

  /**
   * Serialized CompleteSchema from Rust backend.
   * Deserialize with deserializeCompleteSchema() from src/lib/schema.ts
   */
  complete_schema?: string
}
```

### 4. Directory Navigation Types (Move from store to types/)

**Current location**: `src/store/index.ts:12-22`
**Target location**: `src/types/domain.ts`

```typescript
/**
 * Directory information for nested collection navigation.
 *
 * Mirrors Rust DirectoryInfo struct from src-tauri/src/models/directory_info.rs
 */
export interface DirectoryInfo {
  /** Directory name only (e.g., "2024") */
  name: string

  /** Path relative to collection root (e.g., "2024/january") */
  relative_path: string

  /** Full filesystem path */
  full_path: string
}

/**
 * Result of scanning a directory within a collection.
 * Used for nested navigation like posts/2024/january/
 */
export interface DirectoryScanResult {
  /** Subdirectories in this directory */
  subdirectories: DirectoryInfo[]

  /** Files in this directory */
  files: FileEntry[]
}
```

### 5. Schema Types (Already centralized ✅)

**Location**: `src/lib/schema.ts`

These are already well-organized:
- `CompleteSchema` - Full schema for a collection
- `SchemaField` - Individual field definition
- `FieldType` - Enum of supported field types
- `FieldConstraints` - Validation constraints

**No changes needed** - keep in `lib/schema.ts` as they're schema-specific logic.

### 6. Settings Types (Already centralized ✅)

**Location**: `src/lib/project-registry/types.ts`

These are already well-organized:
- `GlobalSettings` - App-wide settings
- `ProjectSettings` - Project-level overrides
- `CollectionSettings` - Collection-specific settings
- `ProjectMetadata` - Project registry metadata

**No changes needed** - keep in project-registry module.

## Implementation Plan

**Scope**: Much smaller than originally planned! Most types are already well-organized.

### Phase 1: Create `src/types/domain.ts`

Create the new domain types file with the 5 core domain types:

```typescript
// src/types/domain.ts

/**
 * Domain types for Astro Editor.
 * These types mirror Rust structs from src-tauri/src/models/
 */

// Moved from src/store/editorStore.ts
export interface FileEntry {
  id: string
  path: string
  name: string
  extension: string
  isDraft: boolean
  collection: string
  last_modified?: number
  frontmatter?: Record<string, unknown>
}

export interface MarkdownContent {
  frontmatter: Record<string, unknown>
  content: string
  raw_frontmatter: string
  imports: string
}

// Moved from src/store/index.ts
export interface Collection {
  name: string
  path: string
  complete_schema?: string
}

export interface DirectoryInfo {
  name: string
  relative_path: string
  full_path: string
}

export interface DirectoryScanResult {
  subdirectories: DirectoryInfo[]
  files: FileEntry[]
}
```

**Note**: No type guards added (YAGNI - add them when we actually need runtime validation)

Update `src/types/index.ts` to export domain types:

```typescript
// src/types/index.ts
export * from './common'
export * from './domain'

// That's it! Don't re-export from other modules - import from their actual location
// - For schema types → import from '@/lib/schema'
// - For settings types → import from '@/lib/project-registry/types'
```

### Phase 2: Update Store Files

**editorStore.ts** - Replace type definitions with imports:
```typescript
// Before (lines 177-193)
export interface FileEntry { /* ... */ }
export interface MarkdownContent { /* ... */ }

// After (add at top with other imports)
import type { FileEntry, MarkdownContent } from '../types'
```

**store/index.ts** - DELETE THIS FILE ENTIRELY
- After moving types, this file serves no purpose
- It was created for "backward compatibility" from a previous refactor
- Now it's just indirection - import types from `@/types` directly
- Stores should be imported from their individual files (`editorStore`, `projectStore`, `uiStore`)

**Why delete instead of keeping as barrel file?**
- This is an internal app, not a library - we don't need deep encapsulation
- The three stores are already well-named and easy to import
- Removing indirection makes imports more explicit and easier to trace
- Fewer files to maintain

### Phase 3: Fix Component Duplication

**FrontmatterPanel.tsx** - Remove duplicate Collection type:
```typescript
// Before (lines 10-14)
interface Collection {
  name: string
  path: string
  complete_schema?: string
}

// After (line 10)
import type { Collection } from '@/types'
```

### Phase 4: Update Imports Across Codebase

Since we're deleting `store/index.ts`, update all files importing types from `@/store`:

**Files importing from `@/store`** (found 7 total):

1. `src/hooks/queries/useCollectionFilesQuery.ts:6`
   - Change: `import { FileEntry } from '@/store'` → `import type { FileEntry } from '@/types'`

2. `src/hooks/queries/useDirectoryScanQuery.ts`
   - Change: `import { DirectoryScanResult } from '@/store'` → `import type { DirectoryScanResult } from '@/types'`

3. `src/hooks/queries/useCollectionsQuery.ts`
   - Change: `import { Collection } from '@/store'` → `import type { Collection } from '@/types'`

4. `src/hooks/queries/useFileBasedCollectionQuery.ts`
   - Change: `import { Collection } from '@/store'` → `import type { Collection } from '@/types'`

5. `src/hooks/queries/useFileContentQuery.ts`
   - Change: `import { MarkdownContent } from '@/store'` → `import type { MarkdownContent } from '@/types'`

6. `src/components/layout/FileItem.tsx:4`
   - Change: `import type { FileEntry } from '../../store/editorStore'` → `import type { FileEntry } from '@/types'`

7. Find any other files importing FileEntry, Collection, etc. from store and update them

**Other components/files** to check:
- `src/components/layout/LeftSidebar.tsx` - may import FileEntry
- `src/lib/commands/app-commands.ts` - may import FileEntry
- `src/lib/commands/types.ts` - may import types
- Any test files importing these types

### Phase 5: Validation

```bash
# Check TypeScript compilation
pnpm run type-check

# Run tests
pnpm run test:run

# Full check (includes linting, Rust checks, etc.)
pnpm run check:all
```

Manual testing:
1. Open a project
2. Navigate through collections
3. Open/edit/save a file
4. Switch between files
5. Use frontmatter panel

## Success Criteria

**Core deliverables**:
- [ ] `src/types/domain.ts` created with 5 domain types (FileEntry, MarkdownContent, Collection, DirectoryInfo, DirectoryScanResult)
- [ ] `src/types/index.ts` updated to export from common and domain (no re-exports from other modules)
- [ ] FileEntry and MarkdownContent removed from `src/store/editorStore.ts` (import from types instead)
- [ ] `src/store/index.ts` DELETED entirely (no longer needed)
- [ ] Duplicate Collection type removed from `src/components/frontmatter/FrontmatterPanel.tsx`
- [ ] All 7+ files importing from `@/store` updated to import from `@/types` instead
- [ ] JSDoc comment at top of domain.ts explaining types mirror Rust structs
- [ ] No type guards added (following YAGNI principle)

**Quality gates**:
- [ ] TypeScript compilation succeeds: `pnpm run type-check`
- [ ] All tests pass: `pnpm run test:run`
- [ ] Linting passes: `pnpm run lint`
- [ ] Rust checks pass: `cd src-tauri && cargo check`
- [ ] Full validation: `pnpm run check:all`

**Manual testing**:
- [ ] Can open a project
- [ ] Can navigate collections
- [ ] Can open/edit/save files
- [ ] Frontmatter panel works correctly
- [ ] No console errors

## Risks and Mitigations

### Risk 1: Breaking Changes

**Risk**: Centralizing types might reveal mismatches that break code

**Mitigation**:
- Do this incrementally, file by file
- Run TypeScript compiler after each change
- Keep old inline types alongside imports temporarily
- Test thoroughly before committing

### Risk 2: Import Cycles

**Risk**: Central types file might create circular dependencies

**Mitigation**:
- Keep `types/` pure (no imports from other app code)
- Only define data structures, no logic
- Use type-only imports: `import type { ... }`

### Risk 3: Merge Conflicts

**Risk**: Touching many files increases merge conflict likelihood

**Mitigation**:
- Do this in a single focused PR
- Avoid mixing with other changes
- Communicate with team (N/A for solo project)

## Out of Scope

**Already well-organized (don't move)**:
- Settings types in `src/lib/project-registry/types.ts`
- Schema types in `src/lib/schema.ts`
- UI component types in `src/types/common.ts`

**Intentionally left inline**:
- Component prop interfaces (fine to define locally)
- Query hook return types (keep with hooks)
- Local state types (component-specific)
- Internal store state types (implementation details)

**Future enhancements** (not this task):
- Runtime validation with Zod
- Type guards for all domain types
- Utility types for common patterns
- Auto-generated types from Rust structs

## References

- Domain Modeling Review: `docs/reviews/domain-modeling-review-2025-10-24.md`
- Meta-analysis: `docs/reviews/analyysis-of-reviews.md` (Week 2, item #6)
- Current type usage: Search codebase for `interface FileEntry`, `type Collection`, etc.
- TypeScript Handbook: https://www.typescriptlang.org/docs/handbook/2/everyday-types.html

## Dependencies

**Blocks**: None
**Blocked by**: None
**Related**: All tasks that touch TypeScript code

## Recommendation

**Priority: MEDIUM** - Do this when you have time, but not critical for 1.0.0.

**Good news**: The scope is much smaller than originally planned! Most types are already well-organized.

**What's left**:
- Move 5 domain types from stores to `src/types/domain.ts`
- Fix 1 duplicate (Collection in FrontmatterPanel)
- Delete `src/store/index.ts` (removes unnecessary indirection)
- Update 7+ import statements

**Estimated effort** (revised after senior review):
- Create `src/types/domain.ts`: 30 minutes
- Update editorStore.ts (import types): 10 minutes
- Delete store/index.ts and update imports: 30 minutes
- Fix FrontmatterPanel duplication: 5 minutes
- Update remaining imports: 20 minutes
- Run validation and fix any issues: 25 minutes
- **Total: ~2 hours**

**Benefits**:
- Single source of truth for domain types (no more duplication)
- Clearer separation: types vs. stores vs. schemas
- Removes import indirection (delete store/index.ts)
- Explicit imports make code easier to trace
- Prevents future duplication like the Collection issue

**Trade-offs**:
- Slightly more verbose imports in some places
- But: more explicit is better for maintainability

**ROI**: Medium - Good cleanup that improves code organization without major disruption
