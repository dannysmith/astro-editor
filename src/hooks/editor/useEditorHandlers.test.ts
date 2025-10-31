import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useEditorHandlers } from './useEditorHandlers'

// Mock the store
vi.mock('../../store/editorStore', () => ({
  useEditorStore: {
    getState: vi.fn(),
  },
}))

const { useEditorStore } = await import('../../store/editorStore')
const mockGetState = vi.mocked(useEditorStore.getState)

describe('useEditorHandlers', () => {
  let mockStoreState: {
    setEditorContent: ReturnType<typeof vi.fn>
    currentFile: {
      id: string
      name: string
      path: string
      extension: string
      isDraft: boolean
      collection: string
    } | null
    saveFile: ReturnType<typeof vi.fn>
    isDirty: boolean
    editorContent: string
    frontmatter: Record<string, unknown>
    rawFrontmatter: string
    imports: string
    openFile: ReturnType<typeof vi.fn>
    closeCurrentFile: ReturnType<typeof vi.fn>
    updateFrontmatterField: ReturnType<typeof vi.fn>
    scheduleAutoSave: ReturnType<typeof vi.fn>
    autoSaveTimeoutId: number | null
    lastSaveTimestamp: number | null
    updateFrontmatter: ReturnType<typeof vi.fn>
    updateCurrentFileAfterRename: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    vi.clearAllMocks()

    mockStoreState = {
      setEditorContent: vi.fn(),
      currentFile: {
        id: 'test',
        name: 'test.md',
        path: '/test/test.md',
        extension: 'md',
        isDraft: false,
        collection: 'test-collection',
      },
      saveFile: vi.fn(),
      isDirty: false,
      editorContent: '',
      frontmatter: {},
      rawFrontmatter: '',
      imports: '',
      openFile: vi.fn(),
      closeCurrentFile: vi.fn(),
      updateFrontmatterField: vi.fn(),
      scheduleAutoSave: vi.fn(),
      autoSaveTimeoutId: null,
      lastSaveTimestamp: null,
      updateFrontmatter: vi.fn(),
      updateCurrentFileAfterRename: vi.fn(),
    }

    mockGetState.mockReturnValue(mockStoreState)

    // Mock window global
    Object.defineProperty(window, 'isEditorFocused', {
      value: false,
      writable: true,
    })

    // Mock dispatchEvent
    window.dispatchEvent = vi.fn()
  })

  describe('handleChange', () => {
    it('should call setEditorContent with the new value', () => {
      const { result } = renderHook(() => useEditorHandlers())

      act(() => {
        result.current.handleChange('new content')
      })

      expect(mockStoreState.setEditorContent).toHaveBeenCalledWith(
        'new content'
      )
    })

    it('should be stable across re-renders', () => {
      const { result, rerender } = renderHook(() => useEditorHandlers())
      const firstHandler = result.current.handleChange

      rerender()

      expect(result.current.handleChange).toBe(firstHandler)
    })
  })

  describe('handleFocus', () => {
    it('should set window.isEditorFocused to true', () => {
      const { result } = renderHook(() => useEditorHandlers())

      act(() => {
        result.current.handleFocus()
      })

      expect(window.isEditorFocused).toBe(true)
    })

    it('should dispatch editor-focus-changed event', () => {
      const { result } = renderHook(() => useEditorHandlers())

      act(() => {
        result.current.handleFocus()
      })

      expect(window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'editor-focus-changed',
        })
      )
    })

    it('should be stable across re-renders', () => {
      const { result, rerender } = renderHook(() => useEditorHandlers())
      const firstHandler = result.current.handleFocus

      rerender()

      expect(result.current.handleFocus).toBe(firstHandler)
    })
  })

  describe('handleBlur', () => {
    it('should set window.isEditorFocused to false', () => {
      window.isEditorFocused = true
      const { result } = renderHook(() => useEditorHandlers())

      act(() => {
        result.current.handleBlur()
      })

      expect(window.isEditorFocused).toBe(false)
    })

    it('should dispatch editor-focus-changed event', () => {
      const { result } = renderHook(() => useEditorHandlers())

      act(() => {
        result.current.handleBlur()
      })

      expect(window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'editor-focus-changed',
        })
      )
    })

    it('should save file when current file exists and is dirty', () => {
      mockStoreState.isDirty = true
      const { result } = renderHook(() => useEditorHandlers())

      act(() => {
        result.current.handleBlur()
      })

      expect(mockGetState).toHaveBeenCalled()
      expect(mockStoreState.saveFile).toHaveBeenCalledTimes(1)
    })

    it('should not save file when no current file', () => {
      mockStoreState.currentFile = null
      mockStoreState.isDirty = true
      const { result } = renderHook(() => useEditorHandlers())

      act(() => {
        result.current.handleBlur()
      })

      expect(mockGetState).toHaveBeenCalled()
      expect(mockStoreState.saveFile).not.toHaveBeenCalled()
    })

    it('should not save file when not dirty', () => {
      mockStoreState.isDirty = false
      const { result } = renderHook(() => useEditorHandlers())

      act(() => {
        result.current.handleBlur()
      })

      expect(mockGetState).toHaveBeenCalled()
      expect(mockStoreState.saveFile).not.toHaveBeenCalled()
    })

    it('should be stable across re-renders when store state changes', () => {
      const { result, rerender } = renderHook(() => useEditorHandlers())
      const firstHandler = result.current.handleBlur

      // Change store state - handler should remain stable
      mockStoreState.currentFile = {
        id: 'new',
        name: 'new.md',
        path: '/test/new.md',
        extension: 'md',
        isDraft: false,
        collection: 'test-collection',
      }
      mockStoreState.isDirty = true
      mockStoreState.saveFile = vi.fn()
      mockGetState.mockReturnValue(mockStoreState)

      rerender()

      // Handler should be stable due to empty dependency array
      expect(result.current.handleBlur).toBe(firstHandler)
    })
  })

  describe('handleSave', () => {
    it('should save file when current file exists and is dirty', () => {
      mockStoreState.isDirty = true
      const { result } = renderHook(() => useEditorHandlers())

      act(() => {
        result.current.handleSave()
      })

      expect(mockGetState).toHaveBeenCalled()
      expect(mockStoreState.saveFile).toHaveBeenCalledTimes(1)
    })

    it('should not save file when no current file', () => {
      mockStoreState.currentFile = null
      mockStoreState.isDirty = true
      const { result } = renderHook(() => useEditorHandlers())

      act(() => {
        result.current.handleSave()
      })

      expect(mockGetState).toHaveBeenCalled()
      expect(mockStoreState.saveFile).not.toHaveBeenCalled()
    })

    it('should not save file when not dirty', () => {
      mockStoreState.isDirty = false
      const { result } = renderHook(() => useEditorHandlers())

      act(() => {
        result.current.handleSave()
      })

      expect(mockGetState).toHaveBeenCalled()
      expect(mockStoreState.saveFile).not.toHaveBeenCalled()
    })

    it('should be stable across re-renders when store state changes', () => {
      const { result, rerender } = renderHook(() => useEditorHandlers())
      const firstHandler = result.current.handleSave

      // Change store state - handler should remain stable
      mockStoreState.currentFile = {
        id: 'new',
        name: 'new.md',
        path: '/test/new.md',
        extension: 'md',
        isDraft: false,
        collection: 'test-collection',
      }
      mockStoreState.isDirty = true
      mockStoreState.saveFile = vi.fn()
      mockGetState.mockReturnValue(mockStoreState)

      rerender()

      // Handler should be stable due to empty dependency array
      expect(result.current.handleSave).toBe(firstHandler)
    })
  })

  describe('return value', () => {
    it('should return all handler functions', () => {
      const { result } = renderHook(() => useEditorHandlers())

      expect(result.current).toHaveProperty('handleChange')
      expect(result.current).toHaveProperty('handleFocus')
      expect(result.current).toHaveProperty('handleBlur')
      expect(result.current).toHaveProperty('handleSave')

      expect(typeof result.current.handleChange).toBe('function')
      expect(typeof result.current.handleFocus).toBe('function')
      expect(typeof result.current.handleBlur).toBe('function')
      expect(typeof result.current.handleSave).toBe('function')
    })
  })
})
