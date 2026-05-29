import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import {
  createBoldCommand,
  createItalicCommand,
  createLinkCommand,
  createHeadingCommand,
  createSaveCommand,
  createEditorCommandRegistry,
} from './editorCommands'

// Mock the markdown utilities
vi.mock('../markdown/formatting', () => ({
  toggleMarkdown: vi.fn((view, marker) => {
    // Mock implementation that tracks the marker used
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
    view.lastMarker = marker
    return true
  }),
  createMarkdownLink: vi.fn(() => true),
}))

vi.mock('../markdown/headings', () => ({
  transformLineToHeading: vi.fn((view, level) => {
    // Mock implementation that tracks the level used
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
    view.lastLevel = level
    return true
  }),
}))

const mockDispatch = vi.fn()
const mockView = {
  dispatch: mockDispatch,
  state: EditorState.create({ doc: 'test content' }),
} as unknown as EditorView

describe('Editor Commands', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDispatch.mockClear()
  })

  describe('createBoldCommand', () => {
    it('should create a command that toggles bold markdown', () => {
      const command = createBoldCommand()
      const result = command(mockView)

      expect(result).toBe(true)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
      expect((mockView as any).lastMarker).toBe('**')
    })
  })

  describe('createItalicCommand', () => {
    it('should create a command that toggles italic markdown', () => {
      const command = createItalicCommand()
      const result = command(mockView)

      expect(result).toBe(true)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
      expect((mockView as any).lastMarker).toBe('*')
    })
  })

  describe('createLinkCommand', () => {
    it('should create a command that creates markdown links', async () => {
      const { createMarkdownLink } = vi.mocked(
        await import('../markdown/formatting')
      )

      const command = createLinkCommand()
      const result = command(mockView)

      expect(result).toBe(true)
      expect(createMarkdownLink).toHaveBeenCalledWith(mockView)
    })
  })

  describe('createHeadingCommand', () => {
    it('should create a command that transforms to heading level 1', () => {
      const command = createHeadingCommand(1)
      const result = command(mockView)

      expect(result).toBe(true)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
      expect((mockView as any).lastLevel).toBe(1)
    })

    it('should create a command that transforms to heading level 2', () => {
      const command = createHeadingCommand(2)
      const result = command(mockView)

      expect(result).toBe(true)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
      expect((mockView as any).lastLevel).toBe(2)
    })

    it('should create a command that transforms to paragraph (level 0)', () => {
      const command = createHeadingCommand(0)
      const result = command(mockView)

      expect(result).toBe(true)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
      expect((mockView as any).lastLevel).toBe(0)
    })
  })

  describe('createSaveCommand', () => {
    it('should create a command that calls the save callback', () => {
      const mockSave = vi.fn()
      const command = createSaveCommand(mockSave)
      const result = command(mockView)

      expect(result).toBe(true)
      expect(mockSave).toHaveBeenCalledTimes(1)
    })

    it('should always call save callback (current behavior)', () => {
      const mockSave = vi.fn()
      const command = createSaveCommand(mockSave)

      // This test verifies the current behavior - it always calls onSave
      // In a real implementation, you might want to handle failures differently
      expect(command(mockView)).toBe(true)
      expect(mockSave).toHaveBeenCalledTimes(1)
    })
  })

  describe('createEditorCommandRegistry', () => {
    it('should create a complete command registry', () => {
      const mockSave = vi.fn()
      const registry = createEditorCommandRegistry(mockSave)

      expect(registry).toHaveProperty('toggleBold')
      expect(registry).toHaveProperty('toggleItalic')
      expect(registry).toHaveProperty('createLink')
      expect(registry).toHaveProperty('formatHeading')
      expect(registry).toHaveProperty('save')

      expect(typeof registry.toggleBold).toBe('function')
      expect(typeof registry.toggleItalic).toBe('function')
      expect(typeof registry.createLink).toBe('function')
      expect(typeof registry.formatHeading).toBe('function')
      expect(typeof registry.save).toBe('function')
    })

    it('should have working toggleBold command', () => {
      const mockSave = vi.fn()
      const registry = createEditorCommandRegistry(mockSave)

      const result = registry.toggleBold(mockView)
      expect(result).toBe(true)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
      expect((mockView as any).lastMarker).toBe('**')
    })

    it('should have working toggleItalic command', () => {
      const mockSave = vi.fn()
      const registry = createEditorCommandRegistry(mockSave)

      const result = registry.toggleItalic(mockView)
      expect(result).toBe(true)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
      expect((mockView as any).lastMarker).toBe('*')
    })

    it('should have working createLink command', async () => {
      const mockSave = vi.fn()
      const registry = createEditorCommandRegistry(mockSave)
      const { createMarkdownLink } = vi.mocked(
        await import('../markdown/formatting')
      )

      const result = registry.createLink(mockView)
      expect(result).toBe(true)
      expect(createMarkdownLink).toHaveBeenCalledWith(mockView)
    })

    it('should have working formatHeading command', () => {
      const mockSave = vi.fn()
      const registry = createEditorCommandRegistry(mockSave)

      const headingCommand = registry.formatHeading(2)
      const result = headingCommand(mockView)

      expect(result).toBe(true)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
      expect((mockView as any).lastLevel).toBe(2)
    })

    it('should have working save command', () => {
      const mockSave = vi.fn()
      const registry = createEditorCommandRegistry(mockSave)

      const result = registry.save(mockView)
      expect(result).toBe(true)
      expect(mockSave).toHaveBeenCalledTimes(1)
    })
  })
})
