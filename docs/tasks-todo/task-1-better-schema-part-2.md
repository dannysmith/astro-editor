# Task: Schema Support Enhancement - Part 2

**Status:** In Progress - Phase 1 Complete ✅, Phase 2 Complete ✅, Testing Phase Started
**Prerequisites:** `docs/tasks-done/task-1-better-schema-parser.md` (Completed)

## Progress Summary

- ✅ **Phase 1: Type System Unification** - Complete (all checks passing)
- ✅ **Phase 2: Enhanced Field Support** - Complete (all stages implemented)
- 🔄 **Phase 3: Real-World Validation** - Started (reference field issue discovered)
- ⏳ **Phase 4: UI Polish** - Pending

## Overview

Following the initial JSON schema parser implementation, this task focuses on:
1. **Type System Unification** - Eliminate dual ZodField/SchemaField types ✅
2. **Enhanced Field Support** - Properly handle references, unions, literals, nested objects
3. **Real-World Validation** - Manual testing with complex production schemas
4. **UI Polish** - Production-ready field rendering and metadata display

---

## Phase 1: Type System Unification (CRITICAL)

**Goal:** Single source of truth for field definitions - only `SchemaField` exists.

### 1.1 Pre-Migration Audit

**Action Items:**
- [ ] List all files using `ZodField` or `SchemaField` (already identified: 19 files, 188 occurrences)
- [ ] Document conversion gaps between `ZodField` → `SchemaField`
- [ ] Identify any Zod-specific constraints not in `FieldConstraints`

**Critical Finding:** The Zod → SchemaField conversion in `FrontmatterPanel.tsx:68-82` **loses constraint metadata**. This must be fixed.

### 1.2 Update Zod Parser Output

**File:** `src/lib/schema.ts`

**Changes:**
```typescript
// Change parseSchemaJson return type
export function parseSchemaJson(schemaJson: string): { fields: SchemaField[] } | null

// Convert ZodField to SchemaField internally
function zodFieldToSchemaField(zodField: ZodField): SchemaField {
  return {
    name: zodField.name,
    label: camelCaseToTitleCase(zodField.name),
    type: zodFieldTypeToFieldType(zodField.type),
    required: !zodField.optional,
    ...(zodField.constraints && {
      constraints: convertZodConstraints(zodField.constraints)
    }),
    ...(zodField.options && { enumValues: zodField.options }),
    ...(zodField.default && { default: zodField.default }),
    ...(zodField.arrayType && {
      subType: zodFieldTypeToFieldType(zodField.arrayType)
    }),
  }
}

// Map ZodFieldType to FieldType
function zodFieldTypeToFieldType(zodType: ZodFieldType): FieldType {
  const typeMap: Record<ZodFieldType, FieldType> = {
    String: FieldType.String,
    Number: FieldType.Number,
    Boolean: FieldType.Boolean,
    Date: FieldType.Date,
    Array: FieldType.Array,
    Enum: FieldType.Enum,
    Union: FieldType.String, // Fallback for V1
    Literal: FieldType.String, // Render as readonly string
    Object: FieldType.Unknown,
    Unknown: FieldType.Unknown,
  }
  return typeMap[zodType] || FieldType.Unknown
}

// Convert ZodFieldConstraints to FieldConstraints
function convertZodConstraints(
  zodConstraints: ZodFieldConstraints
): FieldConstraints {
  const constraints: FieldConstraints = {}

  if (zodConstraints.min !== undefined) constraints.min = zodConstraints.min
  if (zodConstraints.max !== undefined) constraints.max = zodConstraints.max
  if (zodConstraints.minLength !== undefined)
    constraints.minLength = zodConstraints.minLength
  if (zodConstraints.maxLength !== undefined)
    constraints.maxLength = zodConstraints.maxLength
  if (zodConstraints.regex !== undefined)
    constraints.pattern = zodConstraints.regex

  // Handle format constraints
  if (zodConstraints.email) constraints.format = 'email'
  if (zodConstraints.url) constraints.format = 'uri'

  return constraints
}
```

**Action Items:**
- [ ] Implement `zodFieldToSchemaField` converter
- [ ] Implement `zodFieldTypeToFieldType` mapper
- [ ] Implement `convertZodConstraints` converter
- [ ] Update `parseSchemaJson` to return `{ fields: SchemaField[] }`
- [ ] Write tests for conversion logic

### 1.3 Remove ZodField from Component Props

**Files to Update (8 field components):**
- `src/components/frontmatter/fields/StringField.tsx`
- `src/components/frontmatter/fields/TextareaField.tsx`
- `src/components/frontmatter/fields/NumberField.tsx`
- `src/components/frontmatter/fields/BooleanField.tsx`
- `src/components/frontmatter/fields/DateField.tsx`
- `src/components/frontmatter/fields/EnumField.tsx`
- `src/components/frontmatter/fields/ArrayField.tsx`
- `src/components/frontmatter/fields/FrontmatterField.tsx`

**Changes per component:**
```typescript
// Before
import type { ZodField, SchemaField } from '../../../lib/schema'
interface StringFieldProps extends FieldProps {
  field?: ZodField | SchemaField
}

// After
import type { SchemaField } from '../../../lib/schema'
interface StringFieldProps extends FieldProps {
  field?: SchemaField
}
```

**Action Items:**
- [ ] Update imports in all 8 field components
- [ ] Update prop types from `ZodField | SchemaField` → `SchemaField`
- [ ] Remove type guards (`'required' in field`)
- [ ] Update field access (use `field.required` instead of `!field.optional`)

### 1.4 Simplify FrontmatterPanel

**File:** `src/components/frontmatter/FrontmatterPanel.tsx`

**Remove lines 68-82** (manual conversion logic - now handled by parser):
```typescript
// DELETE THIS BLOCK - conversion happens in parseSchemaJson now
return {
  fields: parsed.fields.map(
    field =>
      ({
        name: field.name,
        label: camelCaseToTitleCase(field.name),
        type: field.type.toLowerCase(),
        required: !field.optional,
        ...(field.options && { enumValues: field.options }),
        ...(field.default && { default: field.default }),
      }) as SchemaField
  ),
}
```

**Action Items:**
- [ ] Remove manual ZodField → SchemaField conversion
- [ ] Simplify schema parsing logic
- [ ] Test that both JSON schema and Zod fallback work

### 1.5 Clean Up Legacy Types and Functions

**File:** `src/lib/schema.ts`

**Remove (after Phase 1.4 complete):**
```typescript
// Remove these legacy types
export interface ZodField { /* ... */ }
export interface ZodFieldConstraints { /* ... */ }
export type ZodFieldType = /* ... */

// Remove these helper functions (no longer needed)
export function getInputTypeForZodField(fieldType: ZodFieldType): string
export function getDefaultValueForField(field: ZodField): /* ... */
export function validateFieldValue(field: ZodField, value: unknown): string | null
```

**Keep (for Zod parsing only):**
```typescript
// Internal types for Zod parsing
interface ParsedSchemaJson { /* ... */ }
function isValidParsedSchema(obj: unknown): obj is ParsedSchemaJson { /* ... */ }

// Main parser (now returns SchemaField[])
export function parseSchemaJson(schemaJson: string): { fields: SchemaField[] } | null
```

**Action Items:**
- [ ] Remove `ZodField` interface
- [ ] Remove `ZodFieldConstraints` interface
- [ ] Remove `ZodFieldType` type
- [ ] Remove helper functions
- [ ] Keep internal parsing types and `parseSchemaJson`
- [ ] Update imports across codebase
- [ ] Run TypeScript check: `pnpm run check:types`

### 1.6 Update Tests

**Files:**
- `src/lib/schema.test.ts`
- `src/components/frontmatter/fields/*.test.tsx`

**Action Items:**
- [ ] Update `schema.test.ts` for new `parseSchemaJson` return type
- [ ] Update field component tests to use `SchemaField`
- [ ] Verify all tests pass: `pnpm run test:run`

### Phase 1 Verification Checklist

- ✅ TypeScript compiles without errors (`pnpm run check:types`)
- ✅ All tests pass (`pnpm run test:run`)
- ✅ Both JSON schema and Zod fallback work in dev
- ✅ Constraints preserved through entire pipeline
- ✅ No `ZodField` references remain in codebase
- ✅ Field components render correctly with `SchemaField`
- ✅ Manual testing confirmed working in compiled app

**Result:** Phase 1 complete. Type system unified, all 425 tests passing, all checks green.

---

## Phase 2: Enhanced Field Type Support (REFINED)

**Goal:** Handle nested objects, references, and complex arrays with pragmatic UI/UX.

### Design Decisions

**Arrays Strategy:**
- ✅ Strings: TagInput (current implementation)
- 🔄 Numbers: TagInput with number validation
- 🔄 References: Multi-select combobox (shadcn Command)
- 🔄 Complex types (dates, objects): YAML textarea fallback

**Nested Objects:**
- Visual grouping with section header + left border + indentation
- Dot notation in field names (`author.name`)
- Nested YAML structure in storage

**References:**
- Single: Searchable combobox (shadcn Combobox)
- Array: Multi-select with tag display (shadcn Command)
- Display: Show title from referenced item, store slug

### Stage 2.1: Nested Object Support (~1.5 hrs)

**Goal:** Visual grouping of nested object fields with proper YAML structure preservation.

**Schema Example:**
```typescript
author: z.object({
  name: z.string(),
  email: z.string().email()
})
```

**Target UI:**
```
Title *
[input field]

Author
┃ Name *
┃ [input field]
┃
┃ Email *
┃ [input field]

Description
[textarea]
```

**Implementation:**

1. **Update SchemaField interface** (`src/lib/schema.ts`)
```typescript
export interface SchemaField {
  // ... existing
  nestedFields?: SchemaField[]  // Child fields for object types
  isNested?: boolean            // Is this field nested under a parent?
  parentPath?: string           // e.g., "author" for "author.name"
}
```

2. **Parse nested objects** (`src/lib/parseJsonSchema.ts`)
   - Detect object types in schema
   - Flatten to array with dot notation paths
   - Preserve parent-child relationships

3. **Render nested groups** (`src/components/frontmatter/FrontmatterPanel.tsx`)
   - Group fields by parent path
   - Add section headers (using shadcn Separator)
   - Apply visual indentation + left border

4. **Store handling** (`src/store/editorStore.ts`)
   - Parse dot notation → nested object structure
   - `author.name` → `{ author: { name: value } }`

**Action Items:**
- [ ] Add nested field properties to SchemaField
- [ ] Update parseJsonSchema to flatten nested objects
- [ ] Create NestedFieldGroup component
- [ ] Update store to handle dot notation paths
- [ ] Test with real nested schema

### Stage 2.2: Single Reference Fields (~1 hr)

**Goal:** Searchable combobox for single collection references.

**Schema Example:**
```typescript
author: reference('authors')
```

**Target UI:**
```
Author *
[Search authors... ▼]

When opened:
┌─────────────────────┐
│ Search...           │
├─────────────────────┤
│ John Doe            │
│ Jane Smith          │
│ Bob Johnson         │
└─────────────────────┘
```

**Implementation:**

1. **Add Reference field type** (`src/lib/schema.ts`)
```typescript
enum FieldType {
  // ... existing
  Reference = 'reference',
}

interface SchemaField {
  // ... existing
  reference?: string  // Referenced collection name
}
```

2. **Detect references in parser** (`src/lib/parseJsonSchema.ts`)
   - Extract collection name from reference pattern
   - Set `type: FieldType.Reference` and `reference: 'collectionName'`

3. **Create ReferenceField component** (`src/components/frontmatter/fields/ReferenceField.tsx`)
   - Use shadcn Combobox
   - Load referenced collection files
   - Display title, store slug
   - Clear button if optional

4. **Update field router** (`src/components/frontmatter/fields/FrontmatterField.tsx`)
   - Route FieldType.Reference → ReferenceField

**Action Items:**
- [ ] Add FieldType.Reference enum value
- [ ] Update parseJsonSchema reference detection
- [ ] Create ReferenceField component with Combobox
- [ ] Add to FrontmatterField router
- [ ] Test with single reference schema

### Stage 2.3: Array Reference Fields (~1 hr)

**Goal:** Multi-select interface for array of references.

**Schema Example:**
```typescript
relatedPosts: z.array(reference('posts'))
```

**Target UI:**
```
Related Posts
[+ Add post ▼]

[Understanding React] [×]
[TypeScript Guide] [×]
```

**Implementation:**

1. **Extend SchemaField** (`src/lib/schema.ts`)
```typescript
interface SchemaField {
  // ... existing
  subReference?: string  // For array of references
}
```

2. **Detect array references** (`src/lib/parseJsonSchema.ts`)
   - Check if array items are references
   - Set `type: FieldType.Array`, `subType: FieldType.Reference`, `subReference: 'collectionName'`

3. **Extend ReferenceField for multi-select**
   - Add `multiple` prop
   - Use shadcn Command for search
   - Render selected as removable tags
   - Store as array of slugs

4. **Update field router**
   - Detect array + reference combination
   - Pass to ReferenceField with `multiple={true}`

**Action Items:**
- [ ] Add subReference to SchemaField
- [ ] Update parser for array references
- [ ] Add multi-select mode to ReferenceField
- [ ] Update FrontmatterField router logic
- [ ] Test with array reference schema

### Stage 2.4: Enhanced Array Support (~30 min)

**Goal:** Proper handling of number arrays and complex array fallback.

**Implementation:**

1. **Number array validation** (`src/components/frontmatter/fields/ArrayField.tsx`)
   - Add number parsing/validation
   - Show validation errors for non-numbers

2. **YAML fallback component** (`src/components/frontmatter/fields/YamlField.tsx`)
   - Textarea for complex types
   - "Advanced" label hint
   - Syntax highlighting (optional)

3. **Router logic** (`src/components/frontmatter/fields/FrontmatterField.tsx`)
   - String array → ArrayField
   - Number array → ArrayField with number mode
   - Reference array → ReferenceField multi-select
   - Complex (objects, dates, etc.) → YamlField

**Action Items:**
- [ ] Add number validation to ArrayField
- [ ] Create YamlField component
- [ ] Update FrontmatterField routing logic
- [ ] Test with various array types

### 2.5 Record/Map Type Handling

**Pattern:** `z.record(z.string())` → JSON textarea

**Current State:** Already handled (returns `FieldType.String` in line 234).

**Action Items:**
- [ ] Verify records render as StringField
- [ ] Add "JSON object expected" hint if needed
- [ ] Test with `z.record(z.number())`

### Phase 2 Verification Checklist

- [ ] References show collection name indicator
- [ ] Literals render as readonly fields
- [ ] Unions show type options hint
- [ ] Array of objects render as JSON textarea
- [ ] Records render appropriately
- [ ] All field types have appropriate UI hints

---

## Phase 3: Real-World Schema Testing (Manual)

**Goal:** Validate robustness with production schemas. **User will perform this phase manually.**

### 3.1 Test Collections to Create

Create these test schemas in `test/dummy-astro-project/src/content.config.ts`:

#### Test 1: Nested Objects
```typescript
const blog = defineCollection({
  schema: z.object({
    title: z.string(),
    seo: z.object({
      title: z.string().min(5).max(60).describe("SEO title for search engines"),
      description: z.string().max(160),
      ogImage: image().optional(),
      noIndex: z.boolean().default(false),
    }),
    author: z.object({
      name: z.string(),
      email: z.string().email(),
      bio: z.string().optional(),
    }).optional(),
  })
})
```

**Expected Behavior:**
- Fields flatten: `seo.title`, `seo.description`, `seo.ogImage`, `seo.noIndex`
- Labels: "SEO Title", "SEO Description", "SEO Og Image", "SEO No Index"
- Parent object optional → all nested fields optional
- Constraints preserved (min/max length)
- Descriptions display correctly

#### Test 2: References
```typescript
const articles = defineCollection({
  schema: z.object({
    title: z.string(),
    primaryAuthor: reference('authors'),
    relatedArticles: z.array(reference('articles')).max(5).optional(),
    category: reference('categories').optional(),
  })
})
```

**Expected Behavior:**
- Reference fields show collection name
- Array of references handled
- Max constraint shows (5 items max)
- String input with reference indicator

#### Test 3: Complex Arrays
```typescript
const portfolio = defineCollection({
  schema: z.object({
    title: z.string(),
    tags: z.array(z.string()).min(1).max(10),
    links: z.array(
      z.object({
        url: z.string().url(),
        title: z.string(),
        description: z.string().optional(),
      })
    ).optional(),
  })
})
```

**Expected Behavior:**
- `tags`: Renders as TagInput (current ArrayField)
- `links`: Renders as JSON textarea
- Constraints shown (1-10 tags)

#### Test 4: Unions and Literals
```typescript
const pages = defineCollection({
  schema: z.object({
    title: z.string(),
    template: z.literal('landing'),
    status: z.union([z.literal('draft'), z.literal('published'), z.literal('archived')]),
    visibility: z.enum(['public', 'private', 'internal']),
  })
})
```

**Expected Behavior:**
- `template`: Readonly field showing "landing"
- `status`: Union shows all literal options (or renders as enum)
- `visibility`: Enum dropdown

#### Test 5: Edge Cases
```typescript
const misc = defineCollection({
  schema: z.object({
    title: z.string(),
    metadata: z.record(z.string()).optional(),
    coordinates: z.tuple([z.number(), z.number()]).optional(),
    config: z.object({
      theme: z.enum(['light', 'dark']),
      settings: z.record(z.boolean()),
    }).optional(),
  })
})
```

**Expected Behavior:**
- `metadata`: JSON textarea or string field
- `coordinates`: JSON textarea
- Nested object within nested object flattens correctly
- `config.theme`, `config.settings` render appropriately

### 3.2 Real-World Schema Testing (User Action)

**User will test with:**
1. Personal blog schemas
2. Documentation sites (Starlight)
3. E-commerce/complex sites
4. Any production schemas with known edge cases

**What to Look For:**
- [ ] All fields render with appropriate components
- [ ] No UI layout breaks
- [ ] Descriptions display correctly
- [ ] Constraints visible and accurate
- [ ] Default values work
- [ ] Required/optional indicators correct
- [ ] Nested fields flatten properly
- [ ] Labels are human-readable
- [ ] Save/load cycle preserves all data
- [ ] No console errors or warnings

**Feedback Format:**
```
Schema: [name]
Issue: [description]
Expected: [what should happen]
Actual: [what happened]
Field: [specific field if applicable]
```

### 3.3 Edge Case Scenarios

Test these specific scenarios:

1. **Very deeply nested objects** (3+ levels)
2. **Optional parent with required children**
3. **Mixed nested/flat in same collection**
4. **Large enums** (50+ options)
5. **Very long descriptions** (200+ characters)
6. **Special characters in field names**
7. **Image fields in nested objects**
8. **References in nested objects**
9. **Arrays of enums**
10. **Discriminated unions** (if possible)

### Phase 3 Output

User provides feedback → We iterate and fix issues → Repeat until stable.

---

## Phase 4: UI Polish & Production Readiness

**Goal:** Production-ready feature with polished UX.

### 4.1 Constraint Display Enhancement

**File:** `src/components/frontmatter/fields/FieldWrapper.tsx`

Improve constraint formatting:

```typescript
// Format constraints for display
function formatConstraints(constraints: FieldConstraints): string | null {
  const parts: string[] = []

  if (constraints.minLength !== undefined && constraints.maxLength !== undefined) {
    parts.push(`${constraints.minLength}-${constraints.maxLength} characters`)
  } else if (constraints.minLength !== undefined) {
    parts.push(`Min ${constraints.minLength} characters`)
  } else if (constraints.maxLength !== undefined) {
    parts.push(`Max ${constraints.maxLength} characters`)
  }

  if (constraints.min !== undefined && constraints.max !== undefined) {
    parts.push(`${constraints.min}-${constraints.max}`)
  } else if (constraints.min !== undefined) {
    parts.push(`Min: ${constraints.min}`)
  } else if (constraints.max !== undefined) {
    parts.push(`Max: ${constraints.max}`)
  }

  if (constraints.format === 'email') {
    parts.push('Must be an email')
  } else if (constraints.format === 'uri') {
    parts.push('Must be a URL')
  } else if (constraints.format === 'date' || constraints.format === 'date-time') {
    parts.push('Date format')
  }

  if (constraints.pattern) {
    parts.push(`Pattern: ${constraints.pattern}`)
  }

  return parts.length > 0 ? parts.join(' • ') : null
}
```

**Action Items:**
- [ ] Implement `formatConstraints` helper
- [ ] Update FieldWrapper to use formatted constraints
- [ ] Test with various constraint combinations
- [ ] Ensure readable at all font sizes

### 4.2 Nested Field Label Improvement

**File:** `src/lib/parseJsonSchema.ts`

Improve label generation for acronyms and nested fields:

```typescript
// Improve label generation
function generateNestedLabel(parentPath: string, fieldName: string): string {
  const parentLabel = camelCaseToTitleCase(parentPath.split('.').pop()!)
  const childLabel = camelCaseToTitleCase(fieldName)

  // Improve acronym handling (SEO instead of Seo)
  const improvedParentLabel = improveAcronyms(parentLabel)

  return `${improvedParentLabel} ${childLabel}`
}

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

**Action Items:**
- [ ] Implement acronym improvement
- [ ] Test with common acronyms (SEO, URL, API, etc.)
- [ ] Update tests for new label format

### 4.3 Error Handling & Fallbacks

**File:** `src/lib/parseJsonSchema.ts`

Add better error handling:

```typescript
export function parseJsonSchema(schemaJson: string): { fields: SchemaField[] } | null {
  try {
    const schema = JSON.parse(schemaJson) as AstroJsonSchema

    // Validate schema structure
    if (!schema.$ref || !schema.definitions) {
      if (import.meta.env.DEV) {
        console.warn('[Schema] Invalid JSON schema structure:', {
          hasRef: !!schema.$ref,
          hasDefinitions: !!schema.definitions
        })
      }
      return null
    }

    // ... rest of parsing
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('[Schema] Failed to parse JSON schema:', {
        error: error instanceof Error ? error.message : String(error),
        schemaPreview: schemaJson.slice(0, 100)
      })
    }
    return null
  }
}
```

**Action Items:**
- [ ] Add comprehensive error logging (dev mode only)
- [ ] Validate schema structure before parsing
- [ ] Handle malformed JSON gracefully
- [ ] Test with invalid schemas

### 4.4 Documentation Updates

**Files to Update:**
- `CLAUDE.md`
- `docs/developer/architecture-guide.md`
- JSDoc comments in `schema.ts`, `parseJsonSchema.ts`

**Action Items:**
- [ ] Update `CLAUDE.md` - remove ZodField references
- [ ] Update `architecture-guide.md` Schema Parsing section
- [ ] Add JSDoc to `SchemaField` interface
- [ ] Add JSDoc to `parseJsonSchema` function
- [ ] Document supported field types and limitations
- [ ] Add examples of complex patterns

### 4.5 Performance Check

**Action Items:**
- [ ] Profile schema parsing with large schemas (100+ fields)
- [ ] Check for unnecessary re-renders in field components
- [ ] Verify schema parsing is properly memoized
- [ ] Test with 5+ deeply nested collections

### Phase 4 Verification Checklist

- [ ] Constraints display in readable format
- [ ] Nested labels look professional
- [ ] Error handling is graceful
- [ ] Documentation is accurate and complete
- [ ] Performance is acceptable
- [ ] No console warnings in production
- [ ] Code is clean and well-commented

---

## Critical Review & Notes

### Issues Found During Planning

1. **CRITICAL BUG**: `FrontmatterPanel.tsx:68-82` loses constraint metadata when converting ZodField → SchemaField. This must be fixed in Phase 1.2.

2. **ArrayField Limitation**: Only handles `string[]`, not `object[]`. Phase 2.4 addresses this.

3. **Label Generation**: Current nested labels like "Seo Title" could be improved to "SEO Title". Phase 4.2 addresses this.

### Design Decisions

1. **Why not separate LiteralField component?**
   - Readonly StringField is simpler
   - Avoids component proliferation
   - Easier to maintain

2. **Why JSON textarea for complex arrays?**
   - Building object array editor is complex
   - V1 should focus on common cases
   - Can enhance in future if needed

3. **Why not full union support?**
   - Discriminated unions are complex to render
   - Most unions are simple (string | boolean)
   - String field with hint is good enough for V1

### Scope Boundaries

**In Scope:**
- ✅ Type unification
- ✅ Basic reference support
- ✅ Nested object flattening
- ✅ Array of strings
- ✅ Enums and literals
- ✅ Simple unions (with hints)

**Out of Scope (Future Work):**
- ❌ Reference autocomplete/dropdown
- ❌ Object array editor UI
- ❌ Discriminated union form builder
- ❌ Custom validation UI
- ❌ Transform/refine indication

---

## Success Criteria

### Phase 1 Complete When:
- [ ] No `ZodField` references in codebase
- [ ] All tests pass
- [ ] TypeScript compiles cleanly
- [ ] Both JSON and Zod parsers return `SchemaField[]`
- [ ] Constraints preserved through pipeline

### Phase 2 Complete When:
- [ ] References show collection name
- [ ] Literals render readonly
- [ ] Unions show type hints
- [ ] Complex arrays render appropriately
- [ ] All advanced types have UI indicators

### Phase 3 Complete When:
- [ ] User has tested 5+ real schemas
- [ ] All reported issues fixed
- [ ] No regressions in existing functionality
- [ ] Save/load cycle works perfectly

### Phase 4 Complete When:
- [ ] Constraints display professionally
- [ ] Labels are polished
- [ ] Documentation complete
- [ ] Performance verified
- [ ] Production ready

### Overall Success:
- [ ] Works with Starlight schemas
- [ ] Works with complex blog schemas
- [ ] No console errors/warnings
- [ ] UI is polished and intuitive
- [ ] Backward compatible (Zod fallback works)
- [ ] Well tested and documented

---

## Estimated Effort

- **Phase 1:** 4-6 hours (critical foundation)
- **Phase 2:** 3-4 hours (enhancements)
- **Phase 3:** Variable (user testing + iteration)
- **Phase 4:** 2-3 hours (polish)

**Total:** ~11-16 hours focused development + testing iteration cycles

---

## Next Steps

1. ✅ Review this plan
2. ⏸️  Begin Phase 1.1 (audit)
3. ⏸️  Implement Phase 1.2-1.6 (type unification)
4. ⏸️  Verify Phase 1 complete
5. ⏸️  Implement Phase 2 (enhanced fields)
6. ⏸️  User performs Phase 3 testing
7. ⏸️  Iterate based on feedback
8. ⏸️  Implement Phase 4 (polish)
9. ⏸️  Final verification
10. ⏸️ Ship to production

---

---

## Phase 2 Implementation Status (2025-10-07)

### ✅ Completed

**Stage 2.1: Nested Object Support**
- Added `isNested`, `parentPath`, `nestedFields` to SchemaField interface
- Updated `parseJsonSchema.ts` to flatten nested objects with dot notation
- Implemented visual grouping in FrontmatterPanel (section header + left border + indent)
- Created helper functions in editorStore: `setNestedValue`, `getNestedValue`, `deleteNestedValue`
- Updated all 7 field components to use `getNestedValue`

**Stage 2.2: Single Reference Fields**
- Added `reference` property to SchemaField
- Updated parseJsonSchema to detect and extract collection names from reference patterns
- Created ReferenceField.tsx using shadcn Combobox (Command + Popover)
- Loads referenced collection files via TanStack Query
- Displays titles from frontmatter, stores slugs
- Updated FrontmatterField router

**Stage 2.3: Array Reference Fields**
- Added `subReference` property to SchemaField for array items
- Updated parser to detect `array(reference('collection'))`
- Enhanced ReferenceField with multi-select mode (badge display, keep-open behavior)
- Updated FrontmatterField router with proper detection

**Stage 2.4: Enhanced Array Support**
- Updated ArrayField to handle number arrays (auto-conversion between numbers and strings)
- Created YamlField.tsx for complex array types (JSON textarea with validation)
- Updated FrontmatterField routing: array references → complex arrays → string/number arrays

**TypeScript Compilation:** ✅ All code compiles successfully

---

## 🐛 Issue Discovered During Testing (2025-10-07)

### Problem: Reference Fields Not Loading Options

**Symptoms:**
- Reference field shows empty dropdown
- No items found when clicking field
- Collection name is correct in schema: `primaryAuthor: reference('authors')`
- Authors collection exists and has files
- No console errors logged

**Schema Structure (Astro JSON Schema):**
```json
"primaryAuthor": {
  "anyOf": [
    {
      "type": "string"
    },
    {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "collection": { "type": "string" }
      },
      "required": ["id", "collection"],
      "additionalProperties": false
    },
    {
      "type": "object",
      "properties": {
        "slug": { "type": "string" },
        "collection": { "type": "string" }
      },
      "required": ["slug", "collection"],
      "additionalProperties": false
    }
  ]
}
```

**Root Cause Analysis Needed:**

The `collection` property in the JSON schema is `{ "type": "string" }` without a `const` value. This means:
- Astro's JSON schema generation doesn't preserve `reference('authors')` collection name
- Our parser's `extractReferenceInfo()` function looks for `collection.const` but finds nothing
- Result: `referencedCollection = undefined`

**Questions for Next Session:**

1. **Check full schema definition:**
   - Is there a `const` value for collection ANYWHERE in the `primaryAuthor` field definition?
   - Paste the complete `definitions.blog` object to see if collection name is preserved elsewhere

2. **Alternative schema sources:**
   - Does the Zod schema preserve the collection name in a parseable way?
   - Could we add a fallback to parse the raw `src/content/config.ts` file?

3. **Potential solutions:**
   - Parse collection name from Zod schema as fallback (`/reference\('([^']+)'\)/`)
   - Store collection mappings in generated schema metadata
   - Add field descriptions that include collection name
   - Different schema generation approach that preserves references

**Debugging Added:**
- Added console logging to ReferenceField showing:
  - What collection name it's looking for
  - What collections are available
  - Whether collection was found
- Added better empty state messaging in dropdown

**Next Steps:**
1. User to check browser console for debug logs
2. User to paste full schema definition for `primaryAuthor` field
3. Investigate if Zod schema has the collection name
4. Implement fix based on findings

---

**Last Updated:** 2025-10-07
**Document Version:** 1.1 (Added Phase 2 completion + reference field issue)
