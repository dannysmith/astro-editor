import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { CommandRegistry } from './CommandRegistry'
import { EditorCommandRegistry } from './types'

// Mock CodeMirror
const mockDispatch = vi.fn()
const mockView = {
  dispatch: mockDispatch,
  state: EditorState.create({ doc: 'test content' }),
} as unknown as EditorView

describe('CommandRegistry', () => {
  let registry: CommandRegistry
  let mockCommands: EditorCommandRegistry
  let mockSave: Mock<() => void>

  beforeEach(() => {
    registry = new CommandRegistry()
    mockSave = vi.fn()
    mockDispatch.mockClear()
    mockSave.mockClear()

    mockCommands = {
      toggleBold: vi.fn(() => true),
      toggleItalic: vi.fn(() => true),
      createLink: vi.fn(() => true),
      formatHeading: vi.fn((_level: number) => vi.fn(() => true)),
      save: vi.fn(() => {
        mockSave()
        return true
      }),
      toggleFocusMode: vi.fn(() => true),
    }
  })

  describe('register', () => {
    it('should register commands and editor view', () => {
      registry.register(mockCommands, mockView)

      expect(registry.isReady()).toBe(true)
      expect(registry.getEditorView()).toBe(mockView)
    })
  })

  describe('unregister', () => {
    it('should clear commands and editor view', () => {
      registry.register(mockCommands, mockView)
      registry.unregister()

      expect(registry.isReady()).toBe(false)
      expect(registry.getEditorView()).toBeNull()
    })
  })

  describe('execute', () => {
    beforeEach(() => {
      registry.register(mockCommands, mockView)
    })

    it('should execute toggleBold command', () => {
      const result = registry.execute('toggleBold')

      expect(result).toBe(true)
      expect(mockCommands.toggleBold).toHaveBeenCalledWith(mockView)
    })

    it('should execute toggleItalic command', () => {
      const result = registry.execute('toggleItalic')

      expect(result).toBe(true)
      expect(mockCommands.toggleItalic).toHaveBeenCalledWith(mockView)
    })

    it('should execute createLink command', () => {
      const result = registry.execute('createLink')

      expect(result).toBe(true)
      expect(mockCommands.createLink).toHaveBeenCalledWith(mockView)
    })

    it('should execute save command', () => {
      const result = registry.execute('save')

      expect(result).toBe(true)
      expect(mockCommands.save).toHaveBeenCalledWith(mockView)
    })

    it('should handle formatHeading command with level argument', () => {
      const mockHeadingCommand = vi.fn(() => true)
      mockCommands.formatHeading = vi.fn(() => mockHeadingCommand)

      const result = registry.execute('formatHeading', 1)

      expect(result).toBe(true)
      expect(mockCommands.formatHeading).toHaveBeenCalledWith(1)
      expect(mockHeadingCommand).toHaveBeenCalledWith(mockView)
    })

    it('should return false when no commands are registered', () => {
      registry.unregister()

      const result = registry.execute('toggleBold')

      expect(result).toBe(false)
    })

    it('should return false when command does not exist', () => {
      // Remove a command to test non-existent command
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
      delete (mockCommands as any).toggleBold

      const result = registry.execute('toggleBold')

      expect(result).toBe(false)
    })

    it('should handle command execution errors gracefully', () => {
      mockCommands.toggleBold = vi.fn(() => {
        throw new Error('Test error')
      })

      const result = registry.execute('toggleBold')

      expect(result).toBe(false)
    })
  })

  describe('isReady', () => {
    it('should return false when not registered', () => {
      expect(registry.isReady()).toBe(false)
    })

    it('should return true when registered', () => {
      registry.register(mockCommands, mockView)
      expect(registry.isReady()).toBe(true)
    })

    it('should return false after unregistering', () => {
      registry.register(mockCommands, mockView)
      registry.unregister()
      expect(registry.isReady()).toBe(false)
    })
  })

  describe('getEditorView', () => {
    it('should return null when not registered', () => {
      expect(registry.getEditorView()).toBeNull()
    })

    it('should return editor view when registered', () => {
      registry.register(mockCommands, mockView)
      expect(registry.getEditorView()).toBe(mockView)
    })

    it('should return null after unregistering', () => {
      registry.register(mockCommands, mockView)
      registry.unregister()
      expect(registry.getEditorView()).toBeNull()
    })
  })
})
