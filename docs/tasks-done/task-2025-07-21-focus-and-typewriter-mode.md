# Task: Focus and Typewriter Mode

## Focus Mode (Sentence Highlighting)

**Goal**: Current sentence appears normal, everything else is dimmed/greyed out (like iA Writer).

### Technical Approach

**Sentence Detection Strategy**:

- CodeMirror's markdown parser doesn't provide sentence boundaries (it's designed for code, not NLP)
- **Recommended**: Start with simple regex-based detection: `/[.!?]+\s+/g`
- **Optional upgrade**: Use `sbd` library for better sentence boundary detection
- Handle markdown-specific cases (don't treat headers, code blocks as sentences)

**CodeMirror Integration**:

- Use `ViewPlugin` to track cursor position changes in real-time
- Use `StateField` to store current sentence range data
- Use `EditorView.decorations` facet with `Decoration.mark()` to apply styling
- Create two decoration classes: `.cm-sentence-dimmed` and `.cm-sentence-focused`

**Implementation Pattern**:

```javascript
// Track cursor position and update sentence decorations
const focusModePlugin = ViewPlugin.fromClass(
  class {
    update(update) {
      if (update.selectionSet || update.docChanged) {
        // Detect current sentence, update decorations
      }
    }
  }
)
```

### Challenges Solved

- **Performance**: Only recalculate on cursor/content changes
- **Markdown compatibility**: Exclude headers, code blocks, lists from sentence detection
- **Edge cases**: Handle abbreviations, ellipses, quotations properly

## Typewriter Mode (Centered Scrolling)

**Goal**: Current line stays vertically centered as you type (like iA Writer).

### Technical Approach

**Auto-scrolling Implementation**:

- Use `EditorView.scrollIntoView(selection, { y: "center" })` API
- Track cursor line changes via `ViewUpdate.selectionSet`
- **Key insight**: Only scroll when cursor moves to different line (not every character)
- Debounce scroll operations (100-200ms delay) for smooth experience

**Performance Optimizations**:

- Skip scrolling during rapid typing or large text selections
- Use `requestAnimationFrame` for smooth scrolling animations
- Optional: Add `EditorView.scrollMargins` for additional spacing

**Implementation Pattern**:

```javascript
// Auto-scroll to keep current line centered
const typewriterPlugin = ViewPlugin.fromClass(
  class {
    update(update) {
      if (update.selectionSet && this.shouldScroll(update)) {
        this.scheduleScroll(update.view)
      }
    }

    scheduleScroll(view) {
      // Debounced scrolling to center current line
    }
  }
)
```

### Challenges Solved

- **Smooth experience**: Debouncing prevents jarring scroll behavior
- **Performance**: Only scroll on line changes, not character changes
- **User control**: Works well with existing scroll behavior and window resizing

## CSS Gradient Enhancement (Optional)

Add subtle gradients at top/bottom of editor to create fade effect as text scrolls off screen:

```css
.cm-editor.typewriter-mode::before,
.cm-editor.typewriter-mode::after {
  /* Gradient overlays for fade effect */
}
```

## Implementation Priority

1. **Phase 1**: Basic sentence detection with regex + CodeMirror decorations
2. **Phase 2**: Typewriter mode with `scrollIntoView` centering
3. **Phase 3**: Enhanced sentence detection with `sbd` library
4. **Phase 4**: CSS gradient fade effects and polish

## External Dependencies

**Optional**: `sbd` library (~2KB) for improved sentence boundary detection

- Handles edge cases like "Dr. Smith went to the U.S." correctly
- More accurate than regex for complex text
- Can be added later without changing core architecture

This approach leverages CodeMirror's built-in capabilities while avoiding complex custom text parsing, providing a solid foundation for both features.

---

# Step-by-Step Implementation Plan

## Phase 1: Focus Mode Implementation

### Step 1: Create Focus Mode State Management

**File**: `src/store/uiStore.ts`

- Add `focusModeEnabled: boolean` to UIState interface
- Add `toggleFocusMode: () => void` action
- Initialize with `focusModeEnabled: false`

### Step 2: Create Sentence Detection Utility

**File**: `src/lib/editor/sentence-detection.ts` (NEW)

- Implement `detectSentencesInLine()` with regex `/[.!?]+\s+/g`
- Implement `findCurrentSentence()` to locate sentence at cursor
- Implement `shouldExcludeLineFromFocus()` for headers/code blocks/lists
- Handle edge cases and markdown-specific exclusions

### Step 3: Create Focus Mode CodeMirror Extension

**File**: `src/lib/editor/extensions/focus-mode.ts` (NEW)

- Define `toggleFocusMode` StateEffect
- Create `focusModeState` StateField to track enabled state and current sentence
- Create `focusModeDecorations` StateField with `Decoration.mark()` for dimming
- Implement `focusModePlugin` ViewPlugin for coordination
- Export `createFocusModeExtension()` function

### Step 4: Add Focus Mode CSS Styling

**File**: `src/components/editor/Editor.css`

- Add `.cm-focus-dimmed` class using `--editor-color-focusmodeunfocussed-text`
- Add smooth color transitions (0.2s ease-in-out)
- Ensure focused text maintains normal color

### Step 5: Integrate Focus Mode into Editor Extensions

**File**: `src/lib/editor/extensions/createExtensions.ts`

- Add `focusModeEnabled: boolean` to `ExtensionConfig` interface
- Import and conditionally include `createFocusModeExtension()`

### Step 6: Connect UI Store to Editor

**File**: `src/components/editor/Editor.tsx`

- Subscribe to `focusModeEnabled` from `useUIStore`
- Dispatch `toggleFocusMode` effect when state changes
- Update extension config with `focusModeEnabled`

### Step 7: Add Focus Mode Command

**File**: `src/lib/editor/commands/editorCommands.ts`

- Implement `createFocusModeCommand()`
- Add `toggleFocusMode` to `EditorCommandRegistry`

## Phase 2: Typewriter Mode Implementation

### Step 8: Create Typewriter Mode State Management

**File**: `src/store/uiStore.ts`

- Add `typewriterModeEnabled: boolean` to UIState
- Add `toggleTypewriterMode: () => void` action

### Step 9: Create Typewriter Mode CodeMirror Extension

**File**: `src/lib/editor/extensions/typewriter-mode.ts` (NEW)

- Define `toggleTypewriterMode` StateEffect
- Create `typewriterModeState` StateField
- Implement `DebouncedScroller` class with 150ms debounce
- Create `typewriterModePlugin` ViewPlugin to handle line changes
- Use `EditorView.scrollIntoView(pos, { y: 'center' })`
- Export `createTypewriterModeExtension()`

### Step 10: Add Typewriter Mode CSS

**File**: `src/components/editor/Editor.css`

- Add `.typewriter-mode` class with optional fade gradients
- Implement `::before` and `::after` pseudo-elements for top/bottom fades
- Ensure content stays above gradient overlays with z-index

### Step 11: Integrate Typewriter Mode into Editor

**File**: `src/lib/editor/extensions/createExtensions.ts`

- Add `typewriterModeEnabled: boolean` to `ExtensionConfig`
- Conditionally include `createTypewriterModeExtension()`

### Step 12: Connect Typewriter Mode to Editor

**File**: `src/components/editor/Editor.tsx`

- Subscribe to `typewriterModeEnabled` from store
- Dispatch `toggleTypewriterMode` effect on state changes
- Add `typewriter-mode` CSS class conditionally

## Phase 3: Command Integration

### Step 13: Add Commands for Both Modes

**File**: `src/lib/editor/commands/editorCommands.ts`

- Implement `createTypewriterModeCommand()`
- Add both commands to `EditorCommandRegistry`

### Step 14: Add Keyboard Shortcuts

**File**: `src/lib/editor/extensions/keymap.ts`

- Add `mod+shift+f` for focus mode toggle
- Add `mod+shift+t` for typewriter mode toggle

### Step 15: Add Command Palette Integration

**File**: `src/lib/commands/app-commands.ts`

- Create `viewModeCommands` array with both toggle commands
- Add appropriate icons and descriptions
- Include in `getAllCommands()` function

### Step 16: Add Command Context Functions

**File**: `src/lib/commands/command-context.ts`

- Add `toggleFocusMode` and `toggleTypewriterMode` to CommandContext
- Implement functions using custom events

### Step 17: Add Event Listeners for Commands

**File**: `src/components/layout/Layout.tsx`

- Listen for 'toggle-focus-mode' and 'toggle-typewriter-mode' events
- Call appropriate store actions

## Phase 4: Testing and Polish

### Step 18: Write Unit Tests

**File**: `src/lib/editor/__tests__/sentence-detection.test.ts` (NEW)

- Test `detectSentencesInLine()` with various sentence patterns
- Test `shouldExcludeLineFromFocus()` with headers, code blocks, lists
- Test edge cases like abbreviations and complex punctuation

### Step 19: Add Integration Tests

**File**: `src/components/editor/__tests__/focus-typewriter-modes.test.tsx` (NEW)

- Test state toggles work correctly
- Test CSS classes are applied appropriately
- Test modes work together without conflicts

### Step 20: Add Performance Optimizations

**File**: `src/lib/editor/extensions/focus-mode.ts`

- Use `RangeSetBuilder` for efficient decoration building
- Only process visible viewport for better performance
- Cache sentence detection results per line
- Optimize decoration updates

## Phase 5: Documentation and Enhancement

### Step 21: Update Architecture Documentation

**File**: `docs/developer/architecture-guide.md`

- Document Focus Mode implementation and patterns
- Document Typewriter Mode architecture
- Add performance considerations section

### Step 22: Add Enhanced Sentence Detection (Optional)

**File**: `package.json` + `src/lib/editor/sentence-detection.ts`

- Optionally add `sbd` library dependency
- Implement `detectSentencesInLineEnhanced()` with fallback
- Better handling of abbreviations and complex sentences

## Testing Checklist

- [ ] Focus mode toggles correctly and dims non-current sentences
- [ ] Headers, code blocks, lists excluded from focus mode
- [ ] Typewriter mode centers current line smoothly with debouncing
- [ ] Both modes work together without conflicts
- [ ] Keyboard shortcuts (`Cmd+Shift+F`, `Cmd+Shift+T`) function
- [ ] Command palette integration works
- [ ] Performance remains smooth during rapid typing
- [ ] Light and dark themes display correctly
- [ ] State persists during file switches
- [ ] No console errors or memory leaks
- [ ] CSS variables used consistently for theming

## Performance Considerations

1. **Focus Mode**: Only recalculate decorations on cursor/content changes, use viewport optimization
2. **Sentence Detection**: Cache results per line, handle edge cases gracefully
3. **Typewriter Mode**: 150ms debounced scrolling, only scroll on line changes
4. **Memory Management**: Proper cleanup of timeouts, event listeners, and decorations
5. **Decoration Efficiency**: Use `RangeSetBuilder` and process only visible content

This implementation plan follows the existing architectural patterns while providing comprehensive writing mode features comparable to iA Writer.

## Extra Things to do here

- [x] Use the centre icon for focus mode and don't change it to anything else on toggle. The button already shows its current state because it's a toggle component.
- [ ] Can we hide the native scrollbars in the editor window whenever we're doing a programatic scroll in typewriter mode, just briefly enough that they don't show up when the scroll is automatic. They should work normally the rest of the time. If this has performance or timeing issues we don't have to do it.
