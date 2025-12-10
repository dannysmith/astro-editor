# Split Selection By Lines Command

## Overview

Add a keyboard shortcut (`Cmd+Shift+L`) that converts a multi-line selection into multiple cursors, one at the end of each line. This mirrors VS Code's "Add Cursors to Line Ends" behavior.

## Behavior

When the user:
1. Selects multiple lines of text
2. Presses `Cmd+Shift+L`

The editor will:
- Place a cursor at the end of each line within the selection
- Include empty lines (they get a cursor too)
- Allow simultaneous editing across all lines

## Implementation

### 1. Create the command function

Create `src/lib/editor/selection/splitSelectionByLines.ts`:

```typescript
import { EditorView } from '@codemirror/view'
import { EditorSelection } from '@codemirror/state'

/**
 * Split the current selection into multiple cursors, one at the end of each line.
 * Empty lines within the selection are included.
 */
export const splitSelectionByLines = (view: EditorView): boolean => {
  const { state } = view
  const { from, to } = state.selection.main

  // If no selection (just a cursor), do nothing
  if (from === to) return false

  // Get all lines in the selection
  const startLine = state.doc.lineAt(from)
  let endLine = state.doc.lineAt(to)

  // Edge case: if `to` is exactly at the start of a line, the user hasn't
  // selected any content on that line (e.g., selected "Line 1\n" ending at
  // the start of Line 2). Exclude that line.
  if (to === endLine.from && endLine.number > startLine.number) {
    endLine = state.doc.line(endLine.number - 1)
  }

  // If selection is on a single line, nothing to split
  if (startLine.number === endLine.number) return false

  const cursors: number[] = []

  for (let lineNum = startLine.number; lineNum <= endLine.number; lineNum++) {
    const line = state.doc.line(lineNum)
    // Place cursor at end of each line
    cursors.push(line.to)
  }

  view.dispatch({
    selection: EditorSelection.create(
      cursors.map(pos => EditorSelection.cursor(pos)),
      cursors.length - 1 // Make last cursor the main selection
    ),
  })

  return true
}
```

### 2. Create barrel export

Create `src/lib/editor/selection/index.ts`:

```typescript
export { splitSelectionByLines } from './splitSelectionByLines'
```

### 3. Add the keyboard shortcut

In `src/lib/editor/extensions/keymap.ts`, add import and keybinding to `createMarkdownKeymap`:

```typescript
import { splitSelectionByLines } from '../selection'

// In the keymap array:
{
  key: 'Mod-Shift-l',
  run: view => splitSelectionByLines(view),
},
```

### 4. Register as a command (optional, for future menu integration)

In `src/lib/editor/commands/editorCommands.ts`:

```typescript
import { splitSelectionByLines } from '../selection'

export const createSplitByLinesCommand = (): EditorCommand => {
  return (view: EditorView) => splitSelectionByLines(view)
}
```

Add to the registry in `createEditorCommandRegistry`:

```typescript
splitSelectionByLines: createSplitByLinesCommand(),
```

Update `src/lib/editor/commands/types.ts`:

```typescript
export interface EditorCommandRegistry {
  // ... existing commands ...
  splitSelectionByLines: EditorCommand
}
```

## Files to Create/Modify

- **Create**: `src/lib/editor/selection/splitSelectionByLines.ts`
- **Create**: `src/lib/editor/selection/index.ts`
- **Modify**: `src/lib/editor/extensions/keymap.ts`
- **Modify**: `src/lib/editor/commands/editorCommands.ts` (optional)
- **Modify**: `src/lib/editor/commands/types.ts` (if adding to registry)

## Edge Cases Handled

1. **No selection (cursor only)**: Returns `false`, does nothing
2. **Single line selection**: Returns `false`, nothing to split
3. **Selection ends at line start**: If user selects "Line 1\n" (ending at start of Line 2), Line 2 is correctly excluded since no content was selected on it
4. **Empty lines**: Included - they receive a cursor at position `line.to` (same as `line.from` for empty lines)
5. **Backwards selection**: CodeMirror normalizes `from` <= `to`, so handled automatically

## Technical Notes

### Why this works correctly

- **Multi-cursor already enabled**: `EditorState.allowMultipleSelections.of(true)` in `createExtensions.ts`
- **Undo/redo automatic**: `history()` extension handles selection changes via `view.dispatch()`
- **Focus preserved**: CodeMirror maintains focus after dispatch
- **Scroll automatic**: Scrolls to the main selection (last cursor) by default

### CodeMirror API used

- `state.selection.main` - Primary selection range
- `state.doc.lineAt(pos)` - Get line containing position (returns `{from, to, number, text}`)
- `state.doc.line(num)` - Get line by 1-indexed number
- `EditorSelection.cursor(pos)` - Create a cursor (zero-width selection)
- `EditorSelection.create(ranges, mainIndex)` - Create multi-cursor selection

## Testing

### Manual testing

1. Open the editor with multi-line content
2. Select 3+ lines of text
3. Press `Cmd+Shift+L`
4. Verify cursors appear at end of each line
5. Type something - should appear on all lines
6. Test with empty lines in selection - should get cursors too

### Edge case testing

7. Cursor only (no selection) - should do nothing
8. Single line selection - should do nothing
9. Select "Line 1\n" by double-clicking Line 1 then Shift+Down - verify Line 2 doesn't get a cursor
10. Select backwards (drag up) - should work the same as selecting down

### Unit tests

Create `src/lib/editor/selection/__tests__/splitSelectionByLines.test.ts` following patterns from `formatting.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { EditorState, EditorSelection } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { splitSelectionByLines } from '../splitSelectionByLines'

const createMockView = (content: string, from: number, to: number) => {
  const state = EditorState.create({
    doc: content,
    selection: EditorSelection.range(from, to),
    extensions: [EditorState.allowMultipleSelections.of(true)],
  })

  let lastDispatch: Parameters<typeof EditorView.prototype.dispatch>[0] | null = null

  return {
    state,
    dispatch: (tr: Parameters<typeof EditorView.prototype.dispatch>[0]) => {
      lastDispatch = tr
    },
    getLastDispatch: () => lastDispatch,
  } as unknown as EditorView & { getLastDispatch: () => typeof lastDispatch }
}

describe('splitSelectionByLines', () => {
  it('returns false when no selection', () => {
    const view = createMockView('line 1\nline 2', 5, 5)
    expect(splitSelectionByLines(view)).toBe(false)
  })

  it('returns false for single line selection', () => {
    const view = createMockView('line 1\nline 2', 0, 4)
    expect(splitSelectionByLines(view)).toBe(false)
  })

  it('creates cursors at end of each line for multi-line selection', () => {
    // "line 1\nline 2\nline 3" - select from start to end of line 2
    const view = createMockView('line 1\nline 2\nline 3', 0, 13)
    expect(splitSelectionByLines(view)).toBe(true)

    const dispatch = view.getLastDispatch()
    expect(dispatch?.selection?.ranges).toHaveLength(2)
    // Cursor at end of "line 1" (pos 6) and end of "line 2" (pos 13)
  })

  it('excludes line when selection ends at line start', () => {
    // "line 1\nline 2" - select "line 1\n" (positions 0-7, where 7 is start of line 2)
    const view = createMockView('line 1\nline 2', 0, 7)
    expect(splitSelectionByLines(view)).toBe(false) // Only line 1 selected = single line
  })

  it('includes empty lines', () => {
    // "line 1\n\nline 3" - select all
    const view = createMockView('line 1\n\nline 3', 0, 15)
    expect(splitSelectionByLines(view)).toBe(true)

    const dispatch = view.getLastDispatch()
    expect(dispatch?.selection?.ranges).toHaveLength(3)
  })
})
```

## Notes

- CodeMirror 6 does not have a built-in command for this - custom implementation required
- Follows existing patterns from `formatting.ts` and `headings.ts`
- Directory `src/lib/editor/selection/` is new - aligns with domain-based organization
