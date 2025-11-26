# Task: Improve Frontmatter Fidelity

## Related Issues

- https://github.com/dannysmith/astro-editor/issues/67
- https://github.com/dannysmith/astro-editor/issues/68

## Problem Summary

The current frontmatter handling modifies files in ways users don't expect:

| Issue           | Current Behavior                                    | Expected Behavior                     |
| --------------- | --------------------------------------------------- | ------------------------------------- |
| Date formats    | `01-15-2024` shows "Invalid Date"                   | Should parse and display correctly    |
| Time in dates   | `2025-11-23T18:55:24.118+00:00` → `2025-11-23`      | Time should be preserved if untouched |
| Numbers         | Edited numbers become strings (`27.92` → `'27.92'`) | Should stay as numbers                |
| Quotes          | `'Athens Greeknotes'` → `Athens Greeknotes`         | Should preserve original quoting      |
| Field order     | Reordered to schema + alphabetical                  | Should preserve original order        |
| Untouched files | Opening and saving modifies frontmatter             | Should be byte-identical              |

## Core Principles

### 1. First, Do No Harm

If the user doesn't edit frontmatter, it should be byte-for-byte identical when saved. Opening a file and editing only the markdown body should never modify frontmatter.

### 2. Preserve Intent

When a field IS edited:

- Change only that field's value
- Preserve formatting of unedited fields
- Don't reorder fields
- Don't normalize strings/quotes unnecessarily

### 3. Parse Generously, Serialize Carefully

Accept all valid date formats on input. Serialize in the format that preserves the most information.

### 4. Types are Sacred

The stored type must match the schema type:

- `z.number()` → YAML number (`27.92` not `'27.92'`)
- `z.string()` → YAML string
- `z.date()` → valid date format

## Ideal Behavior

### Scenario Table

| Scenario                            | Ideal Behavior                                                   |
| ----------------------------------- | ---------------------------------------------------------------- |
| Open file, edit markdown only, save | Frontmatter byte-identical to original                           |
| Edit one frontmatter field          | Only that field changes; order preserved; other fields identical |
| Add new date                        | ISO format (`YYYY-MM-DD`)                                        |
| Edit existing date                  | ISO format for new value                                         |
| Don't touch existing date           | Preserve original format including time                          |
| Number fields                       | Always serialize as YAML numbers                                 |
| String fields                       | Allow serializer to decide quoting                               |
| Field ordering                      | Preserve original order                                          |

### Date Handling

**Parsing (file → editor):**

- Accept ISO date: `2024-01-15`
- Accept ISO datetime: `2024-01-15T12:30:00Z`, `2024-01-15T12:30:00+05:00`
- Accept US format: `01-15-2024` (month-day-year)
- Accept whatever else Astro's `z.date()` accepts

**Display:** Date picker shows correct date regardless of input format.

**Serialization (editor → file):**

- Unchanged dates → preserve original string exactly (including time)
- New dates → ISO format (`YYYY-MM-DD`)
- Changed dates → ISO format

### Number Handling

Numbers must remain numbers through the entire pipeline. The current bug where numbers become strings after editing needs investigation and fixing.

### String Handling

Let the YAML serializer decide quoting. Both `'value'` and `value` are semantically identical. Only quote when necessary for YAML validity.

### Field Ordering

- If frontmatter not edited → preserve original order exactly
- If frontmatter edited → current schema-order behavior is acceptable

## Implementation Phases

### Phase 1: Quick Wins

1. **Fix number bug** - Investigate why numbers become strings; fix the pipeline
2. **Fix date parsing** - Use robust date parser accepting multiple formats (US, ISO, datetime)
3. **Don't strip time** - If date field not edited, preserve original string including time

### Phase 2: Fidelity

1. **Track `frontmatterIsDirty` separately** from general `isDirty`
2. **Use `rawFrontmatter` verbatim** when frontmatter hasn't been edited
3. This alone solves ordering, quoting, and time preservation for untouched files

### Phase 3: Field-Level Preservation (if needed)

1. Store `originalFieldStrings: Record<string, string>` on parse
2. On save, for semantically unchanged fields, use original string
3. Achieves "only change what was edited" for partial edits

## Complexity Assessment

| Task                     | Difficulty                             |
| ------------------------ | -------------------------------------- |
| Fix number bug           | Easy (investigate + fix)               |
| Fix date parsing         | Easy (robust parser)                   |
| No-edit preservation     | Medium (dirty tracking + raw fallback) |
| Field-level preservation | Hard (per-field tracking)              |
| Surgical YAML editing    | Very Hard (not recommended)            |

## Appendix: Original Issue Details

### Issue #67: Dates formatted as mm-dd-yyyy not recognized

Date `01-15-2024` shows "Invalid Date" in picker.

### Issue #68: Numbers become strings + other changes

```diff
---
-- title: 'Athens Greeknotes Nov 23'
-- date: 2025-11-23T18:55:24.118+00:00
-- lat: 37.984167
-- lng: 23.728056
+ title: Athens Greeknotes Nov 23
+ date: 2025-11-23
+ lat: '27.92'
+ lng: 23.728056
---
```

Changes observed:

- Quotes stripped from strings
- Time stripped from date
- Number became string after editing
- Fields reordered
