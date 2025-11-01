# Task: Better Object Handling

https://github.com/dannysmith/astro-editor/issues/36

It appears as if objects in content types aren't handled properly in the UI. As you can see here, the UI is asking me to "Enter crafting…" with a freeform text field, and then the individual properties below it.

<img width="338" height="638" alt="Image" src="https://github.com/user-attachments/assets/b32b11a1-be4a-4b1c-9187-097e9557b432" />

The JSON schema for this field is what I'd expect:

```json
"crafting": {
  "type": "object",
  "properties": {
    "textile": {
      "type": "number"
    },
    "wood": {
      "type": "number"
    },
    "metal": {
      "type": "number"
    },
    "stone": {
      "type": "number"
    },
    "elementalis": {
      "type": "number"
    },
    "mithril": {
      "type": "number"
    },
    "fadeite": {
      "type": "number"
    }
  },
  "required": [
    "textile",
    "wood",
    "metal",
    "stone",
    "elementalis",
    "mithril",
    "fadeite"
  ],
  "additionalProperties": false
},
```

This makes complex content types difficult to work with. What I'd love to see is objects transformed into [`fieldset`s](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/fieldset) with their field name as their `legend`. That would both logically group the fields underneath it, which is the intent of having them as an object to begin with, and remove the confusing input for an object type.

(I also notice that the order of the fields inside objects is not preserved, that feels like a potentially related bug)

---

Okay, so this looks like what we need to do here is first of all make a test case using the example that he's got here. So we should add an object like the one described in this report to `test/dummy-astro-project` first. We should keep this as simple as possible. We don't need to include all of those fields, obviously. Probably just a text field and a number field, date field to the object. And we should make some of them required and some of them not. So let's do that in the content.config.json schema and then add a new note which includes a couple of these fields as dummy content. Make sure the JSON front matter is done correctly. Once you've done that, I can then run Astro Sync in that site to generate the JSON schema.

And then when I've done that, we can look at putting together a plan to implement this. I would suggest that we don't want to support anything like this if it doesn't appear in the schema. Because we already have some support for nested fields. I'm unsure how that differs in schemas to objects like this. So I'd like you to investigate that by looking at the astro docs and looking online.

---

## Research Findings

### Test Case Created

**✅ Schema Updated** (`test/dummy-astro-project/src/content.config.ts:45-50`)
Added a `metadata` object field to the `notes` collection:
```typescript
metadata: z.object({
  category: z.string(),           // required
  priority: z.number().optional(),
  deadline: z.coerce.date().optional(),
}).optional(),
```

**✅ Test File Created** (`test/dummy-astro-project/src/content/notes/2024-03-15-object-field-test.md`)
Created a note with object field frontmatter to test the UI behavior.

### Astro Content Collections: Objects vs References

#### Object Fields (`z.object()`)
- **Purpose**: Define inline nested data structures directly within an entry
- **Schema Example**: `image: z.object({ src: z.string(), alt: z.string() })`
- **Frontmatter Representation**:
  ```yaml
  image:
    src: /path/to/image.jpg
    alt: Description here
  ```
- **Use Case**: When you want to store structured data that belongs to this specific entry

#### Reference Fields (`reference()`)
- **Purpose**: Establish relationships between collection entries
- **Schema Example**: `author: reference('authors')`
- **Data Representation**: Stores `{collection: "authors", id: "ben-holmes"}` rather than embedding data
- **Use Case**: When you want to link to separate collection entries and query them separately using `getEntry()` or `getEntries()`

### Current Implementation Analysis

#### Backend Schema Parsing (`src-tauri/src/schema_merger.rs:330-352`)

The Rust backend **already handles object fields** via **flattening**:

```rust
// Handle nested objects - recursively flatten
if field_type_info.field_type == "unknown"
    && matches!(&field_schema.type_, Some(StringOrArray::String(s)) if s == "object")
    && field_schema.properties.is_some()
{
    // Flatten nested object
    let mut nested_fields = Vec::new();
    let nested_required: HashSet<String> = /* ... */;

    for (nested_name, nested_schema) in field_schema.properties.as_ref().unwrap() {
        let is_nested_required = nested_required.contains(nested_name);
        let parsed = parse_field(nested_name, nested_schema, is_nested_required, &full_path)?;
        nested_fields.extend(parsed);
    }
    return Ok(nested_fields);
}
```

**Result**: Object properties are parsed into individual `SchemaField` entries with:
- `name`: Flattened path using dot notation (e.g., `"metadata.category"`)
- `is_nested`: `Some(true)` to indicate this is a nested field
- `parent_path`: Parent object's path (e.g., `"metadata"`)

#### Frontend State Management (`src/store/editorStore.ts`)

**✅ Nested value handling exists**:
1. `setNestedValue()` (lines 14-71): Creates nested objects using dot notation
2. `getNestedValue()` (lines 77-95): Reads nested values using dot notation
3. `deleteNestedValue()` (lines 101-173): Deletes nested values and cleans up empty parents
4. `updateFrontmatterField()` (lines 434-454): Uses these helpers for all field updates

**Example**: When updating `metadata.category`, it automatically creates/updates:
```typescript
frontmatter: {
  metadata: {
    category: "development"
  }
}
```

#### Frontend UI Rendering (`src/components/frontmatter/FrontmatterPanel.tsx:131-193`)

**✅ Visual grouping already implemented**:

```typescript
// Group fields by parent path (lines 131-144)
const groupedFields = React.useMemo(() => {
  const groups: Map<string | null, typeof allFields> = new Map()
  for (const field of allFields) {
    const parentPath = field.schemaField?.parentPath ?? null
    if (!groups.has(parentPath)) groups.set(parentPath, [])
    groups.get(parentPath)!.push(field)
  }
  return groups
}, [allFields])

// Render nested groups (lines 163-193)
{Array.from(groupedFields.entries())
  .filter(([parentPath]) => parentPath !== null)
  .map(([parentPath, fields]) => (
    <div key={parentPath} className="space-y-4">
      <h3 className="text-sm font-medium text-foreground pt-2">
        {camelCaseToTitleCase(parentPath!.split('.').pop() || parentPath!)}
      </h3>
      <div className="pl-4 border-l-2 border-border space-y-4">
        {/* Nested fields with indentation */}
      </div>
    </div>
  ))}
```

### Generated JSON Schema

From `test/dummy-astro-project/.astro/collections/notes.schema.json:46-76`:

```json
"metadata": {
  "type": "object",
  "properties": {
    "category": { "type": "string" },
    "priority": { "type": "number" },
    "deadline": {
      "anyOf": [
        { "type": "string", "format": "date-time" },
        { "type": "string", "format": "date" },
        { "type": "integer", "format": "unix-time" }
      ]
    }
  },
  "required": ["category"],
  "additionalProperties": false
}
```

This schema is correctly parsed by the backend's `parse_field` function which:
1. Detects `type: "object"` with `properties`
2. Recursively parses each property
3. Returns flattened fields: `metadata.category`, `metadata.priority`, `metadata.deadline`
4. Marks each with `parent_path: "metadata"` and `is_nested: true`

### Current Status Summary

| Component | Status | Details |
|-----------|--------|---------|
| **Backend Parsing** | ✅ Complete | Objects are parsed and flattened with dot notation |
| **State Management** | ✅ Complete | Nested values handled with `setNestedValue`/`getNestedValue` |
| **UI Grouping** | ✅ Complete | Fields grouped by `parentPath` with visual hierarchy |
| **Frontmatter Writing** | ✅ Complete | Nested objects written correctly to YAML |

### The Original Issue

Looking at the GitHub issue screenshot, the problem shows:
1. A text input for "Enter crafting..." (the object itself)
2. Individual fields below it for each property

This suggests the implementation **may have been recently added** (based on system reminders showing file modifications). The current codebase should now:
- ✅ NOT show an input for the object itself
- ✅ Group nested fields visually under a header
- ✅ Show proper indentation with a left border
- ✅ Handle nested field updates correctly

### Potential Remaining Issues

1. **Field Ordering** - The original issue mentions "the order of the fields inside objects is not preserved"
   - This may still be an issue if the Rust backend doesn't preserve property order from the JSON schema
   - `IndexMap` is used in schema_merger.rs which *should* preserve order, but needs testing

2. **Deep Nesting** - Current implementation handles one level (`metadata.category`)
   - Deeper nesting like `author.address.city` should work but hasn't been tested

3. **Visual Design** - Current implementation uses `<h3>` header and indentation
   - Original request wanted `<fieldset>` with `<legend>` which is semantically more appropriate
   - Current design works but could be enhanced

### Next Steps for User

**To verify the fix**:
1. Open the Astro Editor with the test dummy project
2. Open the test file `2024-03-15-object-field-test.md`
3. Check the frontmatter panel to see if:
   - There is NO input field for "metadata" itself
   - Fields are grouped under a "Metadata" header
   - Fields show proper visual grouping (indentation + border)
4. Try editing the nested fields and verify they save correctly

**If issues remain**, they are likely:
- Visual design preferences (fieldset vs current design)
- Field ordering within objects
- Edge cases with deep nesting

---

## Bug Fix Applied

### The Problem

`src-tauri/src/schema_merger.rs:512-520` incorrectly treated **all** objects with `additionalProperties` as dynamic records/maps:

```rust
// BEFORE (buggy code):
if field_schema.additional_properties.is_some() {
    return Ok(FieldTypeInfo {
        field_type: "string".to_string(),  // <-- Treats as string field!
        // ...
    });
}
```

This meant objects with `additionalProperties: false` (a common constraint meaning "strict object, no extra properties allowed") were incorrectly rendered as text input fields instead of being flattened into individual fields.

### The Fix

Updated the logic to only treat objects with `additionalProperties: true` or a schema as dynamic records:

```rust
// AFTER (fixed code):
if matches!(
    &field_schema.additional_properties,
    Some(PropertyAdditionalProperties::Boolean(true))
        | Some(PropertyAdditionalProperties::Schema(_))
) {
    return Ok(FieldTypeInfo {
        field_type: "string".to_string(),
        // ...
    });
}
// Nested objects (including those with additionalProperties: false) will be flattened
return Ok(FieldTypeInfo {
    field_type: "unknown".to_string(),  // Triggers flattening
    // ...
});
```

### Testing

Added regression test `test_parse_nested_object_with_additional_properties_false()` in `src-tauri/src/schema_merger.rs:997-1055` to prevent this bug from recurring.

**Test verifies:**
- Objects with `additionalProperties: false` are flattened into individual fields
- Fields have correct `parent_path` and `is_nested` markers
- NO field is created for the object itself

**All tests pass** ✅

### Files Changed

1. `src-tauri/src/schema_merger.rs:507-535` - Fixed the bug
2. `src-tauri/src/schema_merger.rs:997-1055` - Added regression test

### Next Steps

Restart the Astro Editor to see the fix in action. The "Metadata" text input should disappear, replaced by properly grouped fields.
