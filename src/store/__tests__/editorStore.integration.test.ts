import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useEditorStore } from '../editorStore'
import { useProjectStore } from '../projectStore'
import { resetToastMocks } from '../../test/mocks/toast'
import type { FileEntry } from '../../types/file-entry'

const mockFileEntry: FileEntry = {
  id: 'test-file',
  name: 'test.md',
  path: '/test/content/blog/test.md',
  extension: 'md',
  isDirty: false,
  collection: 'blog',
}

describe('EditorStore Integration Tests - Auto-Save', () => {
  let mockSaveFile: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // Use fake timers for all tests
    vi.useFakeTimers()

    // Create a mock for saveFile that we can spy on
    mockSaveFile = vi.fn().mockResolvedValue(undefined)

    // Reset all stores
    useEditorStore.setState({
      currentFile: null,
      editorContent: '',
      frontmatter: {},
      rawFrontmatter: '',
      imports: '',
      isDirty: false,
      recentlySavedFile: null,
      autoSaveTimeoutId: null,
      lastSaveTimestamp: null,
    })

    useProjectStore.setState({
      projectPath: '/test',
      globalSettings: {
        general: {
          autoSaveDelay: 2, // 2 seconds debounce
        },
      },
    })

    // Reset mocks
    resetToastMocks()
    globalThis.mockTauri.reset()
    globalThis.mockTauri.invoke.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  describe('Force Save After Max Delay (Task #1 Fix Validation)', () => {
    it('should trigger force save check during continuous typing', () => {
      // Spy on the saveFile method
      const saveFileSpy = vi.spyOn(useEditorStore.getState(), 'saveFile')

      // Setup: Open a file with save timestamp from 5 seconds ago
      useEditorStore.setState({
        currentFile: mockFileEntry,
        lastSaveTimestamp: Date.now() - 5000,
        isDirty: false,
      })

      const store = useEditorStore.getState()

      // Type once - this will check if 10s has passed (5s ago + 5s now = 10s)
      // The current time will be Date.now() which we can control by advancing fake time
      vi.advanceTimersByTime(5000) // Advance 5 more seconds
      store.setEditorContent('content after 10s')

      // Verify: Force save should have been triggered because 10s elapsed
      expect(saveFileSpy).toHaveBeenCalledWith(false)

      saveFileSpy.mockRestore()
    })

    it('should schedule debounced save when typing with pauses', () => {
      useEditorStore.setState({
        currentFile: mockFileEntry,
        lastSaveTimestamp: Date.now(),
      })

      const store = useEditorStore.getState()

      // Type with pauses under the 2s debounce threshold
      store.setEditorContent('content 1')
      vi.advanceTimersByTime(500)

      store.setEditorContent('content 2')
      vi.advanceTimersByTime(500)

      store.setEditorContent('content 3')

      // Verify: Auto-save timeout should be scheduled
      const storeState = useEditorStore.getState()
      expect(storeState.autoSaveTimeoutId).not.toBeNull()

      // Verify: Dirty state is true
      expect(storeState.isDirty).toBe(true)
    })
  })

  describe('Dirty State Changes', () => {
    it('should set dirty state when content changes', () => {
      useEditorStore.setState({
        currentFile: mockFileEntry,
        isDirty: false,
      })

      const store = useEditorStore.getState()

      // Change content
      store.setEditorContent('modified content')

      // Verify: Dirty state is now true
      expect(useEditorStore.getState().isDirty).toBe(true)
    })

    it('should set dirty state when frontmatter changes', () => {
      useEditorStore.setState({
        currentFile: mockFileEntry,
        isDirty: false,
      })

      const store = useEditorStore.getState()

      // Change frontmatter
      store.updateFrontmatterField('title', 'New Title')

      // Verify: Dirty state is now true
      expect(useEditorStore.getState().isDirty).toBe(true)
    })
  })

  describe('Auto-Save Scheduling', () => {
    it('should schedule auto-save when content changes', () => {
      useEditorStore.setState({
        currentFile: mockFileEntry,
        lastSaveTimestamp: Date.now(),
      })

      const store = useEditorStore.getState()

      // Change content
      store.setEditorContent('new content')

      // Verify: Auto-save timeout is scheduled
      const storeState = useEditorStore.getState()
      expect(storeState.autoSaveTimeoutId).not.toBeNull()
    })

    it('should clear previous timeout when scheduling new auto-save', () => {
      useEditorStore.setState({
        currentFile: mockFileEntry,
        lastSaveTimestamp: Date.now(),
      })

      const store = useEditorStore.getState()

      // First change
      store.setEditorContent('content 1')
      const firstTimeoutId = useEditorStore.getState().autoSaveTimeoutId

      // Second change (should clear first timeout)
      store.setEditorContent('content 2')
      const secondTimeoutId = useEditorStore.getState().autoSaveTimeoutId

      // Verify: Timeout IDs are different
      expect(secondTimeoutId).not.toBeNull()
      expect(secondTimeoutId).not.toBe(firstTimeoutId)
    })
  })

  describe('Max Delay Force Save Logic', () => {
    it('should not force save if less than 10s since last save', () => {
      const saveFileSpy = vi.spyOn(useEditorStore.getState(), 'saveFile')

      // Setup: Last save was only 3 seconds ago
      useEditorStore.setState({
        currentFile: mockFileEntry,
        lastSaveTimestamp: Date.now() - 3000,
        isDirty: false,
      })

      const store = useEditorStore.getState()

      // Type (only 3s has passed, less than 10s max)
      store.setEditorContent('content')

      // Verify: Force save was NOT triggered
      expect(saveFileSpy).not.toHaveBeenCalled()

      saveFileSpy.mockRestore()
    })

    it('should force save if more than 10s since last save', () => {
      const saveFileSpy = vi.spyOn(useEditorStore.getState(), 'saveFile')

      // Setup: Last save was 11 seconds ago
      useEditorStore.setState({
        currentFile: mockFileEntry,
        lastSaveTimestamp: Date.now() - 11000,
        isDirty: true,
      })

      const store = useEditorStore.getState()

      // Type (11s has passed, exceeds 10s max)
      store.setEditorContent('content')

      // Verify: Force save WAS triggered
      expect(saveFileSpy).toHaveBeenCalledWith(false)

      saveFileSpy.mockRestore()
    })
  })
})
