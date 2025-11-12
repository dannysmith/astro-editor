# Task: Hanging Headers (iA Writer Style)

https://github.com/dannysmith/astro-editor/issues/3

## Feature Overview

Implement visual styling for markdown headings where hash marks (`#`, `##`, etc.) appear in the left margin rather than inline with the heading text. This creates a cleaner, more elegant appearance similar to iA Writer's editor.

**Example:**

Current behavior:

```
# My Heading
Body text starts here
```

Desired behavior (visual only - no functional change):

```
#  My Heading      ← hash mark in left margin, text aligns with body
   Body text starts here
```

This is purely a visual enhancement - no changes to how markdown is parsed, saved, or exported.

## Requirements

### 1. Visual Behavior

- Hash marks (`#` through `######`) should appear in the left margin
- Heading text should align perfectly with body text (left edge)
- Only affects ATX-style headings (hash syntax)
- Does NOT affect Setext-style headings (underline syntax)
- Works in both light and dark mode
- Maintains existing heading colors and typography

### 2. Viewport Responsiveness

- **Only enable when editor is wide enough** to comfortably accommodate level 4 headings (`####`) in the margin without appearing cramped
- On narrow viewports, fall back to current behavior (inline hash marks)
- Transition should be handled via media query for clean, performant switching

### 3. Syntax Specificity

Must differentiate between:

**ATX Headings** (should get hanging treatment):

```
# Heading 1
## Heading 2
### Heading 3
```

**Setext Headings** (should NOT get hanging treatment):

```
Heading 1
=========

Heading 2
---------
```

## Technical Approach

### Simplified Implementation Discovery

After initial investigation and manual testing in DevTools, we discovered a **dramatically simpler approach**:

**Key Insight**: Applying `text-indent: -4.8em` to heading lines works perfectly without requiring left padding on all content. The existing auto margins on `.cm-content` provide sufficient space for hash marks to hang into.

### Why This Works

- `.cm-content` is centered with `margin: 0 auto` (theme.ts line 29)
- Auto margins provide horizontal space on both sides
- Negative `text-indent` pulls the first line (hash marks) into the existing left margin
- Heading text remains at the normal left edge, perfectly aligned with body text
- No need to shift all content to accommodate the feature

### Implementation Strategy

1. **Line Decorations**: Add CSS class to ATX heading lines (same as focus/typewriter mode pattern)
2. **CSS `text-indent`**: Apply negative indent per heading level - that's it!
3. **Container Queries**: Use `@container` to detect actual editor width (not viewport)
4. **Graceful Degradation**: Wrap in `@supports` - if unsupported, feature disabled, current behavior preserved

**Result**: ~50 lines of TypeScript + ~15 lines of CSS

### AST Node Filtering

CodeMirror's markdown parser provides perfect discrimination:

- ATX headings: `ATXHeading1` through `ATXHeading6`
- Setext headings: `SetextHeading1` and `SetextHeading2`

A regex pattern `/^ATXHeading[1-6]$/` will match ONLY ATX headings with zero ambiguity.

## Implementation Details

### 1. New Extension File

**File**: `src/lib/editor/extensions/hanging-headers.ts`

```typescript
import { StateField } from '@codemirror/state'
import { EditorView, Decoration, DecorationSet } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import type { Range } from '@codemirror/state'

export const hangingHeadersExtension = StateField.define<DecorationSet>({
  create(state) {
    return buildHeaderDecorations(state)
  },

  update(decorations, tr) {
    if (tr.docChanged) {
      return buildHeaderDecorations(tr.state)
    }
    return decorations.map(tr.changes)
  },

  provide: f => EditorView.decorations.from(f),
})

function buildHeaderDecorations(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = []

  syntaxTree(state).iterate({
    enter(node) {
      // Only process ATX headings (not Setext)
      if (/^ATXHeading[1-6]$/.test(node.name)) {
        const line = state.doc.lineAt(node.from)
        const level = node.name.slice(-1) // "1" through "6"

        decorations.push(
          Decoration.line({
            class: `cm-hanging-header cm-hanging-header-${level}`,
          }).range(line.from)
        )
      }
    },
  })

  return Decoration.set(decorations, true)
}
```

### 2. CSS Styling

**File**: `src/components/editor/Editor.css`

Apply negative `text-indent` to heading lines, using container queries for accurate editor width detection:

```css
/* Hanging Headers - Only when editor container is wide enough */
@supports (container-type: inline-size) {
  @container editor (min-width: 875px) {
    /* Adjust indent per heading level - hash marks hang into left margin */
    .cm-line.cm-hanging-header-1 {
      text-indent: -0.8em;
    } /* # + space */
    .cm-line.cm-hanging-header-2 {
      text-indent: -1.6em;
    } /* ## + space */
    .cm-line.cm-hanging-header-3 {
      text-indent: -2.4em;
    } /* ### + space */
    .cm-line.cm-hanging-header-4 {
      text-indent: -3.2em;
    } /* #### + space */
    .cm-line.cm-hanging-header-5 {
      text-indent: -4em;
    } /* ##### + space */
    .cm-line.cm-hanging-header-6 {
      text-indent: -4.8em;
    } /* ###### + space */
  }
}
```

**Why Container Queries**:

- Editor width can vary based on sidebar/panel state
- Container queries detect actual editor width, not viewport width
- More accurate than media queries for resizable layouts

**Graceful Degradation**:

- `@supports (container-type: inline-size)` detects browser support
- If unsupported: CSS doesn't apply, headings render normally (current behavior)
- No fallback needed - graceful by design

**Why 875px**:

- Corresponds to "Medium Width" typography breakpoint
- Sufficient space for H4 (`####`) without cramping
- Below this, hanging headers disabled automatically

### 3. Extension Registration

**File**: `src/lib/editor/extensions/createExtensions.ts`

Import and add to extensions array:

```typescript
import { hangingHeadersExtension } from './hanging-headers'

export const createExtensions = (config: ExtensionConfig) => {
  const extensions = [
    // ... existing extensions
    hangingHeadersExtension,
    // ... rest
  ]
}
```

## Font & Alignment Considerations

### Known Values

The editor uses fixed typography (user cannot change):

- **Font**: iA Writer Duo Variable
- **Weight**: 700 (bold) for hash marks
- **Size**: Controlled by responsive CSS (16.5px → 24px)

### em Unit Scaling

- `em` units are relative to current `font-size`
- As font size scales across breakpoints, `em` values scale proportionally
- Hash mark width scales identically
- **Result**: Ratios remain constant - one `text-indent` value works at all sizes

### Initial Values (Estimates)

Starting with typical proportional font metrics:

- Single hash `#` + space ≈ 0.8em
- Each additional hash adds ≈ 0.8em

**These are estimates** - will need empirical testing and fine-tuning.

### Testing for Perfect Alignment

1. Create test document with all heading levels (H1-H6) + body text
2. Test at each responsive typography breakpoint:
   - Tiny (< 440px): hanging headers disabled
   - Small (440px): hanging headers disabled
   - Medium (875px): hanging headers **enabled**
   - Large (1250px): hanging headers **enabled**
   - Huge (1660px): hanging headers **enabled**
3. Verify heading text left edge aligns exactly with body text
4. Adjust `text-indent` values if needed (likely ±0.05em adjustments)
5. Test with long wrapped headings
6. Test with resizable panels (sidebar open/closed)

### If Fine-Tuning Needed

Adjust individual level indents:

```css
@container editor (min-width: 875px) {
  .cm-line.cm-hanging-header-1 {
    text-indent: -0.82em;
  } /* Adjusted from -0.8em */
  /* ... etc */
}
```

Or add breakpoint-specific overrides if font rendering varies:

```css
@container editor (min-width: 1660px) {
  .cm-line.cm-hanging-header-1 {
    text-indent: -0.83em;
  }
}
```

## Container Query Strategy

### Why Container Queries (Not Media Queries)

**Problem with media queries**: Editor width varies based on panel state (sidebar, frontmatter)

- Viewport 1200px + sidebar open → Editor only 400px wide (too narrow for hanging headers)
- Viewport 900px + panels closed → Editor 850px wide (plenty of room)

**Solution**: Container queries detect actual editor width, not viewport width.

**Browser Support**: The editor already declares `container-type: inline-size` (theme.ts line 17), indicating container query readiness.

### Why 875px Minimum?

At 875px editor width:

- Font size: 18px (or larger at wider viewports)
- Sufficient horizontal space for H4 (`####`) + margin without cramping
- Matches "Medium Width" typography breakpoint philosophy

### Behavior Across Editor Widths

| Editor Width | Font Size | Hanging Headers |
| ------------ | --------- | --------------- |
| < 875px      | Varies    | Disabled        |
| 875px+       | 18-24px   | **Enabled**     |

### Graceful Degradation

```css
@supports (container-type: inline-size) {
  /* Feature only applies if browser supports container queries */
  @container editor (min-width: 875px) {
    /* Hanging headers CSS */
  }
}
```

**If unsupported**: CSS block doesn't apply, headings render with current inline behavior. No fallback needed.

## Testing Strategy

### Unit Tests

```typescript
// Test file: src/lib/editor/extensions/hanging-headers.test.ts

describe('Hanging Headers Extension', () => {
  it('decorates ATX headings with correct level classes', () => {
    const state = EditorState.create({
      doc: '# H1\n## H2\n### H3',
      extensions: [hangingHeadersExtension],
    })

    const decorations = state.field(hangingHeadersExtension)
    expect(decorations.size).toBe(3)
    // Verify classes: cm-hanging-header-1, cm-hanging-header-2, cm-hanging-header-3
  })

  it('ignores Setext headings', () => {
    const state = EditorState.create({
      doc: 'Heading\n=======\n',
      extensions: [hangingHeadersExtension],
    })

    const decorations = state.field(hangingHeadersExtension)
    expect(decorations.size).toBe(0)
  })

  it('handles empty headings', () => {
    const state = EditorState.create({
      doc: '###\n',
      extensions: [hangingHeadersExtension],
    })

    const decorations = state.field(hangingHeadersExtension)
    expect(decorations.size).toBe(1)
  })

  it('handles mixed ATX and Setext headings', () => {
    const state = EditorState.create({
      doc: '# ATX H1\n\nSetext H1\n=========\n\n## ATX H2',
      extensions: [hangingHeadersExtension],
    })

    const decorations = state.field(hangingHeadersExtension)
    expect(decorations.size).toBe(2) // Only ATX headings
  })
})
```

### Manual Testing

1. **Visual alignment**: Create document with all heading levels + body text, verify perfect alignment
2. **Responsive behavior**: Test at all 5 viewport breakpoints
3. **Wrapped headings**: Test very long heading text that wraps to multiple lines
4. **Empty headings**: Test `###` with no text
5. **Dark mode**: Verify hash marks have proper contrast
6. **Focus mode interaction**: Ensure no conflicts with focus mode dimming
7. **Copy/paste**: Verify hash marks are included when copying
8. **Editing**: Verify cursor behavior feels natural when editing headings

## Edge Cases & Considerations

### 1. Wrapped Long Headings

**Behavior**: `text-indent` only affects first line by default in CSS
**Test**: Very long heading that wraps to 2-3 lines
**Expected**: Hash marks on first line only, subsequent lines align with heading text

### 2. Empty Headings

**Example**: `###` with no text following
**Expected**: Still gets decoration, hash marks appear in margin

### 3. Trailing Hash Marks

**Example**: `## Heading ##` (some editors support this)
**Expected**: Works fine - we only care about leading hashes, decoration applies to whole line

### 4. Selection Behavior

**Consideration**: Hash marks visually appear to the left due to negative indent
**Expected**: Selection feels natural - hash marks are still part of the line
**Test**: Click and drag to select heading, verify hash marks are included

### 5. Copy/Paste

**Expected**: Hash marks are still in the document content, so they copy normally
**Verification**: Test copying a heading and pasting into another editor

### 6. Dark Mode

**Handled by**: Existing `--editor-color-heading` CSS custom property
**Verification**: Test visual contrast in dark mode

### 7. Focus Mode Interaction

**Consideration**: Focus mode dims text outside current sentence
**Expected**: Hash marks dim along with heading text when unfocused
**Verification**: Enable focus mode and verify dimming works correctly

## Risks & Mitigations

| Risk                                      | Impact   | Mitigation                                          |
| ----------------------------------------- | -------- | --------------------------------------------------- |
| Imperfect alignment across viewport sizes | Medium   | Empirical testing + fine-tuning em values           |
| Font loading delays cause flash           | Low      | CSS applies after font loads, no FOUC               |
| Wrapped headings look odd                 | Low      | CSS text-indent handles this natively               |
| Conflicts with other extensions           | Low      | Line decorations don't interfere with marks/widgets |
| Performance with many headings            | Very Low | Similar to focus mode - tested at scale             |
| User confusion                            | Low      | Matches familiar iA Writer behavior                 |

## Implementation Checklist

- [ ] Create `src/lib/editor/extensions/hanging-headers.ts`
- [ ] Add CSS rules to `src/components/editor/Editor.css`
- [ ] Import and register in `src/lib/editor/extensions/createExtensions.ts`
- [ ] Write unit tests in `hanging-headers.test.ts`
- [ ] Create test document with all heading levels
- [ ] Test visual alignment at all viewport breakpoints
- [ ] Measure and fine-tune `text-indent` values
- [ ] Test wrapped long headings
- [ ] Test empty headings
- [ ] Test mixed ATX/Setext documents
- [ ] Verify dark mode appearance
- [ ] Test with focus mode enabled
- [ ] Test copy/paste behavior
- [ ] Run `/check` for quality gates
- [ ] Manual testing at all responsive breakpoints

## Success Criteria

- ✅ ATX heading text aligns perfectly with body text when editor ≥875px wide
- ✅ Hash marks appear cleanly in left margin without cramping
- ✅ All heading levels (H1-H6) work correctly
- ✅ Setext headings are completely unaffected
- ✅ Feature disabled when editor < 875px wide (via container query)
- ✅ Graceful degradation if container queries unsupported
- ✅ Works with resizable panels (sidebar/frontmatter open/closed)
- ✅ No performance degradation with documents containing 100+ headings
- ✅ Works correctly in both light and dark mode
- ✅ No conflicts with focus mode, typewriter mode, or other extensions
- ✅ All tests pass
- ✅ User experience feels polished and intentional, matching iA Writer quality

---

## Appendix: Alternative Approach (Archived)

_This section preserves our initial investigation in case the simplified approach encounters issues._

### Initial Approach: Left Padding + Text Indent

Our first plan involved adding left padding to `.cm-content` to create margin space, then using negative `text-indent` to pull hash marks into that padding.

**Why we moved away from this**:

- Manual testing revealed negative `text-indent` works without additional padding
- Existing auto margins on `.cm-content` provide sufficient space
- Simpler implementation with fewer CSS changes

**If simplified approach fails**, consider this alternative:

```css
@container editor (min-width: 875px) {
  /* Add left padding to entire content area */
  .cm-content {
    padding-left: 3em;
  }

  /* Then apply negative indent to headings */
  .cm-line.cm-hanging-header-1 {
    text-indent: -0.8em;
  }
  .cm-line.cm-hanging-header-2 {
    text-indent: -1.6em;
  }
  /* ... etc */
}
```

**Trade-off**: All text shifts 3em to the right, requiring careful centering adjustments.

### Alternative Approaches Investigated But Rejected

**Widget Decorations**: Replace hash marks with widgets positioned in margin

- ❌ Too complex (~150 lines vs ~50)
- ❌ Widget creation/destruction overhead
- ❌ Selection behavior complications

**DOM Manipulation**: ViewPlugin directly manipulates DOM

- ❌ Fights CodeMirror's rendering model
- ❌ Fragile, breaks with updates
- ❌ Performance issues

**CSS Transform**: Apply `translateX(-1.5em)` to heading lines

- ⚠️ Visual offset might complicate selection
- ⚠️ Unclear interaction with wrapped lines
- ⚠️ `text-indent` is more semantically appropriate for this use case
