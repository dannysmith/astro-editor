# Task: Schema Support Enhancement - Part 2

**Status:** 🚫 SUPERSEDED by task-2-schema-architecture-refactor.md

**Note:** Phase 3 implementation revealed architectural issues that require a more fundamental refactor. See task-2-schema-architecture-refactor.md for the correct approach.

**Prerequisites:** `docs/tasks-done/task-1-better-schema-parser.md` (Completed)

---

## Overview

Following the initial JSON schema parser implementation, this task enhances field support with a focus on **references, nested objects, and complex arrays**.

### Progress Summary

- ✅ **Phase 1: Type System Unification** - Single `SchemaField` type, all tests passing
- ✅ **Phase 2: Enhanced Field Support** - Nested objects, references (basic), arrays
- 🔄 **Phase 3: Reference Field Fix** - Resolving collection name extraction
- ⏳ **Phase 4: UI Polish** - Production-ready constraints, labels, docs

---

## Current Challenge: Reference Fields

### The Problem

**Astro's JSON schemas don't preserve collection names from `reference('authors')`:**

```json
// Generated JSON schema
"author": {
  "anyOf": [
    { "type": "string" },
    {
      "properties": {
        "collection": { "type": "string" }  // ← No const value!
      }
    }
  ]
}
```

```typescript
// Original Zod schema
author: reference('authors').optional()  // ← Collection name is HERE
```

**Our current parser** (`parseJsonSchema.ts`) looks for `collection.const` but it doesn't exist. Result: `referencedCollection = undefined`.

---

## Solution: Hybrid Schema Parsing

### Strategy

Use **both** JSON and Zod schemas:

1. **JSON Schema**: Detects that a field IS a reference (via anyOf pattern)
2. **Zod Schema**: Extracts WHICH collection is referenced

### Implementation Plan

#### 1. Add Zod Schema Parsing for References

Create `parseZodSchemaReferences(zodSchema: string)` function:

```typescript
/**
 * Parse Zod schema string to extract reference field mappings
 * Returns: Map<fieldName, collectionName>
 */
function parseZodSchemaReferences(zodSchema: string): Map<string, string> {
  const referenceMap = new Map<string, string>()

  // Match patterns like: fieldName: reference('collectionName')
  const singleRefRegex = /(\w+):\s*reference\(['"]([^'"]+)['"]\)/g

  // Match patterns like: fieldName: z.array(reference('collectionName'))
  const arrayRefRegex = /(\w+):\s*z\.array\(reference\(['"]([^'"]+)['"]\)\)/g

  let match
  while ((match = singleRefRegex.exec(zodSchema)) !== null) {
    referenceMap.set(match[1], match[2])
  }

  while ((match = arrayRefRegex.exec(zodSchema)) !== null) {
    referenceMap.set(match[1], match[2])
  }

  return referenceMap
}
```

#### 2. Update FrontmatterPanel Schema Parsing

```typescript
// In FrontmatterPanel.tsx
const schema = React.useMemo(() => {
  if (!currentCollection) return null

  // Try JSON schema first
  if (currentCollection.json_schema) {
    const parsed = parseJsonSchema(currentCollection.json_schema)

    if (parsed && currentCollection.schema) {
      // Enhance with Zod reference info
      const zodRefs = parseZodSchemaReferences(currentCollection.schema)

      // Apply reference collection names from Zod
      parsed.fields.forEach(field => {
        if (field.type === FieldType.Reference && zodRefs.has(field.name)) {
          field.reference = zodRefs.get(field.name)
        }
        if (field.type === FieldType.Array && field.subType === FieldType.Reference && zodRefs.has(field.name)) {
          field.subReference = zodRefs.get(field.name)
        }
      })

      return parsed
    }
  }

  // Fallback to Zod-only parsing
  if (currentCollection.schema) {
    return parseSchemaJson(currentCollection.schema)
  }

  return null
}, [currentCollection])
```

#### 3. Update parseJsonSchema Reference Detection

Keep the anyOf pattern detection but don't rely on collection.const:

```typescript
function extractReferenceInfo(anyOfArray: JsonSchemaProperty[]): {
  isReference: boolean
} {
  for (const s of anyOfArray) {
    const props = s.properties
    if (
      s.type === 'object' &&
      props?.collection !== undefined &&
      (props?.id !== undefined || props?.slug !== undefined)
    ) {
      // We know it's a reference, but don't try to extract collection name
      // That will come from Zod schema
      return { isReference: true }
    }
  }
  return { isReference: false }
}
```

---

## Test Case Setup

We created a minimal test case to diagnose reference behavior:

**Test Collections:**
- `authors.json` - File-based collection with 3 authors (danny-smith, jane-doe, john-developer)
- `articles` - Has `author: reference('authors')` and `relatedArticles: z.array(reference('articles'))`

**Test Data:**
- first-article.md → `author: danny-smith`
- comprehensive-markdown-test.md → `author: jane-doe`, `relatedArticles: [first-article]`
- second-article.md → `author: john-developer`, `relatedArticles: [first-article, comprehensive-markdown-test]`

**Runtime Verification:**
The test project's index.astro successfully renders author names and related articles, confirming the schema works at runtime. The issue is purely in our editor's schema parsing.

---

## Phase 3: Real-World Schema Testing

### Remaining Tasks

- [ ] Implement Zod reference parsing function
- [ ] Update FrontmatterPanel to use hybrid approach
- [ ] Test with dummy project references (authors, relatedArticles)
- [ ] Verify ReferenceField dropdown populates correctly
- [ ] Test with production schemas

### Edge Cases to Test

1. **Nested object references** - `seo.author: reference('authors')`
2. **Optional parent with reference child** - Does it work?
3. **Self-references** - `relatedArticles: z.array(reference('articles'))` ✅ Schema exists
4. **References in arrays of objects** - Complex nested structure

---

## Phase 4: UI Polish & Production Readiness

### 4.1 Constraint Display Enhancement

Improve constraint formatting in `FieldWrapper.tsx`:

```typescript
function formatConstraints(constraints: FieldConstraints): string | null {
  const parts: string[] = []

  if (constraints.minLength && constraints.maxLength) {
    parts.push(`${constraints.minLength}-${constraints.maxLength} characters`)
  } else if (constraints.minLength) {
    parts.push(`Min ${constraints.minLength} characters`)
  } else if (constraints.maxLength) {
    parts.push(`Max ${constraints.maxLength} characters`)
  }

  if (constraints.min !== undefined && constraints.max !== undefined) {
    parts.push(`${constraints.min}-${constraints.max}`)
  } else if (constraints.min !== undefined) {
    parts.push(`Min: ${constraints.min}`)
  } else if (constraints.max !== undefined) {
    parts.push(`Max: ${constraints.max}`)
  }

  if (constraints.format === 'email') parts.push('Must be an email')
  if (constraints.format === 'uri') parts.push('Must be a URL')
  if (constraints.pattern) parts.push(`Pattern: ${constraints.pattern}`)

  return parts.length > 0 ? parts.join(' • ') : null
}
```

### 4.2 Label Improvement for Nested Fields

Improve acronym handling in labels:

```typescript
function improveAcronyms(label: string): string {
  const acronyms = ['SEO', 'URL', 'API', 'HTML', 'CSS', 'JS', 'ID', 'OG']
  let result = label

  acronyms.forEach(acronym => {
    const pattern = new RegExp(`\\b${acronym.charAt(0)}${acronym.slice(1).toLowerCase()}\\b`, 'g')
    result = result.replace(pattern, acronym)
  })

  return result
}
```

### 4.3 Documentation Updates

- [ ] Update CLAUDE.md - remove outdated ZodField references
- [ ] Update architecture-guide.md Schema Parsing section
- [ ] Add JSDoc to SchemaField interface and key functions
- [ ] Document supported field types and limitations

---

## Key Architectural Decisions

### Why Hybrid Approach for References?

- **JSON Schema alone**: Cannot extract collection names (Astro limitation)
- **Zod Schema alone**: Works but less reliable for complex types
- **Hybrid**: Best of both - JSON for structure, Zod for reference metadata

### Implementation Completed (Phase 1 & 2)

**Type System:**
- ✅ Single `SchemaField` interface (no more dual types)
- ✅ ZodField made internal-only for parsing
- ✅ All 425 tests passing

**Field Types Implemented:**
- ✅ Nested objects (flattened with dot notation: `author.name`)
- ✅ References (single + array) - detection works, collection name extraction pending
- ✅ Arrays (string, number, complex fallback to YamlField)
- ✅ Enums, literals, dates, booleans, primitives
- ✅ Visual grouping for nested fields in FrontmatterPanel

**Store Enhancements:**
- ✅ `setNestedValue()`, `getNestedValue()`, `deleteNestedValue()` for dot notation handling

---

## Success Criteria

### Phase 3 Complete When:
- [ ] Reference fields load collection options correctly
- [ ] Both single and array references work
- [ ] Self-references work (articles → articles)
- [ ] Nested object references work
- [ ] Production schemas tested

### Phase 4 Complete When:
- [ ] Constraints display professionally formatted
- [ ] Nested field labels polished (proper acronyms)
- [ ] Documentation complete and accurate
- [ ] No console errors/warnings
- [ ] Production ready

### Overall Success:
- [ ] Works with Starlight schemas
- [ ] Works with complex blog schemas
- [ ] UI is polished and intuitive
- [ ] Backward compatible (Zod fallback works)
- [ ] Well tested and documented

---

## Scope Boundaries

**In Scope:**
- ✅ Type unification
- 🔄 Reference support (collection name extraction pending)
- ✅ Nested object flattening
- ✅ Array handling (strings, numbers, complex)
- ✅ Enums, literals, primitives

**Out of Scope (Future):**
- ❌ Reference autocomplete with fuzzy search
- ❌ Visual object array editor
- ❌ Discriminated union form builder
- ❌ Custom validation UI
- ❌ Transform/refine indication

---

## Implementation Plan (Detailed)

### Current State Analysis

**1. Hybrid Schema Parsing (FrontmatterPanel.tsx):**
```typescript
// Current: Either/or approach
if (json_schema) {
  return parseJsonSchema(json_schema)  // ← Missing reference collection names
}
if (schema) {
  return parseSchemaJson(schema)  // ← Has collection names but less reliable
}
```

**Issue:** No combination of both. JSON schema detects references but lacks collection names.

**2. Reference Format in Frontmatter:**

Astro uses simple string IDs (confirmed working in dev server):
```yaml
# Single reference
author: danny-smith

# Array reference
relatedArticles: [first-article, comprehensive-markdown-test]
```

Our store already handles this correctly:
- Single: `updateFrontmatterField('author', 'danny-smith')`
- Array: `updateFrontmatterField('relatedArticles', ['first-article', 'other-article'])`
- Nested: `updateFrontmatterField('seo.author', 'danny-smith')` → converts to `{ seo: { author: 'danny-smith' } }`

**3. Display Strategy Issues:**

Current ReferenceField (lines 69-74):
```typescript
const title =
  (file.frontmatter?.title as string | undefined) ||
  (file.frontmatter?.name as string | undefined) ||
  file.name
```

**Problem:** Assumes glob collections with `frontmatter` property. File-based collections (like authors.json) have data at root level.

**4. Fields Without Schema:**

Lines 113-142 in FrontmatterPanel show we render frontmatter fields even without schema. If `author` exists in frontmatter but not in schema, it renders as StringField. This is correct behavior - no special reference handling without schema metadata.

### Implementation Steps

#### Step 1: Create Zod Reference Parser (New File)

**File:** `src/lib/parseZodReferences.ts`

```typescript
/**
 * Parse Zod schema string to extract reference field mappings
 *
 * Handles:
 * - Single references: author: reference('authors')
 * - Array references: relatedPosts: z.array(reference('posts'))
 * - Nested references: seo: z.object({ author: reference('authors') })
 */

export interface ReferenceMapping {
  fieldPath: string      // e.g., 'author' or 'seo.author'
  collectionName: string // e.g., 'authors'
  isArray: boolean       // true for array references
}

export function parseZodSchemaReferences(
  zodSchema: string
): ReferenceMapping[] {
  const references: ReferenceMapping[] = []

  // Pattern 1: Simple reference - author: reference('authors')
  const singleRefRegex = /(\w+):\s*reference\(['"]([^'"]+)['"]\)/g

  // Pattern 2: Array reference - posts: z.array(reference('posts'))
  const arrayRefRegex = /(\w+):\s*z\.array\(reference\(['"]([^'"]+)['"]\)\)/g

  let match

  // Extract array references first (more specific pattern)
  while ((match = arrayRefRegex.exec(zodSchema)) !== null) {
    references.push({
      fieldPath: match[1]!,
      collectionName: match[2]!,
      isArray: true,
    })
  }

  // Extract single references (skip if already found as array)
  const arrayFields = new Set(references.map(r => r.fieldPath))
  while ((match = singleRefRegex.exec(zodSchema)) !== null) {
    const fieldPath = match[1]!
    if (!arrayFields.has(fieldPath)) {
      references.push({
        fieldPath,
        collectionName: match[2]!,
        isArray: false,
      })
    }
  }

  return references
}
```

**Limitation:** This won't handle nested references (seo.author) in the initial implementation. The Zod schema string doesn't preserve deep nesting paths in a parseable way. We'll handle top-level references only for Phase 3.

#### Step 2: Simplify JSON Schema Parser

**File:** `src/lib/parseJsonSchema.ts` (Line ~300-323)

**Why:** Current code tries to extract `collectionName` from `props.collection.const`, but this is always `undefined` (Astro doesn't preserve it). This adds dead code complexity.

**Change:** Remove the collectionName extraction logic entirely:

```typescript
function extractReferenceInfo(anyOfArray: JsonSchemaProperty[]): {
  isReference: boolean
} {
  for (const s of anyOfArray) {
    const props = s.properties
    if (
      s.type === 'object' &&
      props?.collection !== undefined &&
      (props?.id !== undefined || props?.slug !== undefined)
    ) {
      // We know it's a reference, collection name will come from Zod
      return { isReference: true }
    }
  }
  return { isReference: false }
}
```

**Result:** Simpler return type, removes dead code. Collection name will come from Zod parsing in Step 3.

#### Step 3: Enhance FrontmatterPanel with Hybrid Approach

**File:** `src/components/frontmatter/FrontmatterPanel.tsx` (Lines 32-73)

Replace the either/or logic with hybrid combination:

```typescript
const schema = React.useMemo(() => {
  if (!currentCollection) return null

  // Try JSON schema first (best for structure)
  if (currentCollection.json_schema) {
    const parsed = parseJsonSchema(currentCollection.json_schema)

    if (parsed) {
      // Enhance with Zod reference metadata if available
      if (currentCollection.schema) {
        const zodRefs = parseZodSchemaReferences(currentCollection.schema)

        // Apply collection names to reference fields
        parsed.fields.forEach(field => {
          const refMapping = zodRefs.find(r => r.fieldPath === field.name)

          if (refMapping) {
            if (refMapping.isArray && field.type === FieldType.Array) {
              // Array reference
              field.subReference = refMapping.collectionName
            } else if (!refMapping.isArray && field.type === FieldType.Reference) {
              // Single reference
              field.reference = refMapping.collectionName
            }
          }
        })
      }

      if (import.meta.env.DEV) {
        console.log(
          `[Schema] Using JSON schema with Zod enhancements for: ${currentCollection.name}`
        )
      }

      return parsed
    }

    // JSON parsing failed, log warning
    if (import.meta.env.DEV) {
      console.warn(
        `[Schema] JSON schema parsing failed for ${currentCollection.name}, falling back to Zod`
      )
    }
  }

  // Fallback: Zod-only parsing
  if (currentCollection.schema) {
    const parsed = parseSchemaJson(currentCollection.schema)
    if (parsed) {
      if (import.meta.env.DEV) {
        console.log(
          `[Schema] Using Zod schema (fallback) for: ${currentCollection.name}`
        )
      }
      return parsed
    }
  }

  return null
}, [currentCollection])
```

#### Step 4: Improve ReferenceField Display Logic

**File:** `src/components/frontmatter/fields/ReferenceField.tsx` (Lines 66-81)

**Why:** Current code only tries `title` and `name`. Need to try more common fields before falling back to filename.

**Display priority order:**
1. `title` - most common display field
2. `name` - second most common
3. `slug` - good for URL-based IDs
4. `id` property - explicit identifier
5. `file.id` - always exists (slug/id)
6. `file.name` - filename as final fallback

```typescript
const options: ReferenceOption[] = React.useMemo(() => {
  if (!files) return []

  return files.map(file => {
    // Try common display fields in priority order
    // Don't search for "any string" - could grab description/bio

    const label =
      // Try frontmatter (glob collections)
      (file.frontmatter?.title as string | undefined) ||
      (file.frontmatter?.name as string | undefined) ||
      (file.frontmatter?.slug as string | undefined) ||
      // Try data property (file collections)
      (file.data?.title as string | undefined) ||
      (file.data?.name as string | undefined) ||
      (file.data?.slug as string | undefined) ||
      // Try root properties
      (file.title as string | undefined) ||
      (file.slug as string | undefined) ||
      // Final fallbacks
      file.id ||        // ID always exists
      file.name ||      // Filename
      'Untitled'

    return {
      value: file.id,   // Always use ID for the value
      label,
    }
  })
}, [files])
```

**Note:** We'll discover the actual structure of file-based collections during Step 5 testing and adjust the fallback chain if needed.

#### Step 5: Verify Backend Support

**Action:** Check if `useCollectionFilesQuery` works for file-based collections.

The authors collection uses `file()` loader. Backend needs to:
1. Detect file-based collections
2. Load and parse JSON
3. Return entries in same format as glob collections

**If backend doesn't support file collections yet:**
- Add to Rust backend to handle `file()` loader
- Parse JSON and return entries with proper structure

#### Step 6: Testing Checklist

1. **Author dropdown (single reference):**
   - [ ] Dropdown shows "Danny Smith", "Jane Doe", "John Developer"
   - [ ] Selecting stores ID: `author: danny-smith`
   - [ ] Display shows selected author name

2. **Related Articles (array reference):**
   - [ ] Dropdown shows article titles
   - [ ] Multi-select works with badges
   - [ ] Stores as array: `relatedArticles: [first-article, ...]`
   - [ ] Respects max constraint (3 items)

3. **Frontmatter without schema:**
   - [ ] `author: some-value` without schema → renders as StringField
   - [ ] No reference behavior without schema ✅

4. **Hybrid parsing:**
   - [ ] JSON schema + Zod works (reference collection names extracted)
   - [ ] Zod-only fallback works
   - [ ] Console logs show which approach used

### Edge Cases & Limitations

**Handled in Phase 3:**
- ✅ Top-level single references
- ✅ Top-level array references
- ✅ Self-references (articles → articles)
- ✅ File-based collections (authors.json)
- ✅ Fields without schema

**Out of Scope (Future):**
- ❌ Nested references (seo.author: reference('authors'))
  - Zod regex can't reliably track nesting context
  - Would need more sophisticated AST parsing
  - Not a common pattern in Astro sites

- ❌ References in array of objects
  - Example: `links: z.array(z.object({ author: reference('authors') }))`
  - Too complex for regex parsing
  - Will render as YamlField (JSON textarea)

### File-Based Collection Display Strategy

**Problem:** We don't know what fields will be in different collections (authors might have `name`, posts might have `title`).

**Solution:** Try common display fields in priority order, but DON'T search for "any string property" (could grab description/bio).

**Fallback hierarchy:**
1. `title` - most common
2. `name` - second most common
3. `slug` - URL-based identifiers
4. `id` property - explicit identifier
5. `file.id` - always exists (slug/id)
6. `file.name` - filename as final fallback

**Try these in multiple locations:**
- `frontmatter.*` (glob collections)
- `data.*` (file collections - if backend exposes this way)
- Direct properties (varies by backend implementation)

**Accept limitation:** Sometimes we'll show IDs or filenames. That's okay - better than crashing or showing a long description field.

### Success Criteria for This Implementation

- [ ] Hybrid parsing works (JSON + Zod combination)
- [ ] Dropdown shows best available label (title, name, slug, or ID/filename as fallback)
- [ ] Related Articles multi-select populates and works correctly
- [ ] Selecting values stores correct IDs/slugs in frontmatter as simple strings/arrays
- [ ] Multi-select works for array references with badge display
- [ ] Fields without schema continue to work as StringField (no regression)
- [ ] All non-reference fields continue working unchanged
- [ ] Console logs show which parsing approach was used (hybrid vs fallback)

---

**Last Updated:** 2025-10-09
**Next Action:** Begin Step 1 - Create Zod reference parser
