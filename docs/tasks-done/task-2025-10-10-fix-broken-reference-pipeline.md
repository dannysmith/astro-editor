# Task 4: Fix Broken Reference Data Pipeline

**Status:** 🔴 In Progress
**Priority:** 1 (Critical - references completely broken)
**Related:** docs/tasks-done/task-schema-architecture-refactor.md

---

## Problem Summary

During Phase 4 cleanup (commits `3eef92c` and `b3389fe`), we removed the TypeScript fallback parsers that were making references work, but **never actually wired up the Rust replacement**.

### What's Broken

References are not working at all:
- Author dropdown in articles is empty (should show 3 authors from `authors.json`)
- Related Articles multi-select is empty (should show article titles)
- Any reference field shows no options

### Root Cause

In `src-tauri/src/commands/project.rs:198-200`:

```rust
// For now, we don't have Zod schema loading (it would require parsing content.config.ts)
// The schema_merger will work with just JSON schema
let zod_schema: Option<&str> = None;  // ← ALWAYS PASSING NONE!
```

The problem:
1. `parse_astro_config()` successfully loads Zod schemas and stores in `collection.schema`
2. But we removed those fields during cleanup
3. So `generate_complete_schema()` has no Zod data to merge
4. JSON schemas alone don't contain reference collection names
5. Result: `complete_schema` has NO reference information

### What Was Working

Before cleanup commits:
- TypeScript hybrid parsing in `FrontmatterPanel.tsx` was merging JSON + Zod schemas
- This provided reference collection names to `ReferenceField.tsx`
- ReferenceField used those names to load the right collections
- Everything rendered correctly

The **UI layer is completely intact** - we just broke the data pipeline.

---

## The Fix Plan

### Step 1: Hard Reset to Working State

```bash
git reset --hard 06ef58f  # "Fix broken references logic"
```

This gets us back to where references were working.

### Step 2: Keep Internal Fields for Schema Merging

**File:** `src-tauri/src/models/collection.rs`

Change the Collection struct to keep the fields internally but not send to frontend:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Collection {
    pub name: String,
    pub path: PathBuf,

    // Internal use only - for schema merging in Rust
    // These fields are loaded by parse_astro_config() and used by generate_complete_schema()
    // We don't send them to frontend (skip_serializing) but need them in Rust
    #[serde(skip_serializing)]
    pub schema: Option<String>,           // Zod schema JSON from parse_astro_config()

    #[serde(skip_serializing)]
    pub json_schema: Option<String>,      // Astro JSON schema from .astro/collections/*.json

    // Complete merged schema - ONLY this goes to frontend
    pub complete_schema: Option<String>,
}
```

**Rationale:**
- We need these fields internally in Rust for the merging process
- Frontend doesn't need them (it gets `complete_schema`)
- This is cleaner than passing them around as function parameters

### Step 3: Wire Up generate_complete_schema Properly

**File:** `src-tauri/src/commands/project.rs`

Fix the `generate_complete_schema()` function to actually USE the Zod schema:

```rust
fn generate_complete_schema(collection: &mut Collection, project_path: &str) {
    // Load JSON schema if exists
    let json_schema = load_json_schema_for_collection(project_path, &collection.name).ok();

    // Use the Zod schema that parse_astro_config() already loaded!
    // It's sitting in collection.schema - we just need to use it
    let zod_schema = collection.schema.as_deref();

    match schema_merger::create_complete_schema(
        &collection.name,
        json_schema.as_deref(),
        zod_schema,  // ← NOW WE'RE ACTUALLY PASSING IT!
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

**What this does:**
1. Loads JSON schema from `.astro/collections/*.schema.json` (structure + types)
2. Gets Zod schema from `collection.schema` (already loaded by `parse_astro_config()`)
3. Passes BOTH to schema_merger
4. Schema merger extracts reference collection names from Zod
5. Merges everything into `complete_schema`
6. Frontend gets complete data with references

### Step 4: Test References Work

Manual testing checklist:
- [ ] Start dev server: `pnpm run dev`
- [ ] Open test/dummy-astro-project
- [ ] Check browser console shows: `[Schema] Loaded complete schema for: articles`
- [ ] Open an article file
- [ ] Author dropdown shows 3 authors: Danny Smith, Jane Doe, John Developer
- [ ] Related Articles multi-select shows article titles
- [ ] Selecting authors works
- [ ] Selecting related articles works (badges appear)
- [ ] Saving works correctly
- [ ] No console errors

### Step 5: Verify Schema Merger Output

Check that the complete_schema contains reference information:

```bash
# Start dev server, open project, then in browser console:
const collections = await window.__TAURI__.invoke('scan_project', {
  projectPath: '/path/to/test/dummy-astro-project'
})
const articles = collections.find(c => c.name === 'articles')
JSON.parse(articles.complete_schema)
// Should show fields with referenceCollection: "authors"
```

### Step 6: Run All Quality Checks

```bash
pnpm run check:all
```

All checks must pass:
- ✅ TypeScript typecheck
- ✅ ESLint
- ✅ Prettier
- ✅ Rust fmt
- ✅ Clippy
- ✅ Vitest (all tests)
- ✅ Cargo test (all tests)

### Step 7: Clean Up Phase 4 (Properly This Time)

**ONLY after references are confirmed working**, remove the old TypeScript parsers:

#### Files to Delete Completely

```bash
rm -f src/lib/parseJsonSchema.ts
rm -f src/lib/parseJsonSchema.test.ts
rm -f src/lib/parseZodReferences.ts
```

#### Functions to Remove from src/lib/schema.ts

Delete these entire sections:

**A. Legacy Zod type definitions (lines ~3-63):**
- `interface ZodField`
- `interface ZodFieldConstraints`
- `type ZodFieldType`

**B. Conversion helper functions:**
- `function zodFieldTypeToFieldType()`
- `function convertZodConstraints()`
- `function zodFieldToSchemaField()`

**C. Zod parsing functions:**
- `export function parseSchemaJson()`
- `function isValidParsedSchema()`
- `interface ParsedSchemaJson`

**What to KEEP in schema.ts:**
- ✅ `SchemaField` interface
- ✅ `FieldConstraints` interface
- ✅ `FieldType` enum
- ✅ `CompleteSchema` interface
- ✅ `deserializeCompleteSchema()` function
- ✅ `fieldTypeFromString()` helper

After cleanup, schema.ts should be ~140 lines (down from ~384 lines).

#### Simplify FrontmatterPanel.tsx

**File:** `src/components/frontmatter/FrontmatterPanel.tsx`

**Remove these imports:**
```typescript
import { parseSchemaJson } from '../../lib/schema'  // DELETE
import { parseJsonSchema } from '../../lib/parseJsonSchema'  // DELETE
```

**Replace the schema useMemo** (currently ~79 lines with fallbacks) with simple version:

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

**Also update the event listener** in the same file:

```typescript
// Find handleSchemaFieldOrderRequest function
const requestedSchema = requestedCollection?.complete_schema
  ? deserializeCompleteSchema(requestedCollection.complete_schema)
  : null
```

Result: Schema logic goes from ~79 lines to ~11 lines.

#### Update Collection Tests

**File:** `src-tauri/src/models/collection.rs`

Update the test to reflect that schema/json_schema are internal:

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

---

## Success Criteria

### Before Cleanup (Step 7)

- [ ] References working in UI (author dropdown, related articles)
- [ ] Console shows "Loaded complete schema" (not "Using fallback")
- [ ] No console errors
- [ ] All quality checks passing
- [ ] Manual testing confirms everything works

### After Cleanup (Step 7)

- [ ] All deleted files removed from git
- [ ] schema.ts reduced to ~140 lines
- [ ] FrontmatterPanel schema logic ~11 lines
- [ ] No imports of deleted files anywhere
- [ ] TypeScript compilation succeeds
- [ ] All quality checks still passing
- [ ] References still working in UI
- [ ] Committed with descriptive message

---

## Files Modified

### Phase 1 (Fix)
- `src-tauri/src/models/collection.rs` - Add #[serde(skip_serializing)] to internal fields
- `src-tauri/src/commands/project.rs` - Fix generate_complete_schema() to use Zod schema

### Phase 2 (Cleanup)
- `src/lib/parseJsonSchema.ts` - DELETE
- `src/lib/parseJsonSchema.test.ts` - DELETE
- `src/lib/parseZodReferences.ts` - DELETE
- `src/lib/schema.ts` - Remove ~244 lines of Zod parsing code
- `src/components/frontmatter/FrontmatterPanel.tsx` - Simplify schema loading
- `src-tauri/src/models/collection.rs` - Update tests

---

## Why This Happened

I made two critical mistakes:

1. **Shipped incomplete work** - I wrote the comment "For now, we don't have Zod schema loading" but then treated it as complete
2. **Removed the fallback too early** - I deleted the TypeScript parsers that were actually making it work before verifying the Rust replacement was wired up

The schema_merger.rs code itself is fine - it just was never connected to real data.

---

## Lessons Learned

- Never remove fallback code until the replacement is **proven working** in production
- "For now" comments are technical debt - either fix them or document them properly
- When refactoring across layers (Rust ↔ TypeScript), verify the full data pipeline, not just individual components
- Manual testing should have caught this - we should have tested before cleanup

---

**Next Steps:** Review this plan, then execute Step 1 (hard reset).
