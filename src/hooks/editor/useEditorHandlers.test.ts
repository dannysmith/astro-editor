import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useEditorHandlers } from './useEditorHandlers'
import type { FileEntry } from '@/types'

// Mock the store
vi.mock('../../store/editorStore', () => ({
  useEditorStore: {
    getState: vi.fn(),
  },
}))

const { useEditorStore } = await import('../../store/editorStore')
const mockGetState = vi.mocked(useEditorStore.getState)

// Helper to create mock file entries
const createMockFile = (overrides: Partial<FileEntry> = {}): FileEntry => ({
  id: 'test',
  name: 'test.md',
  path: '/test/test.md',
  extension: 'md',
  isDraft: false,
  collection: 'test-collection',
  last_modified: null,
  frontmatter: null,
  ...overrides,
})

// Type for mocked store state matching EditorState interface
interface MockEditorState {
  setEditorContent: Mock
  currentFile: FileEntry | null
  saveFile: Mock
  isDirty: boolean
  isFrontmatterDirty: boolean
  editorContent: string
  frontmatter: Record<string, unknown>
  rawFrontmatter: string
  imports: string
  openFile: Mock
  closeCurrentFile: Mock
  updateFrontmatterField: Mock
  scheduleAutoSave: Mock
  autoSaveTimeoutId: ReturnType<typeof setTimeout> | null
  lastSaveTimestamp: number | null
  updateFrontmatter: Mock
  updateCurrentFileAfterRename: Mock
  autoSaveCallback: ((showToast?: boolean) => Promise<void>) | null
  setAutoSaveCallback: Mock
}

describe('useEditorHandlers', () => {
  let mockStoreState: MockEditorState

  beforeEach(() => {
    vi.clearAllMocks()

    mockStoreState = {
      setEditorContent: vi.fn(),
      currentFile: createMockFile(),
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
      autoSaveCallback: null,
      setAutoSaveCallback: vi.fn(),
      isFrontmatterDirty: false,
    }

    // Cast to unknown first to satisfy TypeScript when mocking store state
    mockGetState.mockReturnValue(
      mockStoreState as unknown as ReturnType<typeof useEditorStore.getState>
    )

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
      mockStoreState.currentFile = createMockFile({
        id: 'new',
        name: 'new.md',
        path: '/test/new.md',
      })
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
      mockStoreState.currentFile = createMockFile({
        id: 'new',
        name: 'new.md',
        path: '/test/new.md',
      })
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
