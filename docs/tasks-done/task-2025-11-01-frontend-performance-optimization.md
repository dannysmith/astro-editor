# Task: Frontend Performance Optimization

## Overview

Optimize frontend performance by implementing the selector pattern in field components and debouncing expensive operations. This addresses unnecessary re-renders that compound as the application grows in complexity.

## Problem Statement

The application has three critical performance issues causing unnecessary re-renders:

1. **Field Component Render Cascade**: All frontmatter fields re-render when any field changes
   - 10 fields = 10 unnecessary re-renders per keystroke
   - 15 fields = 15 unnecessary re-renders per keystroke
   - Exponential performance degradation as forms grow

2. **StatusBar Re-renders on Every Keystroke**: Word/character count recalculated constantly
   - Unnecessary computation on every keystroke
   - Can cause input lag on slower devices

3. **FrontmatterField Unnecessary Subscription**: Re-renders on every frontmatter change
   - Subscribes to entire object just for array type checking
   - Cascades to child field components

## Context & Architecture Alignment

These issues violate patterns documented in:
- `docs/developer/performance-guide.md` (lines 96-130): Store Subscription Optimization
- `docs/developer/architecture-guide.md` (lines 240-271): The getState() Pattern

The selector pattern is **already established as best practice** in the codebase. This task implements those patterns consistently across field components.

### External File Changes Are Safe

**Important consideration**: Files can change externally (via file watcher), not just through the editor. The selector pattern **handles this correctly**:

```typescript
// With selector pattern
const value = useEditorStore(state => state.frontmatter[name])
```

When the frontmatter object is replaced (whether from user typing OR external file changes), Zustand compares the **selector's return value**. If `frontmatter.title` changes, the title field re-renders. If `frontmatter.date` didn't change, the date field doesn't re-render.

**The selector pattern prevents unnecessary re-renders, not necessary ones.**

## Implementation Plan

### Phase 1: Field Component Optimization (Priority 1 - Highest Impact)

**Affected Components:**
- `src/components/frontmatter/fields/StringField.tsx:24`
- `src/components/frontmatter/fields/DateField.tsx:19`
- `src/components/frontmatter/fields/ArrayField.tsx:20`
- `src/components/frontmatter/fields/ImageField.tsx:28`
- `src/components/frontmatter/fields/EnumField.tsx:27`
- `src/components/frontmatter/fields/ReferenceField.tsx:42`
- `src/components/frontmatter/fields/NumberField.tsx`
- `src/components/frontmatter/fields/TextareaField.tsx`
- `src/components/frontmatter/fields/BooleanField.tsx`
- `src/components/frontmatter/fields/YamlField.tsx`

**Pattern Change:**

```typescript
// ❌ BEFORE - Subscribes to entire frontmatter object
export const StringField: React.FC<StringFieldProps> = ({ name, label, ... }) => {
  const { frontmatter, updateFrontmatterField } = useEditorStore()
  const value = getNestedValue(frontmatter, name)

  return (
    <Input
      value={valueToString(value)}
      onChange={e => updateFrontmatterField(name, e.target.value)}
    />
  )
}

// ✅ AFTER - Only subscribes to specific field value
export const StringField: React.FC<StringFieldProps> = ({ name, label, ... }) => {
  const value = useEditorStore(state => getNestedValue(state.frontmatter, name))
  const updateFrontmatterField = useEditorStore(state => state.updateFrontmatterField)

  return (
    <Input
      value={valueToString(value)}
      onChange={e => updateFrontmatterField(name, e.target.value)}
    />
  )
}
```

**Implementation Steps:**

1. **Start with proof of concept** (2 components):
   - Update `StringField.tsx`
   - Update `DateField.tsx`
   - Test thoroughly to verify:
     - Typing in one field doesn't cause other fields to re-render
     - External file changes still update all fields correctly
     - No regressions in functionality

2. **If POC successful, continue with remaining components:**
   - `ArrayField.tsx`
   - `ImageField.tsx`
   - `EnumField.tsx`
   - `ReferenceField.tsx`
   - `NumberField.tsx`
   - `TextareaField.tsx`
   - `BooleanField.tsx`
   - `YamlField.tsx`

3. **Handle special cases:**
   - For components that need multiple frontmatter values, create multiple selectors
   - For array/object values that might need `shallow` comparison from `zustand/shallow`

**Helper Utility (already exists):**

The `getNestedValue` function is already being used in the codebase for nested field paths (e.g., `author.name`). Verify it handles edge cases properly:

```typescript
// Should already exist in utilities
export const getNestedValue = (obj: any, path: string): any => {
  if (!path || !obj) return undefined
  if (!path.includes('.')) return obj[path]
  return path.split('.').reduce((acc, part) => acc?.[part], obj)
}
```

### Phase 2: StatusBar Optimization (Priority 2 - Quick Win)

**File:** `src/components/layout/StatusBar.tsx:7`

**Current Implementation:**
```typescript
// ❌ BAD - Re-renders on every keystroke
const { currentFile, editorContent, isDirty } = useEditorStore()

const wordCount = editorContent
  .split(/\s+/)
  .filter(word => word.length > 0).length
const charCount = editorContent.length
```

**Optimized Implementation:**
```typescript
// ✅ GOOD - Debounced calculation
const currentFile = useEditorStore(state => state.currentFile)
const isDirty = useEditorStore(state => state.isDirty)
const editorContent = useEditorStore(state => state.editorContent)

const [wordCount, setWordCount] = useState(0)
const [charCount, setCharCount] = useState(0)

useEffect(() => {
  const timer = setTimeout(() => {
    const words = editorContent.split(/\s+/).filter(w => w.length > 0).length
    setWordCount(words)
    setCharCount(editorContent.length)
  }, 300) // Debounce by 300ms

  return () => clearTimeout(timer)
}, [editorContent])

return (
  <div>
    <span>{wordCount} words</span>
    <span>{charCount} characters</span>
  </div>
)
```

**Implementation Steps:**

1. Update `StatusBar.tsx` with debounced calculation
2. Test that word count updates smoothly without lag
3. Verify it still updates when switching files

### Phase 3: FrontmatterField Optimization (Priority 3)

**File:** `src/components/frontmatter/fields/FrontmatterField.tsx:29`

**Current Implementation:**
```typescript
// ❌ BAD - Subscribes to entire frontmatter object
const { frontmatter } = useEditorStore()

// Later used to check if value is array (line 67)
const shouldUseArrayField = !isArrayReference &&
  !isComplexArray &&
  (/* ... */ ||
    (!field &&
      Array.isArray(frontmatter[name]) &&
      frontmatter[name].every((item: unknown) => typeof item === 'string')))
```

**Optimized Implementation:**
```typescript
// ✅ GOOD - Only subscribe to specific field
const fieldValue = useEditorStore(state => state.frontmatter?.[name])

const shouldUseArrayField = useMemo(() => {
  return !isArrayReference &&
    !isComplexArray &&
    (/* ... */ ||
      (!field &&
        Array.isArray(fieldValue) &&
        fieldValue.every((item: unknown) => typeof item === 'string')))
}, [isArrayReference, isComplexArray, field, fieldValue])
```

**Implementation Steps:**

1. Update `FrontmatterField.tsx` to use selector pattern
2. Wrap the array type check in `useMemo` for clarity
3. Test with various field types to ensure correct rendering

## Testing Strategy

### Unit Testing

For each updated component, verify:
- Component only re-renders when its specific field value changes
- External file changes (simulated) still trigger appropriate re-renders
- No TypeScript errors
- All existing functionality works

### Integration Testing

1. **Create test form with 15 fields**
2. **Profile with React DevTools** before and after fixes
3. **Measure render counts** when editing each field
4. **Expected improvements**:
   - Field edits: 15+ renders → 1-2 renders
   - Typing in editor: StatusBar stops re-rendering on every keystroke
   - Overall: 90%+ reduction in unnecessary re-renders

### Manual Testing Checklist

- [ ] Type in one field - other fields don't re-render
- [ ] Edit file externally - all relevant fields update
- [ ] Switch between files - frontmatter updates correctly
- [ ] Word count in StatusBar updates smoothly (300ms delay is acceptable)
- [ ] Array fields work correctly
- [ ] Nested fields (e.g., `author.name`) work correctly
- [ ] Image fields with preview work correctly
- [ ] Reference fields work correctly
- [ ] No console errors or warnings
- [ ] No performance regressions in editor typing
- [ ] No performance regressions in file switching

## Expected Performance Improvements

- **Field editing**: 90%+ reduction in re-renders per keystroke
- **StatusBar**: Eliminates constant re-renders during typing
- **Overall**: Noticeably smoother editing experience, especially with complex frontmatter

## Implementation Notes

### Incremental Approach

**Start with Phase 1, Steps 1-2 (proof of concept)**:
- Implement selector pattern in `StringField` and `DateField`
- Measure impact with React DevTools Profiler
- Validate approach before continuing

If POC is successful and shows clear improvement, proceed with remaining components.

### Potential Edge Cases

1. **Complex field values**: Fields with array/object values might need `shallow` comparison
   ```typescript
   import { shallow } from 'zustand/shallow'
   const value = useEditorStore(
     state => state.frontmatter[name],
     shallow
   )
   ```

2. **Multi-value dependencies**: If a field needs multiple frontmatter values:
   ```typescript
   const title = useEditorStore(state => state.frontmatter.title)
   const slug = useEditorStore(state => state.frontmatter.slug)
   ```

3. **Computed values**: Use `useMemo` for derived values to prevent unnecessary recalculation

## References

- **Analysis Document**: `FRONTEND-PERFORMANCE-ISSUES.md`
- **Architecture Guide**: `docs/developer/architecture-guide.md` (lines 240-271)
- **Performance Guide**: `docs/developer/performance-guide.md` (lines 96-130)
- **Store Subscription Optimization**: `docs/developer/performance-guide.md` (lines 92-130)

## Success Criteria

- [ ] All field components use selector pattern for frontmatter access
- [ ] StatusBar uses debounced word count calculation
- [ ] FrontmatterField uses selector pattern
- [ ] React DevTools Profiler shows 90%+ reduction in field re-renders
- [ ] No functional regressions
- [ ] All existing tests pass
- [ ] Manual testing checklist complete
- [ ] Code follows existing patterns and style
- [ ] `pnpm run check:all` passes

## Estimated Effort

**Total**: 4-6 hours
- Phase 1 (POC): 1-2 hours
- Phase 1 (Full): 2-3 hours
- Phase 2: 30 minutes
- Phase 3: 1 hour
- Testing: 1 hour

## Notes

- This is a **refactoring task** - no new features, no breaking changes
- The selector pattern is already established in the codebase - this implements it consistently
- Start small (POC), measure, then proceed
- External file changes will continue to work correctly with selector pattern
