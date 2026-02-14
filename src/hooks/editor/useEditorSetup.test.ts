import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { useEditorSetup } from './useEditorSetup'
import { EditorCommandRegistry } from '../../lib/editor/commands/types'

// Mock the dependencies
vi.mock('../../lib/editor/extensions', () => ({
  createExtensions: vi.fn(),
}))

vi.mock('../../lib/editor/commands', () => ({
  globalCommandRegistry: {
    register: vi.fn(),
    unregister: vi.fn(),
  },
  createEditorCommandRegistry: vi.fn(),
  exportMenuCommands: vi.fn(),
  cleanupMenuCommands: vi.fn(),
}))

const mockCreateExtensions = vi.mocked(
  await import('../../lib/editor/extensions')
).createExtensions
const mockGlobalCommandRegistry = vi.mocked(
  await import('../../lib/editor/commands')
).globalCommandRegistry
const mockCreateEditorCommandRegistry = vi.mocked(
  await import('../../lib/editor/commands')
).createEditorCommandRegistry
const mockExportMenuCommands = vi.mocked(
  await import('../../lib/editor/commands')
).exportMenuCommands
const mockCleanupMenuCommands = vi.mocked(
  await import('../../lib/editor/commands')
).cleanupMenuCommands

describe('useEditorSetup', () => {
  let mockOnSave: () => void
  let mockOnFocus: () => void
  let mockOnBlur: () => void
  let mockEditorView: EditorView
  let mockCommands: EditorCommandRegistry

  beforeEach(() => {
    vi.clearAllMocks()

    mockOnSave = vi.fn()
    mockOnFocus = vi.fn()
    mockOnBlur = vi.fn()

    mockEditorView = {
      state: EditorState.create({ doc: 'test' }),
      dispatch: vi.fn(),
    } as unknown as EditorView

    mockCommands = {
      toggleBold: vi.fn(),
      toggleItalic: vi.fn(),
      createLink: vi.fn(),
      formatHeading: vi.fn(),
      save: vi.fn(),
      toggleFocusMode: vi.fn(),
      toggleTypewriterMode: vi.fn(),
      addCursorsToLineEnds: vi.fn(),
    } as EditorCommandRegistry

    mockCreateExtensions.mockReturnValue([])
    mockCreateEditorCommandRegistry.mockReturnValue(mockCommands)
  })

  describe('initialization', () => {
    it('should create extensions with provided callbacks', () => {
      renderHook(() => useEditorSetup(mockOnSave, mockOnFocus, mockOnBlur))

      expect(mockCreateExtensions).toHaveBeenCalledWith({
        onFocus: mockOnFocus,
        onBlur: mockOnBlur,
        componentBuilderHandler: undefined,
      })
    })

    it('should return extensions and basic setup', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockExtensions: any[] = []
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      mockCreateExtensions.mockReturnValue(mockExtensions)

      const { result } = renderHook(() =>
        useEditorSetup(mockOnSave, mockOnFocus, mockOnBlur)
      )

      expect(result.current.extensions).toBe(mockExtensions)
    })

    it('should return setup and cleanup functions', () => {
      const { result } = renderHook(() =>
        useEditorSetup(mockOnSave, mockOnFocus, mockOnBlur)
      )

      expect(typeof result.current.setupCommands).toBe('function')
      expect(typeof result.current.cleanupCommands).toBe('function')
    })
  })

  describe('setupCommands', () => {
    it('should create command registry and register with global registry', () => {
      const { result } = renderHook(() =>
        useEditorSetup(mockOnSave, mockOnFocus, mockOnBlur)
      )

      act(() => {
        result.current.setupCommands(mockEditorView)
      })

      expect(mockCreateEditorCommandRegistry).toHaveBeenCalledWith(mockOnSave)
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockGlobalCommandRegistry.register).toHaveBeenCalledWith(
        mockCommands,
        mockEditorView
      )
    })

    it('should export menu commands', () => {
      const { result } = renderHook(() =>
        useEditorSetup(mockOnSave, mockOnFocus, mockOnBlur)
      )

      act(() => {
        result.current.setupCommands(mockEditorView)
      })

      expect(mockExportMenuCommands).toHaveBeenCalledTimes(1)
    })

    it('should be stable when onSave does not change', () => {
      const { result, rerender } = renderHook(() =>
        useEditorSetup(mockOnSave, mockOnFocus, mockOnBlur)
      )
      const firstSetupCommands = result.current.setupCommands

      rerender()

      expect(result.current.setupCommands).toBe(firstSetupCommands)
    })

    it('should update when onSave changes', () => {
      const { result, rerender } = renderHook(
        ({ onSave }) => useEditorSetup(onSave, mockOnFocus, mockOnBlur),
        { initialProps: { onSave: mockOnSave } }
      )
      const firstSetupCommands = result.current.setupCommands

      const newOnSave = vi.fn()
      rerender({ onSave: newOnSave })

      expect(result.current.setupCommands).not.toBe(firstSetupCommands)
    })

    it('should use updated onSave callback', () => {
      const newOnSave = vi.fn()
      const { result, rerender } = renderHook(
        ({ onSave }) => useEditorSetup(onSave, mockOnFocus, mockOnBlur),
        { initialProps: { onSave: mockOnSave } }
      )

      rerender({ onSave: newOnSave })

      act(() => {
        result.current.setupCommands(mockEditorView)
      })

      expect(mockCreateEditorCommandRegistry).toHaveBeenCalledWith(newOnSave)
    })
  })

  describe('cleanupCommands', () => {
    it('should unregister global command registry', () => {
      const { result } = renderHook(() =>
        useEditorSetup(mockOnSave, mockOnFocus, mockOnBlur)
      )

      act(() => {
        result.current.cleanupCommands()
      })

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockGlobalCommandRegistry.unregister).toHaveBeenCalledTimes(1)
    })

    it('should cleanup menu commands', () => {
      const { result } = renderHook(() =>
        useEditorSetup(mockOnSave, mockOnFocus, mockOnBlur)
      )

      act(() => {
        result.current.cleanupCommands()
      })

      expect(mockCleanupMenuCommands).toHaveBeenCalledTimes(1)
    })

    it('should be stable across re-renders', () => {
      const { result, rerender } = renderHook(() =>
        useEditorSetup(mockOnSave, mockOnFocus, mockOnBlur)
      )
      const firstCleanupCommands = result.current.cleanupCommands

      rerender()

      expect(result.current.cleanupCommands).toBe(firstCleanupCommands)
    })

    it('should remain stable when callbacks change', () => {
      const { result, rerender } = renderHook(
        ({ onSave }) => useEditorSetup(onSave, mockOnFocus, mockOnBlur),
        { initialProps: { onSave: mockOnSave } }
      )
      const firstCleanupCommands = result.current.cleanupCommands

      const newOnSave = vi.fn()
      rerender({ onSave: newOnSave })

      expect(result.current.cleanupCommands).toBe(firstCleanupCommands)
    })
  })

  describe('integration', () => {
    it('should handle complete setup and cleanup cycle', () => {
      const { result } = renderHook(() =>
        useEditorSetup(mockOnSave, mockOnFocus, mockOnBlur)
      )

      // Setup
      act(() => {
        result.current.setupCommands(mockEditorView)
      })

      expect(mockCreateEditorCommandRegistry).toHaveBeenCalledWith(mockOnSave)
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockGlobalCommandRegistry.register).toHaveBeenCalledWith(
        mockCommands,
        mockEditorView
      )
      expect(mockExportMenuCommands).toHaveBeenCalledTimes(1)

      // Cleanup
      act(() => {
        result.current.cleanupCommands()
      })

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockGlobalCommandRegistry.unregister).toHaveBeenCalledTimes(1)
      expect(mockCleanupMenuCommands).toHaveBeenCalledTimes(1)
    })

    it('should handle multiple setup calls', () => {
      const { result } = renderHook(() =>
        useEditorSetup(mockOnSave, mockOnFocus, mockOnBlur)
      )

      act(() => {
        result.current.setupCommands(mockEditorView)
        result.current.setupCommands(mockEditorView)
      })

      expect(mockCreateEditorCommandRegistry).toHaveBeenCalledTimes(2)
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockGlobalCommandRegistry.register).toHaveBeenCalledTimes(2)
      expect(mockExportMenuCommands).toHaveBeenCalledTimes(2)
    })

    it('should handle multiple cleanup calls', () => {
      const { result } = renderHook(() =>
        useEditorSetup(mockOnSave, mockOnFocus, mockOnBlur)
      )

      act(() => {
        result.current.cleanupCommands()
        result.current.cleanupCommands()
      })

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockGlobalCommandRegistry.unregister).toHaveBeenCalledTimes(2)
      expect(mockCleanupMenuCommands).toHaveBeenCalledTimes(2)
    })
  })

  describe('extensions recreation', () => {
    it('should recreate extensions when callbacks change', () => {
      const { rerender } = renderHook(
        ({ onSave, onFocus, onBlur }) =>
          useEditorSetup(onSave, onFocus, onBlur),
        {
          initialProps: {
            onSave: mockOnSave,
            onFocus: mockOnFocus,
            onBlur: mockOnBlur,
          },
        }
      )

      expect(mockCreateExtensions).toHaveBeenCalledTimes(1)

      const newOnSave = vi.fn()
      rerender({ onSave: newOnSave, onFocus: mockOnFocus, onBlur: mockOnBlur })

      expect(mockCreateExtensions).toHaveBeenCalledTimes(2)
      expect(mockCreateExtensions).toHaveBeenLastCalledWith({
        onFocus: mockOnFocus,
        onBlur: mockOnBlur,
        componentBuilderHandler: undefined,
      })
    })

    it('should recreate extensions when onFocus changes', () => {
      const { rerender } = renderHook(
        ({ onSave, onFocus, onBlur }) =>
          useEditorSetup(onSave, onFocus, onBlur),
        {
          initialProps: {
            onSave: mockOnSave,
            onFocus: mockOnFocus,
            onBlur: mockOnBlur,
          },
        }
      )

      const newOnFocus = vi.fn()
      rerender({ onSave: mockOnSave, onFocus: newOnFocus, onBlur: mockOnBlur })

      expect(mockCreateExtensions).toHaveBeenCalledTimes(2)
      expect(mockCreateExtensions).toHaveBeenLastCalledWith({
        onFocus: newOnFocus,
        onBlur: mockOnBlur,
        componentBuilderHandler: undefined,
      })
    })

    it('should recreate extensions when onBlur changes', () => {
      const { rerender } = renderHook(
        ({ onSave, onFocus, onBlur }) =>
          useEditorSetup(onSave, onFocus, onBlur),
        {
          initialProps: {
            onSave: mockOnSave,
            onFocus: mockOnFocus,
            onBlur: mockOnBlur,
          },
        }
      )

      const newOnBlur = vi.fn()
      rerender({ onSave: mockOnSave, onFocus: mockOnFocus, onBlur: newOnBlur })

      expect(mockCreateExtensions).toHaveBeenCalledTimes(2)
      expect(mockCreateExtensions).toHaveBeenLastCalledWith({
        onFocus: mockOnFocus,
        onBlur: newOnBlur,
        componentBuilderHandler: undefined,
      })
    })
  })
})
