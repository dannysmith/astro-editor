# Task: Refactor God Hook

**Hook:** `src/hooks/useLayoutEventListeners.ts` (486 lines)

## Context

This hook has grown into a monolith that violates the Single Responsibility Principle by handling too many disparate concerns. Multiple code reviews identified this as a maintainability issue requiring decomposition.

**Source Reviews:**
- `docs/reviews/2025-staff-engineering-review.md:345-420` (Staff Engineer Review)
- `docs/reviews/code-review-2025-10-24.md:15-28` (Code Review)
- `docs/reviews/2025-10-24-duplication-review.md:48-51, 106-108, 123-126` (Duplication Review)
- `docs/reviews/analyysis-of-reviews.md:113-119` (Analysis Summary)

## Current Responsibilities

The hook currently manages 8 distinct concerns:

1. **Keyboard Shortcuts** (7 shortcuts via `useHotkeys`):
   - `mod+s`: Save file
   - `mod+1`: Toggle sidebar
   - `mod+2`: Toggle frontmatter panel
   - `mod+n`: Create new file
   - `mod+w`: Close current file
   - `mod+comma`: Open preferences
   - `mod+0`: Focus editor

2. **DOM Custom Events** (11+ listeners via `window.addEventListener`):
   - `open-preferences`
   - `create-new-file`
   - `toggle-focus-mode`
   - `toggle-typewriter-mode`
   - `toggle-highlight-nouns/verbs/adjectives/adverbs/conjunctions` (5 events)
   - `toggle-all-highlights`
   - `file-opened`

3. **Tauri Menu Events** (15 listeners via `listen()`):
   - `menu-open-project`
   - `menu-save`
   - `menu-toggle-sidebar`
   - `menu-toggle-frontmatter`
   - `menu-new-file`
   - `menu-format-bold/italic/link` (3 events)
   - `menu-format-h1/h2/h3/h4/paragraph` (5 events)
   - `menu-preferences`

4. **Editor Focus State Management**:
   - Tracks `window.isEditorFocused`
   - Updates format menu enabled/disabled state based on focus

5. **Project Initialization**:
   - Loads persisted project on mount

6. **Rust Toast Bridge**:
   - Initializes bi-directional toast communication from Rust backend

7. **Preferences Dialog State**:
   - Manages dialog open/closed state
   - Restores editor focus when dialog closes

8. **Parts of Speech Highlighting**:
   - Complex settings updates for copyedit mode highlighting
   - Updates all 5 highlight toggles
   - Re-triggers syntax analysis after changes

## Problems

### 1. Single Responsibility Principle Violation
One hook manages 8+ unrelated concerns, making it difficult to understand what it does.

### 2. Hard to Test
Cannot test keyboard shortcuts in isolation from menu events or DOM events. Any test requires setting up all dependencies.

### 3. High Coupling
Changes to one concern (e.g., shortcuts) require touching code adjacent to completely unrelated concerns (e.g., toast bridge initialization).

### 4. Performance Impact
The giant hook re-runs whenever any dependency changes. Currently has dependencies on `createNewFileWithQuery` and `handleSetPreferencesOpen`.

### 5. Hard to Maintain
487 lines of deeply nested `useEffect` calls with complex cleanup logic. Difficult to trace which effect does what.

### 6. Code Duplication
Several patterns are repeated unnecessarily:
- Menu format listeners (bold/italic/link/h1-h4/paragraph) all have nearly identical structure
- Hotkey options (`preventDefault`, `enableOnFormTags`, `enableOnContentEditable`) duplicated across 5 shortcuts
- Part-of-speech highlight toggles create 5 wrapper functions that all call the same base function

## Assessment

**Type:** Code organization / maintainability issue, not a bug
**Impact:** High maintenance burden, medium performance impact
**User-Facing:** No direct user-facing problems; purely internal code quality
**Priority:** Post-1.0.0 tech debt

**My Take:** This works correctly and isn't causing bugs. Decomposing it improves maintainability and testability but won't fix any user-facing problems. The criticality in reviews may be slightly overstated - this is architectural aesthetics, not a reliability issue.

## Recommended Approach

Decompose the monolithic hook into focused, single-responsibility hooks:

### Proposed Hook Structure

```typescript
// hooks/useKeyboardShortcuts.ts
export function useKeyboardShortcuts() {
  // All useHotkeys calls with shared options
  const defaultOpts = {
    preventDefault: true,
    enableOnFormTags: ['input', 'textarea', 'select'],
    enableOnContentEditable: true
  }

  useHotkeys('mod+s', () => {...}, { preventDefault: true })
  useHotkeys('mod+1', () => {...}, defaultOpts)
  // ... etc
}

// hooks/useMenuEvents.ts
export function useMenuEvents() {
  // All Tauri menu listeners via listen()
  // Could use map-based approach for format menu events
}

// hooks/useDOMEventListeners.ts (or split further)
export function useDOMEventListeners() {
  // All window.addEventListener calls
  // Or split into useHighlightEvents, useFileEvents, etc.
}

// hooks/useEditorFocusTracking.ts
export function useEditorFocusTracking() {
  // Format menu state management based on editor focus
}

// hooks/useThemeSync.ts (already suggested in review)
export function useThemeSync(globalSettings) {
  // Theme synchronization
}

// hooks/useProjectInitialization.ts
export function useProjectInitialization() {
  // Project loading on mount
}

// hooks/useRustToastBridge.ts
export function useRustToastBridge() {
  // Toast bridge initialization
}

// Layout.tsx - compose the hooks
function Layout() {
  useKeyboardShortcuts()
  useMenuEvents()
  useDOMEventListeners()
  useEditorFocusTracking()
  useProjectInitialization()
  useRustToastBridge()

  // Preferences state might stay in Layout as it returns values
  const [preferencesOpen, setPreferencesOpen] = useState(false)

  // ... rest of layout
}
```

### Benefits

1. **Testability**: Each hook can be tested in isolation
2. **Clear Dependencies**: Dependencies are scoped to each concern
3. **Maintainability**: Easy to find and modify specific functionality
4. **Feature Toggles**: Can disable/enable features by commenting out hooks
5. **Performance**: Smaller hooks re-run less frequently
6. **Reduced Duplication**: Easier to extract common patterns in focused contexts

## Implementation Considerations

### Current State Verification

Before implementing, verify that the issues identified in reviews still apply:
- ✅ Hook is still 486 lines (was 487 in review)
- ✅ Still manages keyboard shortcuts, menu events, and DOM events
- ✅ Still has the duplication issues mentioned in reviews
- ⚠️  Check if parts-of-speech highlighting approach has changed
- ⚠️  Check if event bridge pattern has evolved

### Related Work

This task is related to the **Event Bridge Refactor** (see `task-x-event-bridge-refactor.md` and `docs/reviews/event-bridge-refactor-analysis.md`). The Event Bridge refactor proposes replacing DOM custom events with a callback registry pattern. If that refactor happens first, this decomposition will be easier. If this decomposition happens first, it will make the event bridge refactor easier.

**Recommendation:** Consider whether these should be tackled together or in sequence.

### Duplication to Address

While decomposing, address these duplication issues identified in reviews:

1. **Menu format event map** (`docs/reviews/2025-10-24-duplication-review.md:48-51`):
   ```typescript
   const formatEventMap = {
     'menu-format-bold': 'toggleBold',
     'menu-format-italic': 'toggleItalic',
     'menu-format-link': 'createLink',
     'menu-format-h1': ['formatHeading', 1],
     // ... etc
   }
   ```

2. **Shared hotkey options** (`docs/reviews/2025-10-24-duplication-review.md:123-126`):
   Extract common options object

3. **Parts-of-speech wrapper functions** (lines 280-286):
   The 5 wrapper functions can be generated from an array

4. **Open project flow duplication** (`docs/reviews/2025-10-24-duplication-review.md:105-108`):
   Extract to `lib/projects/actions.ts`

## Success Criteria

- [ ] Hook is decomposed into 5-7 focused hooks
- [ ] Each hook has a single, clear responsibility
- [ ] Layout.tsx composes the hooks cleanly
- [ ] All functionality still works (no regressions)
- [ ] Duplication issues are addressed
- [ ] Each new hook could theoretically be tested in isolation
- [ ] Code is easier to navigate and understand