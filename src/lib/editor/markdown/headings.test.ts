import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EditorView } from '@codemirror/view'
import { EditorState, EditorSelection } from '@codemirror/state'
import { transformLineToHeading, getHeadingLevel, isHeading } from './headings'

// Mock dispatch function
const mockDispatch = vi.fn()

const createMockView = (content: string, cursorPos?: number) => {
  const state = EditorState.create({
    doc: content,
    selection: cursorPos ? EditorSelection.cursor(cursorPos) : undefined,
  })

  return {
    state,
    dispatch: mockDispatch,
  } as unknown as EditorView
}

describe('Markdown Headings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('transformLineToHeading', () => {
    it('should convert plain text to H1', () => {
      const view = createMockView('Hello world', 5)

      const result = transformLineToHeading(view, 1)

      expect(result).toBe(true)
      expect(mockDispatch).toHaveBeenCalledWith({
        changes: {
          from: 0,
          to: 11,
          insert: '# Hello world',
        },
        selection: EditorSelection.cursor(13),
      })
    })

    it('should convert plain text to H2', () => {
      const view = createMockView('Hello world', 5)

      const result = transformLineToHeading(view, 2)

      expect(result).toBe(true)
      expect(mockDispatch).toHaveBeenCalledWith({
        changes: {
          from: 0,
          to: 11,
          insert: '## Hello world',
        },
        selection: EditorSelection.cursor(14),
      })
    })

    it('should convert plain text to H3', () => {
      const view = createMockView('Hello world', 5)

      const result = transformLineToHeading(view, 3)

      expect(result).toBe(true)
      expect(mockDispatch).toHaveBeenCalledWith({
        changes: {
          from: 0,
          to: 11,
          insert: '### Hello world',
        },
        selection: EditorSelection.cursor(15),
      })
    })

    it('should convert plain text to H4', () => {
      const view = createMockView('Hello world', 5)

      const result = transformLineToHeading(view, 4)

      expect(result).toBe(true)
      expect(mockDispatch).toHaveBeenCalledWith({
        changes: {
          from: 0,
          to: 11,
          insert: '#### Hello world',
        },
        selection: EditorSelection.cursor(16),
      })
    })

    it('should convert H1 to plain text', () => {
      const view = createMockView('# Hello world', 5)

      const result = transformLineToHeading(view, 0)

      expect(result).toBe(true)
      expect(mockDispatch).toHaveBeenCalledWith({
        changes: {
          from: 0,
          to: 13,
          insert: 'Hello world',
        },
        selection: EditorSelection.cursor(11),
      })
    })

    it('should convert H2 to H1', () => {
      const view = createMockView('## Hello world', 5)

      const result = transformLineToHeading(view, 1)

      expect(result).toBe(true)
      expect(mockDispatch).toHaveBeenCalledWith({
        changes: {
          from: 0,
          to: 14,
          insert: '# Hello world',
        },
        selection: EditorSelection.cursor(13),
      })
    })

    it('should convert H1 to H3', () => {
      const view = createMockView('# Hello world', 5)

      const result = transformLineToHeading(view, 3)

      expect(result).toBe(true)
      expect(mockDispatch).toHaveBeenCalledWith({
        changes: {
          from: 0,
          to: 13,
          insert: '### Hello world',
        },
        selection: EditorSelection.cursor(15),
      })
    })

    it('should handle heading with multiple hash symbols', () => {
      const view = createMockView('##### Hello world', 5)

      const result = transformLineToHeading(view, 2)

      expect(result).toBe(true)
      expect(mockDispatch).toHaveBeenCalledWith({
        changes: {
          from: 0,
          to: 17,
          insert: '## Hello world',
        },
        selection: EditorSelection.cursor(14),
      })
    })

    it('should handle heading without space after hash', () => {
      const view = createMockView('#Hello world', 5)

      const result = transformLineToHeading(view, 2)

      expect(result).toBe(true)
      expect(mockDispatch).toHaveBeenCalledWith({
        changes: {
          from: 0,
          to: 12,
          insert: '## Hello world',
        },
        selection: EditorSelection.cursor(14),
      })
    })

    it('should handle empty line', () => {
      const view = createMockView('', 0)

      const result = transformLineToHeading(view, 1)

      expect(result).toBe(true)
      expect(mockDispatch).toHaveBeenCalledWith({
        changes: {
          from: 0,
          to: 0,
          insert: '# ',
        },
        selection: EditorSelection.cursor(2),
      })
    })

    it('should handle line with only whitespace', () => {
      const view = createMockView('   ', 1)

      const result = transformLineToHeading(view, 1)

      expect(result).toBe(true)
      expect(mockDispatch).toHaveBeenCalledWith({
        changes: {
          from: 0,
          to: 3,
          insert: '# ',
        },
        selection: EditorSelection.cursor(2),
      })
    })

    it('should handle multiline document', () => {
      const view = createMockView('Line 1\nLine 2\nLine 3', 8) // cursor on "Line 2"

      const result = transformLineToHeading(view, 2)

      expect(result).toBe(true)
      expect(mockDispatch).toHaveBeenCalledWith({
        changes: {
          from: 7,
          to: 13,
          insert: '## Line 2',
        },
        selection: EditorSelection.cursor(16),
      })
    })
  })

  describe('getHeadingLevel', () => {
    it('should return 0 for plain text', () => {
      expect(getHeadingLevel('Hello world')).toBe(0)
    })

    it('should return 1 for H1', () => {
      expect(getHeadingLevel('# Hello world')).toBe(1)
    })

    it('should return 2 for H2', () => {
      expect(getHeadingLevel('## Hello world')).toBe(2)
    })

    it('should return 3 for H3', () => {
      expect(getHeadingLevel('### Hello world')).toBe(3)
    })

    it('should return 4 for H4', () => {
      expect(getHeadingLevel('#### Hello world')).toBe(4)
    })

    it('should return 0 for H5 (unsupported)', () => {
      expect(getHeadingLevel('##### Hello world')).toBe(0)
    })

    it('should return 0 for H6 (unsupported)', () => {
      expect(getHeadingLevel('###### Hello world')).toBe(0)
    })

    it('should return 0 for hash without space', () => {
      expect(getHeadingLevel('#Hello world')).toBe(0)
    })

    it('should return 0 for hash in middle of text', () => {
      expect(getHeadingLevel('Hello # world')).toBe(0)
    })

    it('should return 0 for empty string', () => {
      expect(getHeadingLevel('')).toBe(0)
    })

    it('should return 0 for whitespace only', () => {
      expect(getHeadingLevel('   ')).toBe(0)
    })

    it('should handle heading with extra whitespace', () => {
      expect(getHeadingLevel('##   Hello world')).toBe(2)
    })
  })

  describe('isHeading', () => {
    it('should return false for plain text', () => {
      expect(isHeading('Hello world')).toBe(false)
    })

    it('should return true for H1', () => {
      expect(isHeading('# Hello world')).toBe(true)
    })

    it('should return true for H2', () => {
      expect(isHeading('## Hello world')).toBe(true)
    })

    it('should return true for H3', () => {
      expect(isHeading('### Hello world')).toBe(true)
    })

    it('should return true for H4', () => {
      expect(isHeading('#### Hello world')).toBe(true)
    })

    it('should return false for H5 (unsupported)', () => {
      expect(isHeading('##### Hello world')).toBe(false)
    })

    it('should return false for H6 (unsupported)', () => {
      expect(isHeading('###### Hello world')).toBe(false)
    })

    it('should return false for hash without space', () => {
      expect(isHeading('#Hello world')).toBe(false)
    })

    it('should return false for hash in middle of text', () => {
      expect(isHeading('Hello # world')).toBe(false)
    })

    it('should return false for empty string', () => {
      expect(isHeading('')).toBe(false)
    })

    it('should return true for heading with extra whitespace', () => {
      expect(isHeading('##   Hello world')).toBe(true)
    })
  })
})
