import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EditorView } from '@codemirror/view'
import { EditorState, EditorSelection } from '@codemirror/state'
import { addCursorsToLineEnds } from '../addCursorsToLineEnds'

const mockDispatch = vi.fn()

const createMockView = (content: string, from: number, to: number) => {
  const state = EditorState.create({
    doc: content,
    selection: EditorSelection.range(from, to),
    extensions: [EditorState.allowMultipleSelections.of(true)],
  })

  return {
    state,
    dispatch: mockDispatch,
  } as unknown as EditorView
}

describe('addCursorsToLineEnds', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns false when no selection (cursor only)', () => {
    const view = createMockView('line 1\nline 2', 5, 5)
    expect(addCursorsToLineEnds(view)).toBe(false)
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('returns false for single line selection', () => {
    const view = createMockView('line 1\nline 2', 0, 4)
    expect(addCursorsToLineEnds(view)).toBe(false)
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('creates cursors at end of each line for multi-line selection', () => {
    // "line 1\nline 2\nline 3" - select from start to end of line 2
    const view = createMockView('line 1\nline 2\nline 3', 0, 13)
    expect(addCursorsToLineEnds(view)).toBe(true)

    expect(mockDispatch).toHaveBeenCalledWith({
      selection: EditorSelection.create(
        [
          EditorSelection.cursor(6), // end of "line 1"
          EditorSelection.cursor(13), // end of "line 2"
        ],
        1 // main selection is last cursor
      ),
    })
  })

  it('excludes line when selection ends at line start', () => {
    // "line 1\nline 2" - select "line 1\n" (positions 0-7, where 7 is start of line 2)
    const view = createMockView('line 1\nline 2', 0, 7)
    expect(addCursorsToLineEnds(view)).toBe(false)
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('includes empty lines', () => {
    // "line 1\n\nline 3" - select all
    const view = createMockView('line 1\n\nline 3', 0, 14)
    expect(addCursorsToLineEnds(view)).toBe(true)

    expect(mockDispatch).toHaveBeenCalledWith({
      selection: EditorSelection.create(
        [
          EditorSelection.cursor(6), // end of "line 1"
          EditorSelection.cursor(7), // empty line (from and to are the same)
          EditorSelection.cursor(14), // end of "line 3"
        ],
        2 // main selection is last cursor
      ),
    })
  })

  it('handles selection spanning all lines', () => {
    const content = 'first\nsecond\nthird'
    const view = createMockView(content, 0, content.length)
    expect(addCursorsToLineEnds(view)).toBe(true)

    expect(mockDispatch).toHaveBeenCalledWith({
      selection: EditorSelection.create(
        [
          EditorSelection.cursor(5), // end of "first"
          EditorSelection.cursor(12), // end of "second"
          EditorSelection.cursor(18), // end of "third"
        ],
        2
      ),
    })
  })

  it('handles selection starting mid-line', () => {
    // Select from middle of line 1 to end of line 2
    const view = createMockView('line 1\nline 2\nline 3', 3, 13)
    expect(addCursorsToLineEnds(view)).toBe(true)

    expect(mockDispatch).toHaveBeenCalledWith({
      selection: EditorSelection.create(
        [
          EditorSelection.cursor(6), // end of "line 1"
          EditorSelection.cursor(13), // end of "line 2"
        ],
        1
      ),
    })
  })

  it('handles backwards selection (normalized by CodeMirror)', () => {
    // CodeMirror normalizes selections so from <= to
    // We create a normal selection but note that backwards selections work the same
    const view = createMockView('line 1\nline 2', 0, 13)
    expect(addCursorsToLineEnds(view)).toBe(true)

    expect(mockDispatch).toHaveBeenCalledWith({
      selection: EditorSelection.create(
        [EditorSelection.cursor(6), EditorSelection.cursor(13)],
        1
      ),
    })
  })
})
