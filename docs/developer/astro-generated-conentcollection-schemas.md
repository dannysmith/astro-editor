# Astro JSON Schema Generation: Comprehensive Model

## Table of Contents

1. [Overview](#overview)
2. [File Structure](#file-structure)
3. [Root Structure](#root-structure)
4. [Type Transformations](#type-transformations)
5. [Advanced Patterns](#advanced-patterns)
6. [Special Astro Features](#special-astro-features)
7. [Edge Cases and Gotchas](#edge-cases-and-gotchas)

## Overview

Astro automatically generates JSON Schema Draft 7 files for each content collection defined in `src/content.config.ts`. These schemas are placed in `.astro/collections/<collection-name>.schema.json` and are used for IDE validation and autocomplete.

**Key Principle**: The generated JSON schemas are NOT a direct 1:1 mapping of Zod schemas. Instead, they represent the **runtime validation requirements** that frontmatter data must satisfy.

## File Structure

Every generated schema follows this consistent structure:

```json
{
  "$ref": "#/definitions/<collection-name>",
  "definitions": {
    "<collection-name>": {
      "type": "object",
      "properties": {
        /* ... */
      },
      "required": [
        /* ... */
      ],
      "additionalProperties": false
    }
  },
  "$schema": "http://json-schema.org/draft-07/schema#"
}
```

### Structure Components

- **Top-level `$ref`**: Always points to `#/definitions/<collection-name>`
- **`definitions` object**: Contains a single definition for the collection
- **Collection definition**: The actual schema for frontmatter validation
- **`$schema`**: Always points to JSON Schema Draft 7

### Special Property

Every collection schema automatically includes a `$schema` property in its properties:

```json
"$schema": {
  "type": "string"
}
```

This allows frontmatter to optionally reference the schema file itself.

## Root Structure

### Required Fields

The `required` array includes ALL fields that:

1. Don't have `.optional()` modifier
2. Don't have `.default()` modifier

```typescript
// Zod
z.object({
  title: z.string(),                    // Required
  subtitle: z.string().optional(),      // Not required
  author: z.string().default("Anon"),   // Not required
})

// JSON Schema
{
  "properties": { /* ... */ },
  "required": ["title"]  // Only title is required
}
```

### Additional Properties

All collection schemas have `"additionalProperties": false`, preventing unknown fields in frontmatter.

## Type Transformations

### Primitive Types

#### Strings

**Basic string**:

```typescript
z.string()
```

```json
{ "type": "string" }
```

**String with validation**:

```typescript
z.string().min(10).max(200)
```

```json
{
  "type": "string",
  "minLength": 10,
  "maxLength": 200
}
```

**String with format (email)**:

```typescript
z.string().email()
```

```json
{
  "type": "string",
  "format": "email"
}
```

**String with format (URL)**:

```typescript
z.string().url()
```

```json
{
  "type": "string",
  "format": "uri"
}
```

**String with default**:

```typescript
z.string().default('Anonymous')
```

```json
{
  "type": "string",
  "default": "Anonymous"
}
```

#### Numbers

**Basic number**:

```typescript
z.number()
```

```json
{ "type": "number" }
```

**Integer**:

```typescript
z.number().int()
```

```json
{ "type": "integer" }
```

**Integer with validation**:

```typescript
z.number().int().positive()
```

```json
{
  "type": "integer",
  "exclusiveMinimum": 0
}
```

**Number with min (inclusive)**:

```typescript
z.number().int().min(0)
```

```json
{
  "type": "integer",
  "minimum": 0
}
```

**Number with default**:

```typescript
z.number().int().min(0).default(0)
```

```json
{
  "type": "integer",
  "minimum": 0,
  "default": 0
}
```

#### Booleans

```typescript
z.boolean()
```

```json
{ "type": "boolean" }
```

```typescript
z.boolean().default(false)
```

```json
{
  "type": "boolean",
  "default": false
}
```

### Date Types

Dates are **ALWAYS** transformed into an `anyOf` union with three possible formats:

```typescript
z.date()
```

```json
{
  "anyOf": [
    {
      "type": "string",
      "format": "date-time"
    },
    {
      "type": "string",
      "format": "date"
    },
    {
      "type": "integer",
      "format": "unix-time"
    }
  ]
}
```

This applies to:

- `z.date()`
- `z.coerce.date()`

**Rationale**: Frontmatter dates can be written in multiple formats (ISO datetime, date-only, or unix timestamp), and Astro will parse them all.

### Enums

Enums become JSON Schema `enum` arrays with the literal values inlined.

**Local constant**:

```typescript
const LOCAL_PRIORITIES = ['low', 'medium', 'high'] as const

z.enum(LOCAL_PRIORITIES)
```

```json
{
  "type": "string",
  "enum": ["low", "medium", "high"]
}
```

**Imported constant**:

```typescript
// constants.ts
export const ARTICLE_STATUSES = ['draft', 'published', 'archived'] as const

// content.config.ts
import { ARTICLE_STATUSES } from './constants'
z.enum(ARTICLE_STATUSES)
```

```json
{
  "type": "string",
  "enum": ["draft", "published", "archived"]
}
```

**Key Insight**: The actual values are resolved and inlined during schema generation. Import statements are followed and constants are evaluated.

### Literal Types

```typescript
z.literal('project')
```

```json
{
  "type": "string",
  "const": "project"
}
```

The `const` keyword means the value must be exactly that string.

### Arrays

**Array of strings**:

```typescript
z.array(z.string())
```

```json
{
  "type": "array",
  "items": {
    "type": "string"
  }
}
```

**Array with length constraints**:

```typescript
z.array(z.string()).min(1).max(5)
```

```json
{
  "type": "array",
  "items": {
    "type": "string"
  },
  "minItems": 1,
  "maxItems": 5
}
```

**Array of objects**:

```typescript
z.array(
  z.object({
    url: z.string().url(),
    title: z.string(),
    description: z.string().optional(),
  })
)
```

```json
{
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "url": {
        "type": "string",
        "format": "uri"
      },
      "title": {
        "type": "string"
      },
      "description": {
        "type": "string"
      }
    },
    "required": ["url", "title"],
    "additionalProperties": false
  }
}
```

### Tuples

Tuples use JSON Schema's tuple validation with `minItems` and `maxItems`:

```typescript
z.tuple([z.number(), z.number()])
```

```json
{
  "type": "array",
  "minItems": 2,
  "maxItems": 2,
  "items": [{ "type": "number" }, { "type": "number" }]
}
```

**Key difference from arrays**: The `items` is an **array** of schemas (one per position) rather than a single schema.

### Nested Objects

```typescript
z.object({
  social: z.object({
    twitter: z.string().optional(),
    github: z.string().optional(),
  }),
})
```

```json
{
  "properties": {
    "social": {
      "type": "object",
      "properties": {
        "twitter": { "type": "string" },
        "github": { "type": "string" }
      },
      "additionalProperties": false
    }
  },
  "required": ["social"]
}
```

**Note**: Even though all fields inside `social` are optional, `social` itself is required (no `.optional()` on the object).

### Records (Key-Value Maps)

```typescript
z.record(z.string())
```

```json
{
  "type": "object",
  "additionalProperties": {
    "type": "string"
  }
}
```

**Important**: Records do NOT have `"additionalProperties": false` because they explicitly allow arbitrary keys.

```typescript
z.record(z.string(), z.number()) // typed keys + values
```

```json
{
  "type": "object",
  "additionalProperties": {
    "type": "number"
  }
}
```

### Union Types

**Simple union of literals**:

```typescript
z.union([z.literal('public'), z.literal('private'), z.literal('internal')])
```

```json
{
  "type": "string",
  "enum": ["public", "private", "internal"]
}
```

**Note**: This is optimized into an enum rather than a literal `anyOf`.

**Union of different types**:

```typescript
z.union([z.string(), z.boolean()])
```

```json
{
  "anyOf": [{ "type": "string" }, { "type": "boolean" }]
}
```

### Discriminated Unions

```typescript
z.discriminatedUnion('platform', [
  z.object({
    platform: z.literal('vercel'),
    projectId: z.string(),
  }),
  z.object({
    platform: z.literal('netlify'),
    siteId: z.string(),
  }),
])
```

```json
{
  "anyOf": [
    {
      "type": "object",
      "properties": {
        "platform": {
          "type": "string",
          "const": "vercel"
        },
        "projectId": {
          "type": "string"
        }
      },
      "required": ["platform", "projectId"],
      "additionalProperties": false
    },
    {
      "type": "object",
      "properties": {
        "platform": {
          "type": "string",
          "const": "netlify"
        },
        "siteId": {
          "type": "string"
        }
      },
      "required": ["platform", "siteId"],
      "additionalProperties": false
    }
  ]
}
```

Each variant becomes a separate object schema in the `anyOf` array.

## Advanced Patterns

### Descriptions

Zod `.describe()` is preserved in the JSON schema:

```typescript
z.string().describe('The main title of the article')
```

```json
{
  "type": "string",
  "description": "The main title of the article",
  "markdownDescription": "The main title of the article"
}
```

**Both fields** are included for compatibility with different editors.

### Refinements and Transforms

**Critical limitation**: Refinements (`.refine()`) and transforms (`.transform()`) are **NOT** preserved in JSON schema because they involve custom JavaScript logic.

```typescript
z.string().transform(val => val.toLowerCase())
```

```json
{
  "type": "string"
}
```

The transform is completely lost in the schema.

```typescript
z.array(z.string())
  .min(1, 'At least one tag is required')
  .refine(
    tags => tags.every(tag => tag.length >= 2),
    'All tags must be at least 2 characters long'
  )
```

```json
{
  "type": "array",
  "items": {
    "type": "string"
  },
  "minItems": 1,
  "errorMessage": {
    "minItems": "At least one tag is required"
  }
}
```

**Observations**:

1. The `.min(1)` constraint IS preserved (`minItems`)
2. The custom `.refine()` is completely lost
3. The error message for `.min()` is preserved in an `errorMessage` object (non-standard JSON Schema extension)

### Reusable Schema Fragments

When you compose schemas using variables:

```typescript
const seoSchema = z.object({
  title: z.string().min(5).max(120),
  description: z.string().min(15).max(160),
})

z.object({
  seo: seoSchema,
})
```

The schema is **inlined** in the JSON output:

```json
{
  "properties": {
    "seo": {
      "type": "object",
      "properties": {
        "title": {
          "type": "string",
          "minLength": 5,
          "maxLength": 120
        },
        "description": {
          "type": "string",
          "minLength": 15,
          "maxLength": 160
        }
      },
      "required": ["title", "description"],
      "additionalProperties": false
    }
  }
}
```

There is **NO reference mechanism** like `$ref` used for reusable fragments—everything is flattened.

## Special Astro Features

### References to Other Collections

```typescript
import { reference } from 'astro:content'

z.object({
  primaryAuthor: reference('authors'),
})
```

```json
{
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
}
```

**Three allowed formats**:

1. A simple string (the entry ID)
2. An object with `id` and `collection`
3. An object with `slug` and `collection`

This flexibility allows different ways to reference entries.

**Array of references**:

```typescript
z.array(reference('blog'))
```

```json
{
  "type": "array",
  "items": {
    "anyOf": [
      { "type": "string" },
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
}
```

### Images

```typescript
import { defineCollection } from 'astro:content'

defineCollection({
  schema: ({ image }) =>
    z.object({
      avatar: image(),
      coverPhoto: image().optional(),
    }),
})
```

```json
{
  "avatar": {
    "type": "string"
  },
  "coverPhoto": {
    "type": "string"
  }
}
```

**Surprise**: Images are represented as simple strings in the JSON schema! This is because frontmatter will contain a file path string, and Astro handles the image processing internally.

### File Loader Collections

Collections using `file()` loader (e.g., for JSON data) have a **different structure**:

```typescript
import { file } from 'astro/loaders'

defineCollection({
  loader: file('src/content/documentation/docs.json'),
  schema: z.object({
    title: z.string(),
    order: z.number(),
  }),
})
```

Generated schema:

```json
{
  "$ref": "#/definitions/documentation",
  "definitions": {
    "documentation": {
      "type": "object",
      "properties": {
        "$schema": {
          "type": "string"
        }
      },
      "additionalProperties": {
        "type": "object",
        "properties": {
          "title": { "type": "string" },
          "order": { "type": "number" }
        },
        "required": ["title", "order"],
        "additionalProperties": false
      }
    }
  }
}
```

**Key difference**: The schema definition uses `"additionalProperties"` with the actual schema, because file-based collections are **keyed objects** where each key is an entry ID.

Structure in JSON:

```json
{
  "entry-1": {
    "title": "...",
    "order": 1
  },
  "entry-2": {
    "title": "...",
    "order": 2
  }
}
```

### Complex Imported Schemas (Starlight)

When using external loaders and schemas (e.g., from `@astrojs/starlight`):

```typescript
import { docsLoader } from '@astrojs/starlight/loaders'
import { docsSchema } from '@astrojs/starlight/schema'

defineCollection({
  loader: docsLoader(),
  schema: docsSchema(),
})
```

The generated schema will contain **all the fields defined by that package's schema**. In Starlight's case, this includes:

- `title` (required)
- `description`
- `editUrl`
- `head`
- `tableOfContents`
- `template`
- `hero`
- `lastUpdated`
- `prev`/`next`
- `sidebar`
- `banner`
- `pagefind`
- `draft`

With complex nested structures and many default values. The schema is fully expanded—no references to the Starlight package remain.

## Edge Cases and Gotchas

### 1. Coercion is Invisible

```typescript
z.coerce.date()
```

```json
{
  "anyOf": [
    { "type": "string", "format": "date-time" },
    { "type": "string", "format": "date" },
    { "type": "integer", "format": "unix-time" }
  ]
}
```

The `.coerce` is implicit—the JSON schema doesn't distinguish between `z.date()` and `z.coerce.date()`.

### 2. Refinements are Lost

Custom validation logic cannot be represented in JSON Schema:

```typescript
z.string().refine(val => val.startsWith('https'), {
  message: 'Must be HTTPS URL',
})
```

```json
{
  "type": "string"
}
```

This means the JSON schema provides **incomplete validation**. Runtime validation (via Astro/Zod) is more strict.

### 3. Error Messages

Some error messages are preserved in a non-standard `errorMessage` field:

```typescript
z.array(z.string()).min(1, 'At least one tag is required')
```

```json
{
  "type": "array",
  "items": { "type": "string" },
  "minItems": 1,
  "errorMessage": {
    "minItems": "At least one tag is required"
  }
}
```

This is NOT part of JSON Schema Draft 7 spec, but some validators support it.

### 4. Default Values from Imports

```typescript
// constants.ts
export const DEFAULT_AUTHOR = 'System'

// content.config.ts
import { DEFAULT_AUTHOR } from './constants'
z.string().default(DEFAULT_AUTHOR)
```

```json
{
  "type": "string",
  "default": "System"
}
```

The actual string value is resolved and inlined.

### 5. Union Optimization

Simple unions of literals are optimized to enums:

```typescript
z.union([z.literal('a'), z.literal('b')])
```

becomes:

```json
{
  "type": "string",
  "enum": ["a", "b"]
}
```

NOT:

```json
{
  "anyOf": [
    { "type": "string", "const": "a" },
    { "type": "string", "const": "b" }
  ]
}
```

### 6. No Definition Reuse

Even though the root uses `$ref` to reference definitions, **nested schemas do not**. Everything is inlined, which can lead to duplication if the same schema is used in multiple places.

## Summary of Transformation Rules

| Zod Type                        | JSON Schema                                                                |
| ------------------------------- | -------------------------------------------------------------------------- |
| `z.string()`                    | `{"type": "string"}`                                                       |
| `z.string().email()`            | `{"type": "string", "format": "email"}`                                    |
| `z.string().url()`              | `{"type": "string", "format": "uri"}`                                      |
| `z.string().min(n).max(m)`      | `{"type": "string", "minLength": n, "maxLength": m}`                       |
| `z.number()`                    | `{"type": "number"}`                                                       |
| `z.number().int()`              | `{"type": "integer"}`                                                      |
| `z.number().positive()`         | `{"type": "...", "exclusiveMinimum": 0}`                                   |
| `z.number().min(n)`             | `{"type": "...", "minimum": n}`                                            |
| `z.boolean()`                   | `{"type": "boolean"}`                                                      |
| `z.date()` or `z.coerce.date()` | `{"anyOf": [date-time, date, unix-time]}`                                  |
| `z.enum([...])`                 | `{"type": "string", "enum": [...]}`                                        |
| `z.literal("x")`                | `{"type": "string", "const": "x"}`                                         |
| `z.array(T)`                    | `{"type": "array", "items": {...}}`                                        |
| `z.tuple([A, B])`               | `{"type": "array", "minItems": 2, "maxItems": 2, "items": [{...}, {...}]}` |
| `z.object({...})`               | `{"type": "object", "properties": {...}, "additionalProperties": false}`   |
| `z.record(T)`                   | `{"type": "object", "additionalProperties": {...}}`                        |
| `z.union([A, B])`               | `{"anyOf": [{...}, {...}]}` (or optimized to enum)                         |
| `z.discriminatedUnion(...)`     | `{"anyOf": [{...}, {...}]}`                                                |
| `reference('collection')`       | `{"anyOf": [string, {id, collection}, {slug, collection}]}`                |
| `image()`                       | `{"type": "string"}`                                                       |
| `.optional()`                   | Field not in `required` array                                              |
| `.default(val)`                 | `{"default": val}` + not in `required` array                               |
| `.describe(text)`               | `{"description": text, "markdownDescription": text}`                       |
| `.transform(fn)`                | **LOST** - no representation                                               |
| `.refine(fn)`                   | **LOST** - no representation                                               |

## Parsing Strategy for Astro Editor

Based on this analysis, here's a recommended parsing strategy:

### 1. Read the Root Structure

```javascript
const schema = JSON.parse(schemaFileContents)
const collectionName = Object.keys(schema.definitions)[0]
const collectionSchema = schema.definitions[collectionName]
```

### 2. Check Collection Type

```javascript
if (
  collectionSchema.additionalProperties &&
  typeof collectionSchema.additionalProperties === 'object'
) {
  // File-based collection (keyed entries)
  const entrySchema = collectionSchema.additionalProperties
} else {
  // Standard collection (markdown files)
  const entrySchema = collectionSchema
}
```

### 3. Extract Fields

```javascript
const properties = entrySchema.properties
const requiredFields = entrySchema.required || []

for (const [fieldName, fieldSchema] of Object.entries(properties)) {
  if (fieldName === '$schema') continue // Skip metadata field

  const isRequired = requiredFields.includes(fieldName)
  const fieldType = determineFieldType(fieldSchema)
  const hasDefault = 'default' in fieldSchema

  // Build UI field...
}
```

### 4. Type Determination Logic

```javascript
function determineFieldType(fieldSchema) {
  // Handle anyOf (dates, references, unions)
  if (fieldSchema.anyOf) {
    if (isDateField(fieldSchema.anyOf)) {
      return { type: 'date' }
    }
    if (isReferenceField(fieldSchema.anyOf)) {
      return { type: 'reference' }
    }
    return { type: 'union', options: fieldSchema.anyOf }
  }

  // Handle enums
  if (fieldSchema.enum) {
    return { type: 'enum', values: fieldSchema.enum }
  }

  // Handle const (literal)
  if (fieldSchema.const) {
    return { type: 'literal', value: fieldSchema.const }
  }

  // Handle arrays
  if (fieldSchema.type === 'array') {
    const itemsSchema = fieldSchema.items
    if (Array.isArray(itemsSchema)) {
      return { type: 'tuple', items: itemsSchema }
    }
    return { type: 'array', itemType: determineFieldType(itemsSchema) }
  }

  // Handle objects
  if (fieldSchema.type === 'object') {
    if (fieldSchema.additionalProperties) {
      return {
        type: 'record',
        valueType: determineFieldType(fieldSchema.additionalProperties),
      }
    }
    return { type: 'object', properties: fieldSchema.properties }
  }

  // Handle primitives
  if (fieldSchema.type === 'string') {
    if (fieldSchema.format === 'email') return { type: 'email' }
    if (fieldSchema.format === 'uri') return { type: 'url' }
    return {
      type: 'string',
      minLength: fieldSchema.minLength,
      maxLength: fieldSchema.maxLength,
    }
  }

  if (fieldSchema.type === 'integer')
    return {
      type: 'integer',
      min: fieldSchema.minimum,
      max: fieldSchema.maximum,
    }
  if (fieldSchema.type === 'number')
    return {
      type: 'number',
      min: fieldSchema.minimum,
      max: fieldSchema.maximum,
    }
  if (fieldSchema.type === 'boolean') return { type: 'boolean' }

  return { type: 'unknown' }
}

function isDateField(anyOfArray) {
  return anyOfArray.some(
    s =>
      s.format === 'date-time' ||
      s.format === 'date' ||
      s.format === 'unix-time'
  )
}

function isReferenceField(anyOfArray) {
  return anyOfArray.some(s => s.type === 'object' && s.properties?.collection)
}
```

### 5. Handle Descriptions

```javascript
const description =
  fieldSchema.description || fieldSchema.markdownDescription || null
```

### 6. Handle Defaults

```javascript
const defaultValue = fieldSchema.default
```

### 7. Nested Objects

Recursively parse object properties:

```javascript
if (fieldType.type === 'object') {
  for (const [propName, propSchema] of Object.entries(fieldType.properties)) {
    const nestedField = determineFieldType(propSchema)
    // Build nested UI...
  }
}
```

## Conclusion

The Astro JSON Schema generation follows predictable patterns with a few important characteristics:

1. **Mostly faithful**: Most Zod validations are preserved (min/max, formats, types)
2. **Lossy for logic**: Custom transforms and refinements are completely lost
3. **Optimized**: Some patterns (union of literals) are optimized to simpler forms
4. **Extended**: Uses non-standard extensions like `errorMessage` for better DX
5. **Flexible for dates**: All date fields support three input formats
6. **Flexible for references**: References can be strings or objects
7. **File-loader different**: Collections using `file()` loader have a different root structure

This documentation should provide everything needed to build a robust parser for Astro's generated JSON schemas.
