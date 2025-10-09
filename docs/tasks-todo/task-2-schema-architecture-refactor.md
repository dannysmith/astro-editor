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
**Status:** ⏳ Phase 3 Complete - Awaiting Manual Verification
**Supersedes:** task-1-better-schema-part-2.md (Phase 3)

**Context Additions:**
- Existing Rust parser infrastructure (parser.rs reference extraction)
- TypeScript JSON schema parser implementation details
- Serde field naming strategy (snake_case → camelCase)
- Error handling guidelines
- Comprehensive Astro JSON schema patterns
- Complete porting guide from TypeScript to Rust
- Exhaustive test coverage requirements

---

## PHASE 4 CLEANUP CHECKLIST - EXECUTE AFTER MANUAL VERIFICATION

> ⚠️ **IMPORTANT**: Only execute Phase 4 cleanup AFTER you have:
> 1. Run the dev server and tested with dummy-astro-project
> 2. Verified reference dropdowns work correctly
> 3. Verified schema parsing works for all collections
> 4. Verified no console errors
> 5. Tested in production-like environment

### What We Kept for Backward Compatibility (Phase 3)

During Phase 3 implementation, we intentionally kept the following code for backward compatibility:

**TypeScript Files:**
- ✅ `src/lib/parseJsonSchema.ts` - OLD JSON schema parser (kept for fallback)
- ✅ `src/lib/parseZodReferences.ts` - OLD Zod reference parser (kept for fallback)
- ✅ `src/lib/schema.ts` - Contains old Zod parsing functions (kept for fallback)
- ✅ `src/components/frontmatter/FrontmatterPanel.tsx` - Contains hybrid parsing fallback logic

**Rust Fields:**
- ✅ `Collection.schema` field - OLD Zod schema JSON (kept for fallback)
- ✅ `Collection.json_schema` field - OLD Astro JSON schema (kept for fallback)

**These MUST be removed in Phase 4 to complete the refactor.**

---

### Step-by-Step Phase 4 Removal Instructions

#### Pre-Removal Verification

Before removing ANY code, verify complete_schema is working:

```bash
# 1. Start dev server
pnpm run dev

# 2. Open dummy-astro-project
# 3. Check browser console for this message:
#    "[Schema] Loaded complete schema for: articles"
#
# 4. If you see "[Schema] Using fallback hybrid parsing for: articles"
#    DO NOT PROCEED WITH CLEANUP - The new system is not working yet!

# 5. Test all reference fields work:
#    - Author dropdown shows 3 authors
#    - Related Articles multi-select works
#    - Saving and loading works correctly

# 6. Only proceed if you see ONLY complete_schema being used
```

#### 1. Remove TypeScript Files

**Delete entire files:**

```bash
# Navigate to project root
cd /Users/danny/dev/astro-editor

# Remove old parser files
rm -f src/lib/parseJsonSchema.ts
rm -f src/lib/parseJsonSchema.test.ts
rm -f src/lib/parseZodReferences.ts

# Verify deletion
git status
```

**Expected git status:**
```
deleted:    src/lib/parseJsonSchema.ts
deleted:    src/lib/parseJsonSchema.test.ts
deleted:    src/lib/parseZodReferences.ts
```

#### 2. Clean Up schema.ts

**File:** `src/lib/schema.ts`

**Remove these sections:**

**A. Remove Zod-related type definitions (lines ~3-63):**
```typescript
// DELETE THIS ENTIRE BLOCK:
// Legacy Zod-based interfaces (for fallback parsing only)
interface ZodField {
  name: string
  type: ZodFieldType
  optional: boolean
  // ... rest of interface
}

interface ZodFieldConstraints {
  // ... entire interface
}

type ZodFieldType =
  | 'String'
  | 'Number'
  // ... rest of type
```

**B. Remove conversion helper functions:**
```typescript
// DELETE THESE FUNCTIONS:
function zodFieldTypeToFieldType(zodType: ZodFieldType): FieldType { ... }
function convertZodConstraints(zodConstraints: ZodFieldConstraints): FieldConstraints | undefined { ... }
function zodFieldToSchemaField(zodField: ZodField): SchemaField { ... }
```

**C. Remove parseSchemaJson function:**
```typescript
// DELETE THIS ENTIRE FUNCTION (lines ~230-283):
export function parseSchemaJson(
  schemaJson: string
): { fields: SchemaField[] } | null {
  // ... entire function body
}

// DELETE THIS HELPER FUNCTION TOO:
function isValidParsedSchema(obj: unknown): obj is ParsedSchemaJson { ... }
```

**D. Remove ParsedSchemaJson interface:**
```typescript
// DELETE THIS INTERFACE:
interface ParsedSchemaJson {
  type: 'zod'
  fields: Array<{ ... }>
}
```

**What to KEEP in schema.ts:**
- `SchemaField` interface ✅
- `FieldConstraints` interface ✅
- `FieldType` enum ✅
- `CompleteSchema` interface ✅
- `deserializeCompleteSchema()` function ✅
- `fieldTypeFromString()` helper ✅

**After cleanup, schema.ts should be ~150 lines (down from ~384 lines)**

#### 3. Simplify FrontmatterPanel.tsx

**File:** `src/components/frontmatter/FrontmatterPanel.tsx`

**A. Remove old imports:**
```typescript
// DELETE THESE IMPORTS:
import { parseSchemaJson } from '../../lib/schema'  // DELETE
import { parseJsonSchema } from '../../lib/parseJsonSchema'  // DELETE
```

**B. Replace entire schema useMemo (lines ~34-112):**

**DELETE THIS:**
```typescript
const schema = React.useMemo(() => {
  if (!currentCollection) return null

  // NEW: Try complete schema from Rust backend
  if (currentCollection.complete_schema) {
    const parsed = deserializeCompleteSchema(
      currentCollection.complete_schema
    )

    if (parsed) {
      if (import.meta.env.DEV) {
        console.log(
          `[Schema] Loaded complete schema for: ${parsed.collectionName}`
        )
      }
      return parsed
    }
  }

  // FALLBACK: Use old hybrid parsing for backwards compatibility
  // This will be removed once all projects regenerate schemas
  if (currentCollection.json_schema) {
    const parsed = parseJsonSchema(currentCollection.json_schema)

    if (parsed) {
      // Enhance with Zod reference metadata if available
      if (currentCollection.schema) {
        const zodSchema = parseSchemaJson(currentCollection.schema)

        if (zodSchema) {
          parsed.fields = parsed.fields.map(field => {
            const zodField = zodSchema.fields.find(z => z.name === field.name)

            if (zodField) {
              return {
                ...field,
                ...(zodField.reference && {
                  reference: zodField.reference,
                  referenceCollection: zodField.reference,
                }),
                ...(zodField.subReference && {
                  subReference: zodField.subReference,
                }),
              }
            }

            return field
          })
        }
      }

      if (import.meta.env.DEV) {
        console.log(
          `[Schema] Using fallback hybrid parsing for: ${currentCollection.name}`
        )
      }

      return parsed
    }
  }

  // Last resort: Zod-only parsing
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

**REPLACE WITH THIS SIMPLE VERSION:**
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

**Result:** Schema loading logic goes from ~79 lines to ~11 lines ✅

**C. Update event listener to use complete_schema:**

Find the `handleSchemaFieldOrderRequest` function and simplify it:

**REPLACE THIS:**
```typescript
const requestedSchema = requestedCollection?.schema
  ? parseSchemaJson(requestedCollection.schema)
  : null
```

**WITH THIS:**
```typescript
const requestedSchema = requestedCollection?.complete_schema
  ? deserializeCompleteSchema(requestedCollection.complete_schema)
  : null
```

#### 4. Remove Rust Collection Fields

**File:** `src-tauri/src/models/collection.rs`

**A. Remove deprecated fields:**

**DELETE THESE LINES:**
```rust
// DEPRECATED - Remove after migration
#[serde(skip_serializing_if = "Option::is_none")]
pub schema: Option<String>,
#[serde(skip_serializing_if = "Option::is_none")]
pub json_schema: Option<String>,
```

**B. Update Collection struct to:**
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Collection {
    pub name: String,
    pub path: PathBuf,

    /// Complete merged schema (single source of truth)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub complete_schema: Option<String>, // Serialized SchemaDefinition
}
```

**C. Remove old constructor methods:**
```rust
// DELETE THIS METHOD:
#[allow(dead_code)]
pub fn with_schema(name: String, path: PathBuf, schema: String) -> Self {
    Self {
        name,
        path,
        schema: Some(schema),
        json_schema: None,
        complete_schema: None,
    }
}

// DELETE THIS METHOD:
#[allow(dead_code)]
pub fn with_json_schema(mut self, json_schema: String) -> Self {
    self.json_schema = Some(json_schema);
    self
}
```

**D. Update `new()` method:**
```rust
pub fn new(name: String, path: PathBuf) -> Self {
    Self {
        name,
        path,
        complete_schema: None,
    }
}
```

**E. Keep only this method:**
```rust
#[allow(dead_code)]
pub fn with_complete_schema(mut self, complete_schema: String) -> Self {
    self.complete_schema = Some(complete_schema);
    self
}
```

#### 5. Update Rust Project Scanning

**File:** `src-tauri/src/commands/project.rs`

**Remove references to old schema fields:**

**Find and DELETE these sections in `scan_project_with_content_dir()`:**

**DELETE: JSON schema loading block (lines ~143-154 and similar blocks):**
```rust
// DELETE THIS:
// Try to load JSON schemas for each collection
for collection in &mut collections {
    if let Ok(json_schema) =
        load_json_schema_for_collection(&project_path, &collection.name)
    {
        debug!(
            "Astro Editor [PROJECT_SCAN] Loaded JSON schema for collection: {}",
            collection.name
        );
        collection.json_schema = Some(json_schema);
    }
}
```

**REPLACE WITH: Direct complete schema generation:**
```rust
// Generate complete schema for each collection
for collection in &mut collections {
    generate_complete_schema(collection);
}
```

**Simplify `generate_complete_schema()` to not use old fields:**

Currently it accesses `collection.json_schema` and `collection.schema`. After removing those fields, update it to load directly:

```rust
fn generate_complete_schema(collection: &mut Collection, project_path: &str) {
    // Load JSON schema if exists
    let json_schema = load_json_schema_for_collection(project_path, &collection.name).ok();

    // For Zod schema, we'd need to parse content.config.ts here
    // For now, this will be None until we refactor Zod loading
    let zod_schema = None; // TODO: Load from content.config.ts parsing

    match schema_merger::create_complete_schema(
        &collection.name,
        json_schema.as_deref(),
        zod_schema,
    ) {
        Ok(complete_schema) => match serde_json::to_string(&complete_schema) {
            Ok(serialized) => {
                debug!(
                    "Astro Editor [SCHEMA_MERGER] Generated complete schema for collection: {}",
                    collection.name
                );
                collection.complete_schema = Some(serialized);
            }
            Err(e) => {
                warn!(
                    "Astro Editor [SCHEMA_MERGER] Failed to serialize complete schema for {}: {}",
                    collection.name, e
                );
            }
        },
        Err(e) => {
            warn!(
                "Astro Editor [SCHEMA_MERGER] Failed to create complete schema for {}: {}",
                collection.name, e
            );
        }
    }
}
```

**NOTE:** The Zod schema loading will need to be refactored separately to load from `parse_astro_config()` results.

#### 6. Update Collection Tests

**File:** `src-tauri/src/models/collection.rs`

**Update test in `#[cfg(test)]` block:**

**DELETE THIS TEST:**
```rust
#[test]
fn test_collection_with_schema() {
    let schema = r#"
    z.object({
        title: z.string(),
        description: z.string().optional(),
        pubDate: z.coerce.date(),
        draft: z.boolean().default(false),
    })
    "#;

    let path = PathBuf::from("/project/src/content/blog");
    let collection =
        Collection::with_schema("blog".to_string(), path.clone(), schema.to_string());

    assert_eq!(collection.name, "blog");
    assert_eq!(collection.path, path);
    assert!(collection.schema.is_some());
    assert!(collection.schema.unwrap().contains("title"));
}
```

**REPLACE WITH:**
```rust
#[test]
fn test_collection_with_complete_schema() {
    let complete_schema = r#"{"collectionName":"blog","fields":[{"name":"title","label":"Title","fieldType":"string","required":true}]}"#;

    let path = PathBuf::from("/project/src/content/blog");
    let collection = Collection::new("blog".to_string(), path.clone())
        .with_complete_schema(complete_schema.to_string());

    assert_eq!(collection.name, "blog");
    assert_eq!(collection.path, path);
    assert!(collection.complete_schema.is_some());
    assert!(collection.complete_schema.unwrap().contains("Title"));
}
```

#### 7. Run All Checks After Cleanup

After making all removals, verify everything still works:

```bash
# Run all quality checks
pnpm run check:all

# Expected: ALL checks should pass
# - TypeScript typecheck: ✓
# - ESLint: ✓
# - Prettier: ✓
# - Rust fmt: ✓
# - Clippy: ✓
# - Tests (TypeScript): ✓
# - Tests (Rust): ✓
```

**If ANY check fails:**
1. Do NOT commit
2. Review the error
3. Fix the issue
4. Re-run checks

#### 8. Test Manually After Cleanup

```bash
# Start dev server
pnpm run dev

# Test with dummy-astro-project:
# 1. Open project
# 2. Verify console shows: "[Schema] Loaded complete schema for: articles"
# 3. Verify NO fallback messages appear
# 4. Test reference dropdowns work
# 5. Test saving/loading works
# 6. Verify no console errors
```

#### 9. Update Documentation

**A. Update CLAUDE.md:**

**Remove these sections:**
- References to "hybrid parsing"
- References to `parseJsonSchema.ts`
- References to `parseZodReferences.ts`

**Add new section:**
```markdown
### Schema Architecture

**Single Source of Truth:** All schema parsing happens in Rust backend via `schema_merger.rs`

**Data Flow:**
1. Rust loads Astro JSON schema (`.astro/collections/*.schema.json`)
2. Rust parses Zod schema (`content.config.ts`) for reference information
3. Rust merges both into `complete_schema` field
4. Frontend deserializes and renders

**Frontend Responsibilities:**
- Deserialize `complete_schema` JSON
- Render fields based on type
- No parsing, no merging, no business logic
```

**B. Update Architecture Guide:**

Add to `docs/developer/architecture-guide.md`:

```markdown
## Schema Processing Architecture

### Overview

Schema processing is entirely handled in the Rust backend through the `schema_merger` module.

### Components

**Rust Backend (`src-tauri/src/schema_merger.rs`):**
- Parses Astro JSON schemas
- Parses Zod schemas
- Merges schema information
- Serializes to `complete_schema`

**TypeScript Frontend (`src/lib/schema.ts`):**
- Deserializes `complete_schema`
- Maps Rust types to TypeScript enums
- No parsing logic

**React Components:**
- Receive parsed schema
- Render fields by type
- No business logic

### Benefits

- **Single Responsibility:** Each layer does one thing
- **Type Safety:** Rust parsing ensures correctness
- **Maintainability:** All parsing logic in one place
- **Performance:** Parse once in Rust, deserialize in TypeScript
```

#### 10. Commit Changes

**Only after ALL checks pass and manual testing succeeds:**

```bash
# Stage all changes
git add -A

# Create commit
git commit -m "refactor: complete Phase 4 schema architecture cleanup

- Remove deprecated TypeScript parsers (parseJsonSchema, parseZodReferences)
- Remove old Zod parsing code from schema.ts
- Simplify FrontmatterPanel to use only complete_schema
- Remove deprecated Collection fields (schema, json_schema)
- Update Collection model and tests
- Clean up project scanning code
- Update documentation

All schema parsing now happens in Rust backend via schema_merger.rs.
Frontend only deserializes and renders.

Breaking change: Projects must regenerate .astro/collections/*.json
to use the new complete_schema format.

Closes #[issue-number] (if applicable)"
```

#### 11. Verification Checklist

Before considering Phase 4 complete, verify:

- [ ] All TypeScript parser files deleted
- [ ] All Zod parsing code removed from schema.ts
- [ ] FrontmatterPanel simplified to <20 lines for schema logic
- [ ] Collection model has only `complete_schema` field
- [ ] No references to old `schema` or `json_schema` fields
- [ ] All tests passing (TypeScript and Rust)
- [ ] No linting errors
- [ ] Dev server runs without errors
- [ ] Reference fields work correctly in UI
- [ ] Console shows only "Loaded complete schema" messages
- [ ] No fallback parsing messages in console
- [ ] Documentation updated
- [ ] Committed with descriptive message

---

### What You'll Have After Phase 4

**Deleted:**
- ❌ `src/lib/parseJsonSchema.ts` (~10KB)
- ❌ `src/lib/parseJsonSchema.test.ts` (~22KB)
- ❌ `src/lib/parseZodReferences.ts` (~2.5KB)
- ❌ ~200 lines from `src/lib/schema.ts`
- ❌ ~68 lines from `FrontmatterPanel.tsx`
- ❌ 2 fields from Collection struct

**Result:**
- ✅ Single source of truth: `complete_schema`
- ✅ All parsing in Rust backend
- ✅ Simple deserialization in TypeScript
- ✅ Clean React components with no business logic
- ✅ ~500 lines of code removed
- ✅ Better architecture
- ✅ Easier maintenance
- ✅ Type-safe schema processing

---

**REMEMBER:** DO NOT proceed with Phase 4 until you've verified the new system works perfectly in manual testing!
