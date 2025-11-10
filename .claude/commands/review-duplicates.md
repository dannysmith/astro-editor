---
allowed-tools: [Read, Bash, Grep, AskUserQuestion, Edit, Write]
description: 'Find and intelligently review duplicated code using jscpd'
---

# /review-duplicates - Intelligent Duplicate Code Review

## Purpose

Use jscpd to find duplicated code across TypeScript and Rust files, then intelligently categorize and present findings for manual review and refactoring.

**Philosophy**: Duplicate code analysis is highly contextual. This command provides intelligent categorization and recommendations, but ALL removals/refactoring are manual and user-approved.

## Execution Steps

### 1. Run jscpd

```bash
pnpm run jscpd
```

This generates reports in `jscpd-report/`:
- `jscpd-report.json` - Structured data for parsing
- Console output - Human-readable summary

### 2. Parse JSON Report

Read and parse `jscpd-report/jscpd-report.json`:

```bash
cat jscpd-report/jscpd-report.json
```

Structure:
```json
{
  "statistics": { /* per-file stats */ },
  "duplicates": [
    {
      "format": "typescript" | "rust",
      "lines": number,
      "fragment": "code snippet",
      "firstFile": { "name": "path", "start": line, "end": line },
      "secondFile": { "name": "path", "start": line, "end": line }
    }
  ]
}
```

### 3. Categorize Duplicates

For each duplicate, determine:

#### A. Duplicate Type

**Business Logic** - Complex algorithms, data processing, workflows:
- Multiple conditional branches
- Data transformations
- Error handling patterns
- State management logic

**Component Patterns** - React/UI patterns that might be intentional:
- Event handlers
- useEffect patterns
- Form validation
- Hook usage patterns

**Utility Functions** - Helper functions:
- String manipulation
- Array operations
- Object utilities
- Data formatting

**Type Definitions** - TypeScript types/interfaces:
- Interface definitions
- Type aliases
- Zod schemas

**Setup/Configuration** - Initialization code:
- Test setup
- Config objects
- Constants

#### B. Scope

**Same File Duplication**:
- Duplicate appears in the same file
- Recommendation: Extract to private helper function
- Risk: Medium (local refactoring)

**Cross-File Duplication**:
- Duplicate spans multiple files
- Recommendation: Extract to shared module
- Risk: Higher (affects multiple files)

#### C. Risk Assessment

**High Risk** (needs careful review):
- Business logic (>15 lines)
- Complex conditionals
- Error handling
- State mutations
- Database operations

**Medium Risk** (likely should refactor):
- Utility functions (10-15 lines)
- Data transformations
- Validation logic
- API calls

**Low Risk** (might be intentional):
- Simple patterns (<10 lines)
- Component boilerplate
- Type definitions
- Test setup

#### D. Language-Specific Context

**Rust Duplicates**:
- Check if in `src-tauri/src/commands/` (command handlers - might share patterns)
- Check if in `src-tauri/src/models/` (model methods - might be intentional)
- Check for error handling patterns (might be standard idioms)

**TypeScript Duplicates**:
- Check if in `src/components/` (component patterns - might be intentional)
- Check if in `src/hooks/` (hook patterns - might be intentional)
- Check if in `src/lib/` (business logic - likely should extract)

### 4. Present Findings

Group duplicates by category and present systematically:

```markdown
# Duplicate Code Review

Found X duplicates across Y files

## High Priority - Business Logic Duplication

### Duplicate #1: Database Connection Pattern
- **Type**: Business Logic
- **Scope**: Cross-file (2 files)
- **Risk**: High
- **Lines**: 23 lines (116 tokens)
- **Locations**:
  - `src-tauri/src/commands/project.rs:175-194`
  - `src-tauri/src/commands/project.rs:150-169`
- **Code Preview**:
  ```rust
  for collection in &mut collections {
      if let Ok(json_schema) =
          load_json_schema_for_collection(&project_path, &collection.name)
      {
          debug!("...");
          collection.json_schema = Some(json_schema);
      }
  }
  ```
- **Analysis**: Nearly identical collection processing logic appears twice in the same file
- **Recommendation**: Extract to `process_collection_schemas(collections, project_path)` helper function
- **Confidence**: 90% - Clear candidate for extraction

### Duplicate #2: URL Detection Logic
- **Type**: Business Logic
- **Scope**: Same file
- **Risk**: Medium
- **Lines**: 15 lines (145 tokens)
- **Locations**:
  - `src/lib/editor/urls/detection.ts:169-184`
  - `src/lib/editor/urls/detection.ts:150-165`
- **Code Preview**:
  ```typescript
  const match = line.slice(from, to).match(urlRegex)
  if (match) {
    // ... pattern matching logic
  }
  ```
- **Analysis**: Similar URL pattern matching logic repeated
- **Recommendation**: Extract pattern matching to helper function
- **Confidence**: 75% - Could be intentional for different URL types

## Medium Priority - Utility Duplication

### Duplicate #3: Object Merging
...

## Low Priority - Pattern Duplication (Likely Intentional)

### Duplicate #4: copyedit-mode Patterns
- **Type**: Component Pattern
- **Scope**: Same file (copyedit-mode.ts)
- **Risk**: Low
- **Lines**: 12 lines (88 tokens) - appears 5 times
- **Analysis**: Intentional pattern repetition for different editing modes
- **Recommendation**: Keep as-is (pattern consistency more valuable than DRY)
- **Confidence**: 95% - This is intentional design

## Summary Statistics

- **High Risk**: 2 duplicates (should refactor)
- **Medium Risk**: 3 duplicates (review recommended)
- **Low Risk**: 8 duplicates (likely intentional)
- **Total Lines**: ~150 lines of duplicated code
```

### 5. Interactive Review

For each **High** and **Medium** risk duplicate, use AskUserQuestion:

```typescript
{
  questions: [{
    question: "Should we refactor the 'Database Connection Pattern' duplicate?",
    header: "Refactor?",
    multiSelect: false,
    options: [
      {
        label: "Yes, extract now",
        description: "I'll create a helper function and refactor both locations"
      },
      {
        label: "Add to backlog",
        description: "Note for future refactoring session"
      },
      {
        label: "Keep as-is",
        description: "This duplication is intentional"
      }
    ]
  }]
}
```

### 6. Execute Refactoring (If Approved)

For "Yes, extract now" selections:

1. **Read both locations** to understand full context
2. **Design extraction**:
   - Function name
   - Parameters
   - Return type
   - Where to place it
3. **Present plan** to user for approval
4. **Execute refactoring**:
   - Create new function/module
   - Update both call sites
   - Verify no functionality change
5. **Run checks**: `pnpm run check:all`

### 7. Document Decisions

For "Keep as-is" decisions, optionally add code comments explaining why duplication is intentional:

```typescript
// Note: This pattern is intentionally duplicated for [reason]
// See: /review-duplicates session YYYY-MM-DD
```

## Intelligence Rules

### When to Keep Duplicates

**KEEP if**:
- shadcn/ui component patterns (consistent API)
- Test setup code (test isolation)
- Type definitions for decoupling (intentional separation)
- <10 lines of simple patterns
- copyedit-mode patterns (mode-specific behavior)
- Error handling idioms in Rust (language conventions)
- Component lifecycle patterns (React conventions)

### When to Extract

**EXTRACT if**:
- Business logic >15 lines
- Appears in 3+ locations
- Complex algorithms
- Data transformation pipelines
- Validation logic
- API integration code

### Where to Extract To

**TypeScript**:
- Business logic → `src/lib/[domain]/[util-name].ts`
- React patterns → `src/hooks/[hook-name].ts`
- Type utilities → `src/types/[util-name].ts`
- Editor utilities → `src/lib/editor/[feature]/[util-name].ts`

**Rust**:
- Command helpers → `src-tauri/src/commands/helpers.rs`
- Model utilities → `src-tauri/src/models/utils.rs`
- Shared logic → `src-tauri/src/utils/[feature].rs`

## Output Format

Always provide:
1. **Summary statistics** (total duplicates, by category)
2. **Prioritized list** (high → medium → low)
3. **Clear recommendations** with confidence levels
4. **Code context** for each duplicate
5. **Interactive decisions** for refactoring

## Important Notes

- **NEVER auto-refactor** - always get explicit user approval
- **Provide context** - show code snippets and explain why it's flagged
- **Be conservative** - when in doubt, mark as "likely intentional"
- **Think architecturally** - suggest proper abstraction, not just DRY
- **Verify assumptions** - read surrounding code to understand context

## After Review

Clean up:
```bash
rm -rf jscpd-report
```

Run quality checks if refactoring was done:
```bash
pnpm run check:all
```
