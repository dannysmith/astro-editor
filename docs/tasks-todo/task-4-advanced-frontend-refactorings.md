# Advanced Frontend Refactorings

## Overview

Refactor complex frontend code to improve maintainability, performance, and testability. This task focuses on the copyedit mode POS highlighting system, which is a user-facing feature with significant complexity.

**Total Time:** 1 week

**Impact:**
- 50%+ reduction in code duplication
- Easier to add new highlight types
- Improved debugging when highlighting fails
- Better separation of concerns

**Dependencies:**
- Task 1 (Foundation established)
- Task 2 (Test coverage for safety)
- Task 3 (Rust improvements complete)

---

## Item 1: Decompose createPosDecorations (copyedit-mode.ts)

**Priority:** MEDIUM
**File:** `src/lib/editor/extensions/copyedit-mode.ts`
**Lines:** 130-400+ (estimated)
**Complexity:** ~270 lines, handles all POS highlighting
**Time:** 5-7 days
**Risk:** MEDIUM (user-facing feature, performance-sensitive)

### Current Issues

The `createPosDecorations` function:
- Processes nouns, verbs, adjectives, adverbs, and conjunctions in one massive function
- Nearly identical logic repeated for each part of speech (5x duplication)
- Hard to add new highlight types
- Difficult to optimize performance for specific POS types
- Hard to debug when specific highlighting fails

### Proposed Solution

Extract per-POS-type processors:

```typescript
function processNounDecorations(
  doc: Text,
  text: string,
  cursor: number,
  processedRanges: Set<string>
): Decoration[]

function processVerbDecorations(
  doc: Text,
  text: string,
  cursor: number,
  processedRanges: Set<string>
): Decoration[]

// Similar for adjectives, adverbs, conjunctions

function createDecorationsForMatches(
  matches: Array<{ text: string; offset: number }>,
  className: string,
  validator?: (match: { text: string; offset: number }) => boolean
): Decoration[]
```

### Implementation Steps

1. **Extract common validation logic**:
   ```typescript
   // Near top of file, after imports
   function validateMatch(
     match: { text: string; offset: number },
     cursor: number,
     processedRanges: Set<string>,
     doc: Text
   ): boolean {
     const from = match.offset
     const to = match.offset + match.text.length

     // Check if already processed
     const key = `${from}-${to}`
     if (processedRanges.has(key)) return false

     // Check if in cursor range
     if (cursor >= from && cursor <= to) return false

     // Check if in code block, link, frontmatter, etc.
     const line = doc.lineAt(from)
     if (isInExcludedContext(line, from)) return false

     return true
   }

   function isInExcludedContext(line: Line, pos: number): boolean {
     const lineText = line.text
     // Check for code blocks, links, frontmatter
     return (
       lineText.includes('```') ||
       lineText.includes('](') ||
       lineText.startsWith('---')
     )
   }
   ```

2. **Create shared decoration builder**:
   ```typescript
   function createDecorationsForMatches(
     doc: Text,
     matches: Array<{ text: string; offset: number }>,
     className: string,
     cursor: number,
     processedRanges: Set<string>
   ): Decoration[] {
     const decorations: Decoration[] = []

     for (const match of matches) {
       if (!validateMatch(match, cursor, processedRanges, doc)) {
         continue
       }

       const from = match.offset
       const to = match.offset + match.text.length
       const key = `${from}-${to}`

       decorations.push(
         Decoration.mark({
           class: className,
           // ... other attributes
         }).range(from, to)
       )

       processedRanges.add(key)
     }

     return decorations
   }
   ```

3. **Extract noun processor**:
   ```typescript
   function processNounDecorations(
     doc: Text,
     text: string,
     cursor: number,
     processedRanges: Set<string>
   ): Decoration[] {
     const matches = findNounMatches(text)
     return createDecorationsForMatches(
       doc,
       matches,
       'cm-copyedit-noun',
       cursor,
       processedRanges
     )
   }

   function findNounMatches(text: string): Array<{ text: string; offset: number }> {
     // Use compromise.js or regex to find nouns
     // Return matches with offsets
   }
   ```

4. **Extract verb, adjective, adverb, conjunction processors** (similar pattern):
   ```typescript
   function processVerbDecorations(/* ... */) { /* ... */ }
   function processAdjectiveDecorations(/* ... */) { /* ... */ }
   function processAdverbDecorations(/* ... */) { /* ... */ }
   function processConjunctionDecorations(/* ... */) { /* ... */ }
   ```

5. **Refactor main `createPosDecorations`**:
   ```typescript
   function createPosDecorations(
     doc: Text,
     cursor: number,
     settings: CopyeditSettings
   ): DecorationSet {
     const text = doc.toString()
     const processedRanges = new Set<string>()
     let decorations: Decoration[] = []

     // Process each POS type based on settings
     if (settings.highlightNouns) {
       decorations.push(...processNounDecorations(doc, text, cursor, processedRanges))
     }

     if (settings.highlightVerbs) {
       decorations.push(...processVerbDecorations(doc, text, cursor, processedRanges))
     }

     if (settings.highlightAdjectives) {
       decorations.push(...processAdjectiveDecorations(doc, text, cursor, processedRanges))
     }

     if (settings.highlightAdverbs) {
       decorations.push(...processAdverbDecorations(doc, text, cursor, processedRanges))
     }

     if (settings.highlightConjunctions) {
       decorations.push(...processConjunctionDecorations(doc, text, cursor, processedRanges))
     }

     return Decoration.set(decorations.sort((a, b) => a.from - b.from))
   }
   ```

### Testing Strategy

**Before refactoring** - Benchmark performance:
```typescript
// Add temporary performance logging
const start = performance.now()
createPosDecorations(doc, cursor, settings)
const end = performance.now()
console.log(`POS decorations took ${end - start}ms`)
```

Test with:
- Small document (100 words)
- Medium document (500 words)
- Large document (1000+ words)

Record baseline numbers.

**After refactoring** - Performance testing:
```bash
# Run the same benchmarks
pnpm test copyedit-mode
```

Compare numbers - should be within 10% of baseline.

**Manual testing checklist**:
- [ ] All POS types still highlight correctly
- [ ] No highlighting in code blocks
- [ ] No highlighting in links
- [ ] No highlighting in frontmatter
- [ ] Cursor position excludes highlighting
- [ ] Settings toggles work (nouns, verbs, etc.)
- [ ] Performance is acceptable on large documents

**Edge cases to test**:
- Document with many code blocks
- Document with many links
- Document with long frontmatter
- Mixed content (prose + code + tables)
- Very long sentences
- Nested markdown structures

### Expected Benefits

- 50%+ reduction in code duplication
- Easy to add new highlight types (just add new processor)
- Individual processors can be optimized independently
- Clearer intent for each highlighting type
- Easier to debug when specific POS highlights fail
- Better separation of concerns

### Quality Check

```bash
pnpm test copyedit-mode
pnpm run check:all
```

---

## Overall Quality Gates

### During Implementation

```bash
# Run TypeScript checks
pnpm run check:ts

# Run tests in watch mode
pnpm test copyedit-mode
```

### Before Completing

```bash
# Run all tests
pnpm run test:run

# Performance check (no regressions)
# Run manual performance benchmarks

# Full quality check
pnpm run check:all

# Manual smoke testing
pnpm run dev
# Test copyedit mode with various documents
```

---

## Success Criteria

### Task Complete When

- [ ] `createPosDecorations` decomposed into focused functions
- [ ] Common validation logic extracted
- [ ] Per-POS-type processors implemented
- [ ] All POS highlighting still works correctly
- [ ] Performance within 10% of baseline
- [ ] All manual edge cases tested and passing
- [ ] Code duplication reduced by >50%
- [ ] All tests passing
- [ ] `pnpm run check:all` succeeds
- [ ] Manual testing confirms functionality

---

## Implementation Approach

1. **Start with extraction** - Don't change behavior, just extract
2. **Add tests** - For new validation and decoration builder functions
3. **Verify performance** - Benchmark before and after
4. **Manual testing** - Comprehensive edge case testing
5. **Document patterns** - If new patterns emerge, update CLAUDE.md

---

## Notes

- **Total effort:** 5-7 days (~1 week)
- **User-facing feature:** Requires extra care and testing
- **Performance-sensitive:** Benchmark thoroughly
- **High impact:** Significant reduction in duplication
- **Foundation for future:** Easy to add new highlight types
- **Consider unit tests:** For validation and decoration builder functions

---

## Alternative Approach (If Time Constrained)

If this refactoring proves too complex or risky:

1. **Extract validation only** - Just the `validateMatch` and `isInExcludedContext` functions
2. **Leave processors inline** - Keep the POS-specific logic in main function
3. **Document pattern** - Note in comments that extraction would be beneficial

This provides some benefit (reduced duplication of validation logic) with less risk.

---

**Created:** 2025-11-01
**Status:** Ready for implementation (after Tasks 1-3 complete)
