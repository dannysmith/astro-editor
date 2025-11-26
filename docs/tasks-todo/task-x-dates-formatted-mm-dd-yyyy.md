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

## Research Findings

### Zod Date Handling

- `z.date()` - expects actual JavaScript Date objects (strict)
- `z.coerce.date()` - calls `new Date(input)` on the input (flexible)
- Astro recommends `z.coerce.date()` for frontmatter dates

### JavaScript Date Parsing

Reliably supported formats ([MDN Reference](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/parse)):

- ISO 8601: `2024-01-15`, `2024-01-15T12:30:00Z`, `2024-01-15T12:30:00+05:00`
- `toString()`/`toUTCString()` formats

Implementation-specific (may not work everywhere):

- US slash format: `1/15/2024` (works in most browsers)
- **Dash format with US order: `01-15-2024` is NOT standard** - JavaScript sees dashes and tries to parse as ISO (YYYY-MM-DD), which fails

### YAML Date Handling

- YAML 1.1 had timestamp type (ISO 8601 based) - [YAML Timestamp Spec](https://yaml.org/type/timestamp.html)
- YAML 1.2 dropped built-in timestamp support
- Most parsers (including serde_norway) return dates as strings

### Current Implementation Issue

```tsx
// DateField.tsx line 37
value={value && typeof value === 'string' ? new Date(value) : undefined}
```

This passes the string directly to `new Date()`, which fails for non-ISO formats like `01-15-2024`.

### The Core Problem

The format `01-15-2024` (MM-DD-YYYY with dashes) is problematic because:

1. JavaScript's Date constructor sees dashes and assumes ISO format (YYYY-MM-DD)
2. It tries to parse as year=01, month=15, day=2024 → Invalid Date
3. The format `1/15/2024` (with slashes) would actually work, but dashes break it

## Open Questions

These need decisions before implementation can proceed:

### Q1: Ambiguous Date Formats

How should we handle dates like `01-02-2024`? This could be:

- January 2nd (US: MM-DD-YYYY)
- February 1st (European: DD-MM-YYYY)

Options:

- A) Assume US format (MM-DD-YYYY) for ambiguous dash-separated dates
- B) Assume European format (DD-MM-YYYY)
- C) Only support ISO format for dashes (YYYY-MM-DD), reject others with error
- D) Use system locale to decide

### Q2: Time Component When Editing

When a user edits a date that originally had a time component (e.g., `2025-11-23T18:55:24.118+00:00`), what should happen?

Options:

- A) Preserve the original time (show same date in picker, save with original time)
- B) Reset to midnight UTC (`2025-11-23T00:00:00Z`)
- C) Strip time entirely, save as date-only (`2025-11-23`)

### Q3: Format Preservation Scope

For "preserve original format" - how far should we go?

Options:

- A) Only preserve if the field wasn't touched at all
- B) Preserve format even if date changed (e.g., if original was `01/15/2024`, new date saved as `02/20/2024`)
- C) Always normalize to ISO when any change is made

### Q4: Slash vs Dash Handling

Should we support both `01/15/2024` and `01-15-2024` (assuming US format)?

Options:

- A) Yes, support both (more permissive)
- B) Only support slashes for US format, dashes only for ISO (clearer semantics)

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
