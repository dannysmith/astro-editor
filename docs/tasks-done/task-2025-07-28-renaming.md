# Naming Recommendations for Astro Editor

## Executive Summary

After a comprehensive review of the entire Astro Editor codebase (TypeScript and Rust), the project demonstrates strong naming conventions with excellent consistency. The codebase follows established conventions for both languages and maintains clear, descriptive names throughout. Only minor improvements are recommended to enhance consistency in edge cases.

## Specific Recommendations

### 1. TypeScript/JavaScript Recommendations

#### 1.1 Standardize `FileEntry` Interface Properties

**Current Issue:** The `FileEntry` interface uses snake_case for `is_draft` while the rest of the TypeScript codebase uses camelCase.

**Recommendation:** Rename to maintain consistency with TypeScript conventions:

```typescript
// Current
interface FileEntry {
  is_draft: boolean
  // ...
}

// Recommended
interface FileEntry {
  isDraft: boolean
  // ...
}
```

**Impact:** This change would require updates to:

- Type definitions in `src/lib/types.ts`
- Rust bindings that serialize to this type
- Any TypeScript code referencing `is_draft`

#### 1.2 Improve Utility Function Naming

**Current Issue:** The `cn()` function is too abbreviated.

#### 1.3 Consider More Specific Type Names

**Current Issue:** Some types could benefit from additional context.

**Recommendations:**

- `Collection` → `ContentCollection` (more specific to Astro content)
- Consider namespacing related types (e.g., `Editor.Command`, `App.Command`) if distinction becomes important

### 2. Documentation Recommendations

#### 2.1 Document UI Component Naming Exception

**Issue:** The `/components/ui/` directory uses kebab-case files (shadcn/ui convention) while other components use PascalCase files.

**Recommendation:** Add to `docs/developer/architecture-guide.md`:

```markdown
### Component File Naming Conventions

- Custom components: PascalCase files matching export name (e.g., `Layout.tsx`)
- shadcn/ui components: kebab-case files per library convention (e.g., `alert-dialog.tsx`)
  - This exception is accepted to maintain compatibility with shadcn/ui tooling
```

### 3. Code Organization Recommendations

#### 3.1 Extract Magic Strings to Constants

**Issue:** Some values like `'src/content'` appear multiple times.

**Recommendation:** Create a constants file:

```typescript
// src/lib/constants.ts
export const ASTRO_PATHS = {
  CONTENT_DIR: 'src/content',
  CONFIG_FILE: 'src/content/config.ts',
  // ...
} as const
```

## TypeScript Frontend Renaming (`src/`)

### 1. Project Registry Utilities (`src/lib/project-registry/`)

- **File:** `src/lib/project-registry/utils-effective.ts`
- **Current Name:** `utils-effective.ts`
- **Proposed Name:** `effective-settings.ts`
- **Reason:** The current filename is slightly awkward. The file's purpose is to export `useEffectiveSettings` and `getEffectiveSettings`. Renaming it to `effective-settings.ts` more clearly communicates its responsibility of calculating and providing the "effective" (combined global and project-specific) settings.

### 2. Editor Store (`src/store/editorStore.ts`)

- **Function:** `updateCurrentFilePath`
- **Current Name:** `updateCurrentFilePath(newPath: string)`
- **Proposed Name:** `updateCurrentFileAfterRename(newPath: string)`
- **Reason:** The current name is slightly ambiguous. It implies only the path is updated, but the implementation also derives and updates the file's `name` from the new path. This action is specifically used after a file rename operation. The proposed name is more explicit about the function's purpose and context, making its usage in `LeftSidebar.tsx` clearer.

### 3. Type Definitions (`src/types/common.ts`)

- **Type:** `DateFieldName`
- **Current Definition:** `export type DateFieldName = 'pubDate' | 'date' | 'publishedDate' | 'published'`
- **Proposed Change:** Remove this type.
- **Reason:** This type is only used in one place (`LeftSidebar.tsx`) within a sorting function that has since been updated to use a more robust method (`getPublishedDate`) which takes an array of possible date field names derived from `frontmatterMappings`. The `DateFieldName` type is no longer used and can be safely removed to reduce code clutter.
