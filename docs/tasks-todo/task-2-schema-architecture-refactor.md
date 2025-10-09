# Task: Schema Architecture Refactor - Consolidate Parsing in Rust

**Status:** ⏳ Not Started

**Prerequisites:**
- `docs/tasks-done/task-1-better-schema-parser.md` (Completed)
- `docs/tasks-todo/task-1-better-schema-part-2.md` (Superseded by this task)

---

## Problem Statement

### Current Architecture Issues

**The Problem:** Schema parsing and merging logic is scattered across Rust backend and TypeScript frontend, with business logic incorrectly placed in React components.

**What's Wrong:**

1. **Rust Backend** sends TWO separate schemas to frontend:
   - `collection.schema` - Zod schema JSON (has reference collection names)
   - `collection.json_schema` - Astro JSON schema (has accurate types, missing reference names)

2. **Frontend** has THREE parsers with confusing names:
   - `parseJsonSchema()` - parses Astro JSON (accurate types, NO reference collection names)
   - `parseSchemaJson()` - parses Zod JSON (has reference names, less accurate for complex types)
   - `parseZodSchemaReferences()` - regex-based parser (attempted to extract references, doesn't work because input is JSON not TypeScript)

3. **React Component** (`FrontmatterPanel.tsx`) contains business logic:
   - Hybrid parsing logic
   - Schema merging logic
   - Decision tree for which parser to use
   - **This is architectural violation** - React components should only render, not contain business logic

4. **Immutability Issues:** Attempted to mutate parsed schema objects, but they're frozen/sealed, leading to failed property assignments

### Why This Happened

We incrementally added features without refactoring the architecture:
- Started with Zod-only parsing (Rust)
- Added JSON schema support (TypeScript)
- Tried to merge them in React (wrong layer)
- Hit immutability issues with object mutation
- Added more debug logging instead of fixing root cause

### The Correct Architecture

**Rust Backend Should:**
1. Parse Astro JSON schema (if exists) → accurate type information
2. Parse Zod schema (always available) → reference collection names
3. **MERGE schemas in Rust** → create ONE complete schema with ALL information
4. Return single `complete_schema` field to frontend

**Frontend Should:**
1. Receive complete schema from backend
2. Deserialize into TypeScript types
3. Render fields based on type
4. **No parsing, no merging, no business logic in React**

---

## Proposed Solution

### Architecture Overview

```
┌─────────────────────────────────────┐
│         Rust Backend                │
│  (All parsing & merging happens)    │
├─────────────────────────────────────┤
│                                     │
│  1. Load Astro JSON schema          │
│     (.astro/collections/*.json)     │
│        ↓                            │
│  2. Parse → Get structure & types   │
│        ↓                            │
│  3. Load Zod schema                 │
│     (content.config.ts)             │
│        ↓                            │
│  4. Parse → Get reference names     │
│        ↓                            │
│  5. MERGE → Complete schema         │
│        ↓                            │
│  6. Serialize to JSON               │
│                                     │
└──────────────┬──────────────────────┘
               │
               ↓ (Single complete_schema)
┌─────────────────────────────────────┐
│       TypeScript Frontend           │
│   (Just deserialize & render)       │
├─────────────────────────────────────┤
│                                     │
│  1. Receive complete_schema         │
│        ↓                            │
│  2. Deserialize to SchemaField[]    │
│        ↓                            │
│  3. Render by field.type            │
│     - String → StringField          │
│     - Reference → ReferenceField    │
│     - etc.                          │
│                                     │
└─────────────────────────────────────┘
```

### Key Principle

**The Backend knows about files, the Frontend knows about UI.**

Since schema parsing requires:
- Reading `content.config.ts` from disk
- Reading `.astro/collections/*.schema.json` from disk
- Understanding Astro's schema generation
- Merging data from multiple sources

All of this MUST happen in Rust backend, not scattered across layers.

---

---

## Critical Context for Implementation

### Existing Rust Parser Infrastructure (parser.rs)

**IMPORTANT:** The Rust backend already has reference parsing infrastructure:

```rust
// Line 53: ZodFieldType::Reference stores collection name
pub enum ZodFieldType {
    String,
    Number,
    Boolean,
    Date,
    Array(Box<ZodFieldType>),
    Enum(Vec<String>),
    Union(Vec<ZodFieldType>),
    Literal(String),
    Object(Vec<ZodField>),
    Reference(String), // ✅ Already stores collection name!
    Unknown,
}

// Line 697: Function to extract collection name from Zod schema
fn extract_reference_collection(field_definition: &str) -> String {
    // Extract from reference('collectionName') or reference("collectionName")
    let reference_re = Regex::new(r#"reference\s*\(\s*['"]([^'"]+)['"]\s*\)"#).unwrap();

    if let Some(cap) = reference_re.captures(field_definition) {
        cap.get(1).unwrap().as_str().to_string()
    } else {
        "unknown".to_string()
    }
}

// Line 486: JSON serialization includes reference collection names
ZodFieldType::Reference(collection_name) => {
    field_json["referencedCollection"] = serde_json::json!(collection_name);
}

// Line 497: Array references also tracked
if let ZodFieldType::Reference(collection_name) = &**inner_type {
    field_json["arrayReferenceCollection"] = serde_json::json!(collection_name);
}
```

**Key Insight:** You can leverage the existing `extract_reference_collection()` function when implementing `extract_zod_references()` in the new schema merger module.

### TypeScript JSON Schema Parser Implementation (parseJsonSchema.ts)

The TypeScript parser shows the patterns we need to replicate in Rust:

**1. File-based vs Standard Collections:**
```typescript
// Lines 63-70: Check for file-based collections
if (collectionDef.additionalProperties &&
    typeof collectionDef.additionalProperties === 'object') {
  // File-based collection - use additionalProperties as entry schema
  const entrySchema = collectionDef.additionalProperties
  return parseEntrySchema(entrySchema as JsonSchemaDefinition)
}
```

**2. Reference Detection:**
```typescript
// Lines 306-321: Detects references via anyOf pattern
function extractReferenceInfo(anyOfArray: JsonSchemaProperty[]): {
  isReference: boolean
} {
  for (const s of anyOfArray) {
    const props = s.properties
    if (s.type === 'object' &&
        props?.collection !== undefined &&
        (props?.id !== undefined || props?.slug !== undefined)) {
      // Collection name NOT in JSON schema - must come from Zod
      return { isReference: true }
    }
  }
  return { isReference: false }
}
```

**3. Nested Object Flattening:**
```typescript
// Lines 128-150: Flattens with dot notation
if (fieldType.type === FieldType.Unknown &&
    fieldSchema.type === 'object' &&
    fieldSchema.properties) {
  const nestedFields: SchemaField[] = []
  const nestedRequired = new Set(fieldSchema.required || [])

  for (const [nestedName, nestedSchema] of Object.entries(fieldSchema.properties)) {
    const nestedParsed = parseField(
      nestedName,
      nestedSchema,
      nestedRequired.has(nestedName),
      fullPath  // Passes parent path for dot notation
    )
    nestedFields.push(...nestedParsed)
  }

  return nestedFields
}
```

### Serde Field Naming (CRITICAL)

Rust uses `snake_case`, TypeScript expects `camelCase`. Use serde attributes:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]  // ✅ Add this!
pub struct SchemaField {
    pub name: String,
    pub label: String,

    // Will serialize as "fieldType" not "field_type"
    pub field_type: String,
    pub sub_type: Option<String>,  // Serializes as "subType"

    pub required: bool,
    pub constraints: Option<FieldConstraints>,
    pub description: Option<String>,
    pub default: Option<serde_json::Value>,

    // Will serialize as "enumValues", "referenceCollection", etc.
    pub enum_values: Option<Vec<String>>,
    pub reference_collection: Option<String>,
    pub array_reference_collection: Option<String>,

    pub is_nested: Option<bool>,  // Serializes as "isNested"
    pub parent_path: Option<String>,  // Serializes as "parentPath"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]  // ✅ Add this!
pub struct FieldConstraints {
    pub min: Option<f64>,
    pub max: Option<f64>,
    pub min_length: Option<usize>,  // Serializes as "minLength"
    pub max_length: Option<usize>,  // Serializes as "maxLength"
    pub pattern: Option<String>,
    pub format: Option<String>,
}
```

### Error Handling Strategy

When Rust parsing fails, log detailed errors but gracefully fallback:

```rust
match parse_json_schema(collection_name, json) {
    Ok(schema) => schema,
    Err(e) => {
        warn!(
            "JSON schema parsing failed for {}: {}. Falling back to Zod-only parsing.",
            collection_name, e
        );
        // Log the schema snippet that failed for debugging
        if import.meta.env.DEV {
            warn!("Failed schema snippet: {:?}", &json[..json.len().min(200)]);
        }
        // Return Zod-only fallback
        return parse_zod_schema(collection_name, zod_schema);
    }
}
```

**Never crash the app** - always have a fallback path.

### Astro JSON Schema Patterns to Handle

From `docs/developer/astro-generated-conentcollection-schemas.md`, the Rust parser must handle:

**1. Date Fields (anyOf with 3 formats):**
```json
{
  "anyOf": [
    { "type": "string", "format": "date-time" },
    { "type": "string", "format": "date" },
    { "type": "integer", "format": "unix-time" }
  ]
}
```

**2. Reference Fields (anyOf with 3 possible structures):**
```json
{
  "anyOf": [
    { "type": "string" },  // Simple ID string
    {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "collection": { "type": "string" }
      },
      "required": ["id", "collection"]
    },
    {
      "type": "object",
      "properties": {
        "slug": { "type": "string" },
        "collection": { "type": "string" }
      },
      "required": ["slug", "collection"]
    }
  ]
}
```

**3. Enum Fields:**
```json
{
  "type": "string",
  "enum": ["draft", "published", "archived"]
}
```

**4. Literal Fields:**
```json
{
  "type": "string",
  "const": "blog"
}
```

**5. Arrays:**
```json
{
  "type": "array",
  "items": { "type": "string" },
  "minItems": 1,
  "maxItems": 5
}
```

**6. Nested Objects:**
```json
{
  "type": "object",
  "properties": {
    "title": { "type": "string" },
    "description": { "type": "string" }
  },
  "required": ["title"]
}
```

**7. Discriminated Unions:**
```json
{
  "anyOf": [
    {
      "type": "object",
      "properties": {
        "platform": { "type": "string", "const": "vercel" },
        "projectId": { "type": "string" }
      },
      "required": ["platform", "projectId"]
    },
    {
      "type": "object",
      "properties": {
        "platform": { "type": "string", "const": "netlify" },
        "siteId": { "type": "string" }
      },
      "required": ["platform", "siteId"]
    }
  ]
}
```

### Porting TypeScript JSON Parser to Rust

The `parseJsonSchema.ts` implementation provides the blueprint. Here's how to port it:

**Key Data Structures in Rust:**

```rust
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Deserialize)]
struct AstroJsonSchema {
    #[serde(rename = "$ref")]
    ref_: String,
    definitions: HashMap<String, JsonSchemaDefinition>,
    #[serde(rename = "$schema")]
    schema: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JsonSchemaDefinition {
    #[serde(rename = "type")]
    type_: String,
    properties: Option<HashMap<String, JsonSchemaProperty>>,
    required: Option<Vec<String>>,
    additional_properties: Option<AdditionalProperties>,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum AdditionalProperties {
    Boolean(bool),
    Schema(Box<JsonSchemaDefinition>),
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JsonSchemaProperty {
    #[serde(rename = "type")]
    type_: Option<StringOrArray>,
    format: Option<String>,
    any_of: Option<Vec<JsonSchemaProperty>>,
    #[serde(rename = "enum")]
    enum_: Option<Vec<String>>,
    #[serde(rename = "const")]
    const_: Option<String>,
    items: Option<Box<ItemsType>>,
    properties: Option<HashMap<String, JsonSchemaProperty>>,
    additional_properties: Option<AdditionalProperties>,
    required: Option<Vec<String>>,
    description: Option<String>,
    markdown_description: Option<String>,
    default: Option<serde_json::Value>,
    minimum: Option<f64>,
    maximum: Option<f64>,
    exclusive_minimum: Option<f64>,
    exclusive_maximum: Option<f64>,
    min_length: Option<usize>,
    max_length: Option<usize>,
    min_items: Option<usize>,
    max_items: Option<usize>,
    pattern: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum StringOrArray {
    String(String),
    Array(Vec<String>),
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum ItemsType {
    Single(JsonSchemaProperty),
    Tuple(Vec<JsonSchemaProperty>),
}
```

**Implementation Strategy:**

1. **Start Simple:** Implement primitives first (string, number, boolean)
2. **Add Constraints:** Then add constraint extraction
3. **Add Complex Types:** Arrays, enums, dates
4. **Add References:** anyOf pattern detection
5. **Add Nesting:** Recursive object flattening
6. **Add Edge Cases:** File-based collections, tuples, unions

**Incremental Approach:**

```rust
// Phase 1: Parse basic structure
fn parse_json_schema(
    collection_name: &str,
    json_schema: &str,
) -> Result<SchemaDefinition, String> {
    let schema: AstroJsonSchema = serde_json::from_str(json_schema)
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    // Extract collection definition
    let collection_name_from_ref = schema.ref_.replace("#/definitions/", "");
    let collection_def = schema
        .definitions
        .get(&collection_name_from_ref)
        .ok_or_else(|| format!("Collection definition not found: {}", collection_name))?;

    // Check for file-based collection
    if let Some(AdditionalProperties::Schema(entry_schema)) = &collection_def.additional_properties {
        return parse_entry_schema(collection_name, entry_schema);
    }

    // Standard collection
    parse_entry_schema(collection_name, collection_def)
}

fn parse_entry_schema(
    collection_name: &str,
    entry_schema: &JsonSchemaDefinition,
) -> Result<SchemaDefinition, String> {
    let properties = entry_schema.properties
        .as_ref()
        .ok_or("No properties found")?;

    let required_set: HashSet<String> = entry_schema
        .required
        .as_ref()
        .map(|r| r.iter().cloned().collect())
        .unwrap_or_default();

    let mut fields = Vec::new();

    for (field_name, field_schema) in properties {
        // Skip $schema metadata
        if field_name == "$schema" {
            continue;
        }

        let is_required = required_set.contains(field_name);
        let parsed_fields = parse_field(field_name, field_schema, is_required, "")?;
        fields.extend(parsed_fields);
    }

    Ok(SchemaDefinition {
        collection_name: collection_name.to_string(),
        fields,
    })
}

fn parse_field(
    field_name: &str,
    field_schema: &JsonSchemaProperty,
    is_required: bool,
    parent_path: &str,
) -> Result<Vec<SchemaField>, String> {
    let full_path = if parent_path.is_empty() {
        field_name.to_string()
    } else {
        format!("{}.{}", parent_path, field_name)
    };

    let label = camel_case_to_title_case(field_name);

    // Determine field type
    let field_type_info = determine_field_type(field_schema)?;

    // Handle nested objects - recursively flatten
    if field_type_info.field_type == "unknown" &&
       field_schema.type_.as_ref().map(|t| matches!(t, StringOrArray::String(s) if s == "object")).unwrap_or(false) &&
       field_schema.properties.is_some() {
        // Flatten nested object
        let mut nested_fields = Vec::new();
        let nested_required: HashSet<String> = field_schema
            .required
            .as_ref()
            .map(|r| r.iter().cloned().collect())
            .unwrap_or_default();

        for (nested_name, nested_schema) in field_schema.properties.as_ref().unwrap() {
            let is_nested_required = nested_required.contains(nested_name);
            let parsed = parse_field(nested_name, nested_schema, is_nested_required, &full_path)?;
            nested_fields.extend(parsed);
        }

        return Ok(nested_fields);
    }

    // Extract constraints
    let constraints = extract_constraints(field_schema, &field_type_info.field_type);

    // Build field
    let field = SchemaField {
        name: full_path.clone(),
        label: if !parent_path.is_empty() {
            let parent_label = camel_case_to_title_case(parent_path.split('.').last().unwrap_or(""));
            format!("{} {}", parent_label, label)
        } else {
            label
        },
        field_type: field_type_info.field_type,
        sub_type: field_type_info.sub_type,
        required: is_required && field_schema.default.is_none(),
        constraints,
        description: field_schema.description.clone()
            .or_else(|| field_schema.markdown_description.clone()),
        default: field_schema.default.clone(),
        enum_values: field_type_info.enum_values,
        reference_collection: field_type_info.reference_collection,
        array_reference_collection: field_type_info.array_reference_collection,
        is_nested: if !parent_path.is_empty() { Some(true) } else { None },
        parent_path: if !parent_path.is_empty() { Some(parent_path.to_string()) } else { None },
    };

    Ok(vec![field])
}
```

**TypeScript Reference Points for Porting:**

- Line 44-81 in parseJsonSchema.ts: Top-level parsing logic
- Line 86-111: Entry schema parsing
- Line 116-186: Field parsing with recursion
- Line 191-285: Type determination logic
- Line 290-321: Date and reference detection
- Line 326-380: Constraint extraction

Use these as the blueprint for your Rust implementation.

---

## Implementation Plan

### Phase 1: Rust Backend - Complete Schema Generation

#### Step 1.1: Update Collection Model

**File:** `src-tauri/src/models/collection.rs`

**Changes:**
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Collection {
    pub name: String,
    pub path: PathBuf,

    // DEPRECATED - Remove after migration
    #[serde(skip_serializing_if = "Option::is_none")]
    pub schema: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub json_schema: Option<String>,

    // NEW - Single source of truth
    pub complete_schema: Option<String>, // Serialized SchemaDefinition
}
```

#### Step 1.2: Create Schema Merging Module

**File:** `src-tauri/src/schema_merger.rs` (new file)

**Purpose:** Contains ALL schema parsing and merging logic

**Structure:**
```rust
use serde::{Deserialize, Serialize};

/// Complete schema definition sent to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchemaDefinition {
    pub collection_name: String,
    pub fields: Vec<SchemaField>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchemaField {
    // Identity
    pub name: String,
    pub label: String,

    // Type
    pub field_type: String, // "string", "number", "reference", etc.
    pub sub_type: Option<String>, // For arrays

    // Validation
    pub required: bool,
    pub constraints: Option<FieldConstraints>,

    // Metadata
    pub description: Option<String>,
    pub default: Option<serde_json::Value>,

    // Type-specific
    pub enum_values: Option<Vec<String>>,
    pub reference_collection: Option<String>, // For reference fields
    pub array_reference_collection: Option<String>, // For array of references

    // Nested objects
    pub is_nested: Option<bool>,
    pub parent_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldConstraints {
    pub min: Option<f64>,
    pub max: Option<f64>,
    pub min_length: Option<usize>,
    pub max_length: Option<usize>,
    pub pattern: Option<String>,
    pub format: Option<String>, // "email", "uri", "date-time", "date"
}

/// Parse and merge schemas from all sources
pub fn create_complete_schema(
    collection_name: &str,
    json_schema: Option<&str>,
    zod_schema: Option<&str>,
) -> Result<SchemaDefinition, String> {
    // 1. Try JSON schema first (most accurate for structure)
    if let Some(json) = json_schema {
        if let Ok(mut schema) = parse_json_schema(collection_name, json) {
            // 2. Enhance with Zod reference information
            if let Some(zod) = zod_schema {
                enhance_with_zod_references(&mut schema, zod)?;
            }
            return Ok(schema);
        }
    }

    // 3. Fallback to Zod-only parsing
    if let Some(zod) = zod_schema {
        return parse_zod_schema(collection_name, zod);
    }

    Err("No schema available".to_string())
}

/// Parse Astro JSON schema
fn parse_json_schema(
    collection_name: &str,
    json_schema: &str,
) -> Result<SchemaDefinition, String> {
    // Implementation from parseJsonSchema.ts
    // Convert to Rust, return SchemaDefinition
    todo!()
}

/// Enhance JSON schema with Zod reference collection names
fn enhance_with_zod_references(
    schema: &mut SchemaDefinition,
    zod_schema: &str,
) -> Result<(), String> {
    // Parse Zod schema to extract reference mappings
    let reference_map = extract_zod_references(zod_schema)?;

    // Apply reference collection names to fields
    for field in &mut schema.fields {
        if let Some(collection_name) = reference_map.get(&field.name) {
            match field.field_type.as_str() {
                "reference" => {
                    field.reference_collection = Some(collection_name.clone());
                }
                "array" if field.sub_type.as_deref() == Some("reference") => {
                    field.array_reference_collection = Some(collection_name.clone());
                }
                _ => {}
            }
        }
    }

    Ok(())
}

/// Extract reference field mappings from Zod schema
fn extract_zod_references(zod_schema: &str) -> Result<HashMap<String, String>, String> {
    // Parse the Zod JSON to find referencedCollection fields
    // Return map of field_name -> collection_name
    todo!()
}

/// Parse Zod schema (fallback when JSON schema unavailable)
fn parse_zod_schema(
    collection_name: &str,
    zod_schema: &str,
) -> Result<SchemaDefinition, String> {
    // Use existing parser logic from parser.rs
    // Convert to SchemaDefinition format
    todo!()
}
```

#### Step 1.3: Update Project Scanning

**File:** `src-tauri/src/commands/project.rs`

**Changes in `scan_project_with_content_dir()`:**

```rust
// After loading schemas, create complete schema
for collection in &mut collections {
    let complete_schema = schema_merger::create_complete_schema(
        &collection.name,
        collection.json_schema.as_deref(),
        collection.schema.as_deref(),
    );

    match complete_schema {
        Ok(schema) => {
            let serialized = serde_json::to_string(&schema)
                .map_err(|e| format!("Failed to serialize schema: {}", e))?;
            collection.complete_schema = Some(serialized);
        }
        Err(err) => {
            warn!(
                "Failed to create complete schema for {}: {}",
                collection.name, err
            );
        }
    }
}
```

### Phase 2: Frontend - Simplification

#### Step 2.1: Update TypeScript Schema Types

**File:** `src/lib/schema.ts`

**Changes:**
```typescript
// KEEP: Core interfaces (already match Rust)
export interface SchemaField {
  name: string
  label: string
  type: FieldType
  subType?: FieldType
  required: boolean
  constraints?: FieldConstraints
  description?: string
  default?: unknown
  enumValues?: string[]
  reference?: string
  subReference?: string
  referenceCollection?: string // Backwards compat
  isNested?: boolean
  parentPath?: string
}

export interface FieldConstraints {
  min?: number
  max?: number
  minLength?: number
  maxLength?: number
  pattern?: string
  format?: 'email' | 'uri' | 'date-time' | 'date'
}

export enum FieldType {
  String = 'string',
  Number = 'number',
  Integer = 'integer',
  Boolean = 'boolean',
  Date = 'date',
  Email = 'email',
  URL = 'url',
  Array = 'array',
  Enum = 'enum',
  Reference = 'reference',
  Object = 'object',
  Unknown = 'unknown',
}

// NEW: Simple deserializer for complete schema
export interface CompleteSchema {
  collectionName: string
  fields: SchemaField[]
}

export function deserializeCompleteSchema(
  schemaJson: string
): CompleteSchema | null {
  try {
    const parsed = JSON.parse(schemaJson)

    // Map Rust field types to FieldType enum
    const fields = parsed.fields.map((field: any) => ({
      name: field.name,
      label: field.label,
      type: fieldTypeFromString(field.field_type),
      subType: field.sub_type ? fieldTypeFromString(field.sub_type) : undefined,
      required: field.required,
      constraints: field.constraints,
      description: field.description,
      default: field.default,
      enumValues: field.enum_values,
      reference: field.reference_collection,
      subReference: field.array_reference_collection,
      referenceCollection: field.reference_collection, // Backwards compat
      isNested: field.is_nested,
      parentPath: field.parent_path,
    }))

    return {
      collectionName: parsed.collection_name,
      fields,
    }
  } catch (error) {
    console.error('Failed to deserialize complete schema:', error)
    return null
  }
}

function fieldTypeFromString(typeStr: string): FieldType {
  const typeMap: Record<string, FieldType> = {
    string: FieldType.String,
    number: FieldType.Number,
    integer: FieldType.Integer,
    boolean: FieldType.Boolean,
    date: FieldType.Date,
    email: FieldType.Email,
    url: FieldType.URL,
    array: FieldType.Array,
    enum: FieldType.Enum,
    reference: FieldType.Reference,
    object: FieldType.Object,
    unknown: FieldType.Unknown,
  }
  return typeMap[typeStr] || FieldType.Unknown
}

// REMOVE: All parsing functions
// - parseSchemaJson()
// - zodFieldToSchemaField()
// - convertZodConstraints()
// - zodFieldTypeToFieldType()
// - All Zod-related types and functions
```

#### Step 2.2: Remove Obsolete Files

Delete these files entirely:
- `src/lib/parseZodReferences.ts` - No longer needed
- `src/lib/parseJsonSchema.ts` - Logic moved to Rust

#### Step 2.3: Simplify FrontmatterPanel

**File:** `src/components/frontmatter/FrontmatterPanel.tsx`

**Replace the entire schema useMemo with:**

```typescript
const schema = React.useMemo(() => {
  if (!currentCollection?.complete_schema) return null

  const parsed = deserializeCompleteSchema(currentCollection.complete_schema)

  if (import.meta.env.DEV && parsed) {
    console.log(`[Schema] Loaded complete schema for: ${parsed.collectionName}`)
  }

  return parsed
}, [currentCollection])
```

**Remove:**
- All hybrid parsing logic
- All Zod reference merging logic
- All debug logging for "before/after enhancement"
- Imports for `parseSchemaJson`, `parseJsonSchema`, `parseZodReferences`

**Result:** Component goes from ~120 lines to ~40 lines, no business logic.

### Phase 3: Testing & Migration

#### Step 3.1: Preserve Backwards Compatibility

During migration, support BOTH old and new:

```typescript
const schema = React.useMemo(() => {
  // NEW: Try complete_schema first
  if (currentCollection?.complete_schema) {
    return deserializeCompleteSchema(currentCollection.complete_schema)
  }

  // OLD: Fallback to hybrid parsing (temporary)
  if (currentCollection?.json_schema) {
    const parsed = parseJsonSchema(currentCollection.json_schema)
    if (parsed && currentCollection.schema) {
      const zodSchema = parseSchemaJson(currentCollection.schema)
      // ... merging logic
    }
    return parsed
  }

  return null
}, [currentCollection])
```

Once Rust implementation complete, remove fallback.

#### Step 3.2: Test Cases

**Rust Unit Tests (src-tauri/src/schema_merger.rs):**

Create comprehensive test files:
- `tests/test_json_schema_primitives.rs`
- `tests/test_json_schema_complex_types.rs`
- `tests/test_json_schema_references.rs`
- `tests/test_schema_merging.rs`

Test coverage MUST include ALL patterns from Astro schema doc:

**Primitives & Constraints:**
- [ ] String with minLength/maxLength
- [ ] String with format: email, uri
- [ ] Number with min/max, exclusiveMinimum/exclusiveMaximum
- [ ] Integer detection
- [ ] Boolean
- [ ] Date (anyOf with date-time, date, unix-time)

**Complex Types:**
- [ ] Enum (type: string, enum: [...])
- [ ] Literal (type: string, const: "value")
- [ ] Arrays (simple, with items schema, with minItems/maxItems)
- [ ] Tuples (array with items as array)
- [ ] Nested objects (flatten with dot notation)
- [ ] Records (additionalProperties)
- [ ] Unions (anyOf array - non-reference, non-date)

**References:**
- [ ] Single reference detection (anyOf pattern)
- [ ] Array of references detection
- [ ] Self-references (articles → articles)

**Zod Reference Extraction:**
- [ ] Extract from `reference('collectionName')`
- [ ] Extract from `z.array(reference('collectionName'))`
- [ ] Handle single and double quotes
- [ ] Build correct map of field_name → collection_name

**Schema Merging:**
- [ ] JSON schema alone (no references)
- [ ] JSON + Zod merge (references populated)
- [ ] Single references get `reference_collection`
- [ ] Array references get `array_reference_collection`
- [ ] Fallback to Zod-only when JSON schema missing/malformed

**File-based Collections:**
- [ ] Detect additionalProperties structure
- [ ] Use additionalProperties as entry schema
- [ ] Parse correctly (authors.json example)

**TypeScript Unit Tests:**
- [ ] `deserializeCompleteSchema()` correctly maps all fields
- [ ] Field type enum mapping works
- [ ] snake_case to camelCase conversion works
- [ ] Handles missing optional fields gracefully
- [ ] Preserves all metadata (constraints, description, default, etc.)

**Integration Tests:**
- [ ] Load dummy-astro-project
- [ ] Verify `articles` collection has complete schema
- [ ] Verify `author` field has:
  - `type: FieldType.Reference`
  - `reference: "authors"` or `referenceCollection: "authors"`
  - `required: false`
- [ ] Verify `relatedArticles` field has:
  - `type: FieldType.Array`
  - `subType: FieldType.Reference`
  - `subReference: "articles"`
  - `constraints.maxLength: 3`
- [ ] Verify all field types render correctly in FrontmatterPanel
- [ ] Verify reference dropdowns populate with correct collection data

**Manual Testing:**
- [ ] Open dummy-astro-project in editor
- [ ] Check console for "Loaded complete schema for: articles" message
- [ ] Author dropdown shows:
  - Danny Smith
  - Jane Doe
  - John Developer
- [ ] Related Articles dropdown shows article titles
- [ ] Multi-select works for array references (show badges)
- [ ] Selecting values updates frontmatter correctly
- [ ] Saving values persists to file correctly
- [ ] No errors in console
- [ ] No React warnings about immutability

**Error Handling Tests:**
- [ ] Malformed JSON schema → fallback to Zod
- [ ] Missing JSON schema → fallback to Zod
- [ ] Invalid Zod schema → graceful error
- [ ] Both schemas missing → no crash, render fields as StringField
- [ ] Log warnings in DEV mode, silent in production

### Phase 4: Cleanup & Documentation

#### Step 4.1: Remove Deprecated Code

After migration complete and tested:

**Rust:**
- [ ] Remove `schema` field from Collection model
- [ ] Remove `json_schema` field from Collection model
- [ ] Remove old Zod parsing logic from `parser.rs` (if not used elsewhere)

**TypeScript:**
- [ ] Delete `parseJsonSchema.ts`
- [ ] Delete `parseZodReferences.ts`
- [ ] Remove all Zod parsing from `schema.ts`
- [ ] Remove backwards compatibility fallback from FrontmatterPanel

#### Step 4.2: Update Documentation

**CLAUDE.md:**
- [ ] Remove references to "hybrid parsing"
- [ ] Update schema architecture section
- [ ] Document new single-schema approach
- [ ] Update troubleshooting section

**Architecture Guide:**
- [ ] Add section on schema processing
- [ ] Document Rust-side schema merging
- [ ] Show complete data flow diagram
- [ ] Add decision log entry explaining refactor

**Code Comments:**
- [ ] Add JSDoc to `deserializeCompleteSchema()`
- [ ] Document SchemaField interface thoroughly
- [ ] Add Rust docs to schema_merger module

---

## Reference Information

### Test Data (from Part 2)

The dummy-astro-project has test collections for validation:

**authors.json** (file-based collection):
```json
[
  { "id": "danny-smith", "name": "Danny Smith", "bio": "..." },
  { "id": "jane-doe", "name": "Jane Doe", "bio": "..." },
  { "id": "john-developer", "name": "John Developer", "bio": "..." }
]
```

**articles schema** (has references):
```typescript
author: reference('authors').optional()
relatedArticles: z.array(reference('articles')).max(3).optional()
```

**Test files:**
- `first-article.md` → `author: danny-smith`
- `comprehensive-markdown-test.md` → `author: jane-doe`, `relatedArticles: [first-article]`
- `second-article.md` → `author: john-developer`, `relatedArticles: [first-article, comprehensive-markdown-test]`

### Expected Schema Output

For `articles` collection, `complete_schema` should contain:

```json
{
  "collection_name": "articles",
  "fields": [
    {
      "name": "author",
      "label": "Author",
      "field_type": "reference",
      "required": false,
      "reference_collection": "authors"
    },
    {
      "name": "relatedArticles",
      "label": "Related Articles",
      "field_type": "array",
      "sub_type": "reference",
      "required": false,
      "array_reference_collection": "articles",
      "constraints": {
        "max_length": 3
      }
    }
  ]
}
```

### Astro JSON Schema Limitations

From Part 2, we know Astro's generated schemas don't preserve reference collection names:

```json
"author": {
  "anyOf": [
    { "type": "string" },
    {
      "type": "object",
      "properties": {
        "collection": { "type": "string" }  // ← No const value!
      }
    }
  ]
}
```

This is WHY we need the Zod schema - it has: `"referencedCollection": "authors"`

### Parsing Strategy

1. **JSON Schema** → Detect it's a reference (via anyOf pattern)
2. **Zod Schema** → Get collection name (from `referencedCollection` field)
3. **Merge** → Create complete field with both pieces of info

---

## Success Criteria

### Phase 1 Complete When:
- [ ] Rust can parse JSON schema to SchemaDefinition
- [ ] Rust can extract Zod references
- [ ] Rust can merge them correctly
- [ ] `complete_schema` field populated on Collections
- [ ] All Rust tests pass

### Phase 2 Complete When:
- [ ] Frontend can deserialize complete_schema
- [ ] FrontmatterPanel has no parsing logic
- [ ] FrontmatterPanel has no merging logic
- [ ] Component is <50 lines for schema handling
- [ ] All TypeScript tests pass

### Phase 3 Complete When:
- [ ] Reference dropdowns work correctly
- [ ] Dummy project fully functional
- [ ] No console errors
- [ ] All integration tests pass

### Phase 4 Complete When:
- [ ] Old code removed
- [ ] Documentation updated
- [ ] No deprecated fields in Collection model
- [ ] Code is clean and maintainable

### Overall Success:
- [ ] Single source of truth for schemas (`complete_schema`)
- [ ] All parsing in appropriate layer (Rust backend)
- [ ] React components contain only UI logic
- [ ] Reference fields work perfectly
- [ ] Architecture is clean and maintainable
- [ ] Well documented and tested

---

## Edge Cases & Considerations

### Handled:
- ✅ JSON schema missing → Zod fallback
- ✅ Zod schema missing → JSON-only (references won't have collection names)
- ✅ Both missing → No schema, fields render as StringField
- ✅ Top-level references (single and array)
- ✅ Self-references (articles → articles)
- ✅ File-based collections (authors.json)

### Future Work (Out of Scope):
- ❌ Nested references (seo.author) - requires AST parsing
- ❌ References in array of objects - too complex for regex
- ❌ Transform/refine indication - no UI representation yet
- ❌ Discriminated unions - needs custom UI

---

## Migration Plan

1. **Week 1**: Rust implementation (schema_merger module)
2. **Week 2**: Frontend simplification + backwards compat
3. **Week 3**: Testing + bug fixes
4. **Week 4**: Cleanup + documentation

**Rollback Plan:** If issues discovered, old parsing code remains functional via backwards compatibility until migration complete.

---

**Last Updated:** 2025-10-09
**Status:** ✅ Ready to implement - Comprehensive context added
**Supersedes:** task-1-better-schema-part-2.md (Phase 3)

**Context Additions:**
- Existing Rust parser infrastructure (parser.rs reference extraction)
- TypeScript JSON schema parser implementation details
- Serde field naming strategy (snake_case → camelCase)
- Error handling guidelines
- Comprehensive Astro JSON schema patterns
- Complete porting guide from TypeScript to Rust
- Exhaustive test coverage requirements
