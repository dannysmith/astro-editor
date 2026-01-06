# CSV Collection Support for References

## Overview

Add support for CSV-based collections when used with Astro's `reference()` field type, enabling autocomplete for references that point to CSV data sources.

## Problem

Currently, when a schema uses `reference('collection-name')` and that collection is backed by a CSV file (using Astro's CSV loader), the editor cannot provide autocomplete suggestions because:

1. Only JSON schema files are parsed for reference data
2. CSV loaders aren't recognized in the schema parsing logic
3. No CSV parsing exists in the backend

Users with CSV-based collections (common for things like authors, categories, tags) don't get the reference autocomplete that works for markdown-based collections.

---

## Background: How References Work Currently

### Schema Definition

In `content.config.ts`:
```typescript
const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: z.object({
    author: reference('authors'),  // References another collection
  })
})

const authors = defineCollection({
  loader: file("src/data/authors.json"),  // JSON works
  schema: z.object({
    id: z.string(),
    name: z.string(),
  })
})
```

### Current Parsing

The Rust backend parses JSON files to extract valid reference IDs. For CSV, this doesn't happen.

---

## Requirements

### Must Have

- Parse CSV files referenced by `file()` loader in content.config.ts
- Extract IDs from CSV for reference autocomplete
- Handle standard CSV format (comma-separated, optional headers)

### Should Have

- Support for different delimiters (semicolon, tab)
- Handle quoted values with commas inside
- Graceful handling of malformed CSV

### Could Have

- Preview CSV data in some form
- Support for CSV files with different ID column names

---

## Technical Approach

### 1. Detect CSV Loaders in Schema

When parsing `content.config.ts`, identify collections using:
```typescript
loader: file("path/to/data.csv")
```

The file extension `.csv` indicates CSV format.

### 2. Add CSV Parsing to Rust Backend

Location: `src-tauri/src/` (new module or extend existing)

```rust
// Parse CSV and extract IDs (first column or 'id' column)
fn parse_csv_collection(path: &Path) -> Result<Vec<String>, Error> {
    // Use csv crate
    // Read headers
    // Find 'id' column (or use first column)
    // Return list of valid IDs
}
```

Consider using the `csv` crate which is well-maintained.

### 3. Integrate with Schema Loading

When loading collection schemas:
1. Check if loader is `file()` with CSV extension
2. If so, parse CSV to extract reference IDs
3. Store in same structure used for other collections

### 4. Frontend Changes

Minimal - the reference field autocomplete already works with whatever IDs the backend provides. Just need to ensure CSV-sourced IDs flow through correctly.

---

## Edge Cases

1. **No header row**: Assume first column is ID
2. **'id' column not first**: Search headers for 'id', 'ID', 'Id'
3. **Empty CSV**: Return empty ID list (valid, just no options)
4. **Malformed CSV**: Log warning, skip malformed rows
5. **Large CSV files**: Performance consideration - may need streaming parse
6. **Non-UTF8 encoding**: Handle or error gracefully

---

## Open Questions

1. **Which column is the ID?**
   - Convention: First column? Column named 'id'?
   - Could be configurable, but adds complexity
   - Recommendation: Look for 'id' column first, fall back to first column

2. **Should we display other CSV columns?**
   - For autocomplete, showing just ID might not be helpful
   - Could show "ID - Name" format if name column exists
   - Adds complexity to the reference field component

3. **Caching strategy?**
   - CSV files don't change often
   - Parse once on project load, refresh on file change?
   - File watcher for CSV files?

---

## Implementation Steps

1. Add `csv` crate to Cargo.toml
2. Create CSV parsing utility in Rust
3. Integrate into schema/collection loading
4. Add tests for CSV parsing
5. Test end-to-end with reference field

## Testing Plan

- [ ] CSV with header row parses correctly
- [ ] CSV without header row uses first column as ID
- [ ] CSV with 'id' column finds it regardless of position
- [ ] Quoted values with commas parse correctly
- [ ] Empty CSV returns empty list (no error)
- [ ] Malformed rows are skipped with warning
- [ ] Reference autocomplete shows CSV-sourced IDs
- [ ] Large CSV files don't cause performance issues

---

## Dependencies

- None - this is independent backend work

## Out of Scope

- Editing CSV files from the app
- Creating new CSV entries
- Non-reference uses of CSV data (just for autocomplete)
- TSV or other delimiter variants (could add later)
