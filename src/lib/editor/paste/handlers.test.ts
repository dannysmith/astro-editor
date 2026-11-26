import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EditorView } from '@codemirror/view'
import { EditorState, EditorSelection } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { handlePaste, isClipboardUrl, markdownToPaste } from './handlers'

// Mock URL detection
vi.mock('../urls/detection', () => ({
  isValidUrl: vi.fn(),
}))

const mockIsValidUrl = vi.mocked(await import('../urls/detection')).isValidUrl

// Mock dispatch function
const mockDispatch = vi.fn()

const createMockView = (
  content: string,
  selection?: { from: number; to: number }
) => {
  const state = EditorState.create({
    doc: content,
    selection: selection
      ? EditorSelection.range(selection.from, selection.to)
      : undefined,
  })

  return {
    state,
    dispatch: mockDispatch,
  } as unknown as EditorView
}

/** A paste of plain text, as a real clipboard gives it */
const createMockClipboardEvent = (text: string): ClipboardEvent => {
  return {
    clipboardData: {
      types: ['text/plain'],
      getData: vi.fn((type: string) => (type === 'text/plain' ? text : '')),
    },
  } as unknown as ClipboardEvent
}

describe('Paste Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('isClipboardUrl', () => {
    it('should return true for valid URL', () => {
      mockIsValidUrl.mockReturnValue(true)

      const result = isClipboardUrl('https://example.com')

      expect(result).toBe(true)
      expect(mockIsValidUrl).toHaveBeenCalledWith('https://example.com')
    })

    it('should return false for invalid URL', () => {
      mockIsValidUrl.mockReturnValue(false)

      const result = isClipboardUrl('not a url')

      expect(result).toBe(false)
      expect(mockIsValidUrl).toHaveBeenCalledWith('not a url')
    })

    it('should return false for null clipboard text', () => {
      const result = isClipboardUrl(null)

      expect(result).toBe(false)
      expect(mockIsValidUrl).not.toHaveBeenCalled()
    })

    it('should return false for empty clipboard text', () => {
      const result = isClipboardUrl('')

      expect(result).toBe(false)
      expect(mockIsValidUrl).toHaveBeenCalledWith('')
    })
  })

  describe('handlePaste', () => {
    it('should return false when no clipboard data', () => {
      const view = createMockView('Hello world', { from: 0, to: 5 })
      const event = {
        clipboardData: null,
      } as unknown as ClipboardEvent

      const result = handlePaste(view, event)

      expect(result).toBe(false)
      expect(mockDispatch).not.toHaveBeenCalled()
    })

    it('should return false when clipboard text is not a URL', () => {
      const view = createMockView('Hello world', { from: 0, to: 5 })
      const event = createMockClipboardEvent('just text')

      mockIsValidUrl.mockReturnValue(false)

      const result = handlePaste(view, event)

      expect(result).toBe(false)
      expect(mockDispatch).not.toHaveBeenCalled()
    })

    it('should return false when no text is selected', () => {
      const view = createMockView('Hello world', { from: 5, to: 5 })
      const event = createMockClipboardEvent('https://example.com')

      mockIsValidUrl.mockReturnValue(true)

      const result = handlePaste(view, event)

      expect(result).toBe(false)
      expect(mockDispatch).not.toHaveBeenCalled()
    })

    it('should return false when selected text is whitespace only', () => {
      const view = createMockView('Hello   world', { from: 5, to: 8 })
      const event = createMockClipboardEvent('https://example.com')

      mockIsValidUrl.mockReturnValue(true)

      const result = handlePaste(view, event)

      expect(result).toBe(false)
      expect(mockDispatch).not.toHaveBeenCalled()
    })

    it('should create markdown link when pasting URL over selected text', () => {
      const view = createMockView('Hello world', { from: 0, to: 5 })
      const event = createMockClipboardEvent('https://example.com')

      mockIsValidUrl.mockReturnValue(true)

      const result = handlePaste(view, event)

      expect(result).toBe(true)
      expect(mockDispatch).toHaveBeenCalledWith({
        changes: { from: 0, to: 5, insert: '[Hello](https://example.com)' },
        selection: EditorSelection.range(8, 27), // Select URL part (8 + 19 = 27)
      })
    })

    it('should handle URLs with whitespace', () => {
      const view = createMockView('Hello world', { from: 0, to: 5 })
      const event = createMockClipboardEvent('  https://example.com  ')

      mockIsValidUrl.mockReturnValue(true)

      const result = handlePaste(view, event)

      expect(result).toBe(true)
      expect(mockDispatch).toHaveBeenCalledWith({
        changes: { from: 0, to: 5, insert: '[Hello](https://example.com)' },
        selection: EditorSelection.range(8, 27), // Select URL part
      })
    })

    it('should handle selected text with special characters', () => {
      const view = createMockView('Visit "Example Site" today', {
        from: 6,
        to: 20,
      })
      const event = createMockClipboardEvent('https://example.com')

      mockIsValidUrl.mockReturnValue(true)

      const result = handlePaste(view, event)

      expect(result).toBe(true)
      expect(mockDispatch).toHaveBeenCalledWith({
        changes: {
          from: 6,
          to: 20,
          insert: '["Example Site"](https://example.com)',
        },
        selection: EditorSelection.range(23, 42), // Select URL part
      })
    })

    it('should handle long URLs', () => {
      const view = createMockView('Hello world', { from: 0, to: 5 })
      const longUrl =
        'https://very-long-domain.example.com/path/to/resource?param1=value1&param2=value2#section'
      const event = createMockClipboardEvent(longUrl)

      mockIsValidUrl.mockReturnValue(true)

      const result = handlePaste(view, event)

      expect(result).toBe(true)
      expect(mockDispatch).toHaveBeenCalledWith({
        changes: { from: 0, to: 5, insert: `[Hello](${longUrl})` },
        selection: EditorSelection.range(8, 8 + longUrl.length), // Select URL part
      })
    })

    it('should handle empty selected text', () => {
      const view = createMockView('Hello world', { from: 0, to: 0 })
      const event = createMockClipboardEvent('https://example.com')

      mockIsValidUrl.mockReturnValue(true)

      const result = handlePaste(view, event)

      expect(result).toBe(false)
      expect(mockDispatch).not.toHaveBeenCalled()
    })

    it('should handle multiple word selection', () => {
      const view = createMockView('Check out this awesome site', {
        from: 10,
        to: 23,
      })
      const event = createMockClipboardEvent('https://example.com')

      mockIsValidUrl.mockReturnValue(true)

      const result = handlePaste(view, event)

      expect(result).toBe(true)
      expect(mockDispatch).toHaveBeenCalledWith({
        changes: {
          from: 10,
          to: 23,
          insert: '[this awesome ](https://example.com)',
        },
        selection: EditorSelection.range(26, 45), // Select URL part
      })
    })

    it('should handle selection at document boundaries', () => {
      const view = createMockView('Hello', { from: 0, to: 5 })
      const event = createMockClipboardEvent('https://example.com')

      mockIsValidUrl.mockReturnValue(true)

      const result = handlePaste(view, event)

      expect(result).toBe(true)
      expect(mockDispatch).toHaveBeenCalledWith({
        changes: { from: 0, to: 5, insert: '[Hello](https://example.com)' },
        selection: EditorSelection.range(8, 27), // Select URL part
      })
    })

    it('should handle selection with newlines', () => {
      const view = createMockView('Hello\nworld', { from: 0, to: 11 })
      const event = createMockClipboardEvent('https://example.com')

      mockIsValidUrl.mockReturnValue(true)

      const result = handlePaste(view, event)

      expect(result).toBe(true)
      expect(mockDispatch).toHaveBeenCalledWith({
        changes: {
          from: 0,
          to: 11,
          insert: '[Hello\nworld](https://example.com)',
        },
        selection: EditorSelection.range(14, 33), // Select URL part
      })
    })

    it('should call isValidUrl with trimmed clipboard text', () => {
      const view = createMockView('Hello world', { from: 0, to: 5 })
      const event = createMockClipboardEvent('  https://example.com  ')

      mockIsValidUrl.mockReturnValue(true)

      handlePaste(view, event)

      expect(mockIsValidUrl).toHaveBeenCalledWith('https://example.com')
    })

    it('should handle clipboard data with different MIME types', () => {
      const view = createMockView('Hello world', { from: 0, to: 5 })
      const event = {
        clipboardData: {
          getData: vi.fn().mockImplementation(type => {
            if (type === 'text/plain') return 'https://example.com'
            return ''
          }),
        },
      } as unknown as ClipboardEvent

      mockIsValidUrl.mockReturnValue(true)

      const result = handlePaste(view, event)

      expect(result).toBe(true)
      // oxlint-disable-next-line @typescript-eslint/unbound-method
      expect(event.clipboardData!.getData).toHaveBeenCalledWith('text/plain')
    })

    it('should handle clipboard data.getData returning null', () => {
      const view = createMockView('Hello world', { from: 0, to: 5 })
      const event = {
        clipboardData: {
          getData: vi.fn().mockReturnValue(null),
        },
      } as unknown as ClipboardEvent

      const result = handlePaste(view, event)

      expect(result).toBe(false)
      expect(mockDispatch).not.toHaveBeenCalled()
    })

    it('should handle clipboard data.getData returning undefined', () => {
      const view = createMockView('Hello world', { from: 0, to: 5 })
      const event = {
        clipboardData: {
          getData: vi.fn().mockReturnValue(undefined),
        },
      } as unknown as ClipboardEvent

      const result = handlePaste(view, event)

      expect(result).toBe(false)
      expect(mockDispatch).not.toHaveBeenCalled()
    })
  })
})

describe('markdownToPaste', () => {
  const state = (doc: string, cursor: number) =>
    EditorState.create({
      doc,
      selection: EditorSelection.cursor(cursor),
      extensions: markdown(),
    })
  const clipboard = (data: Record<string, string>) =>
    ({
      types: Object.keys(data),
      getData: (type: string) => data[type] ?? '',
    }) as unknown as DataTransfer

  const rich = {
    'text/html': '<p>Some <b>bold</b> text</p>',
    'text/plain': 'Some bold text',
  }

  it('converts copied rich text', () => {
    expect(markdownToPaste(state('', 0), clipboard(rich))).toBe(
      'Some **bold** text'
    )
  })

  it('pastes the plain text when there is no formatting to keep', () => {
    const html = { 'text/html': '<p>5 * 3</p>', 'text/plain': '5 * 3' }
    expect(markdownToPaste(state('', 0), clipboard(html))).toBeNull()
    expect(
      markdownToPaste(state('', 0), clipboard({ 'text/plain': 'Text' }))
    ).toBeNull()
  })

  it('pastes the plain text of code copied from VS Code', () => {
    const vscode = { ...rich, 'vscode-editor-data': '{"mode":"typescript"}' }
    expect(markdownToPaste(state('', 0), clipboard(vscode))).toBeNull()
  })

  it('pastes the plain text into code', () => {
    const doc = 'Text\n\n```js\nconst a = 1\n```\n'
    expect(markdownToPaste(state(doc, 12), clipboard(rich))).toBeNull()
    expect(markdownToPaste(state(doc, 2), clipboard(rich))).not.toBeNull()
  })
})
