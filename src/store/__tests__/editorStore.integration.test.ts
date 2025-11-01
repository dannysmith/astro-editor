import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useEditorStore } from '../editorStore'
import type { FileEntry } from '@/types'
import { useProjectStore } from '../projectStore'
import { resetToastMocks } from '../../test/mocks/toast'

// Mock the query client to prevent hanging on invalidateQueries
vi.mock('../../lib/query-client', () => ({
  queryClient: {
    invalidateQueries: vi.fn().mockResolvedValue(undefined),
  },
}))

const mockFileEntry: FileEntry = {
  id: 'test-file',
  name: 'test.md',
  path: '/test/content/blog/test.md',
  extension: 'md',
  isDraft: false,
  collection: 'blog',
}

describe('EditorStore Integration Tests - Auto-Save', () => {
  beforeEach(() => {
    // Use fake timers for all tests
    vi.useFakeTimers()
    // Set system time to a known baseline for deterministic tests
    vi.setSystemTime(new Date(0))

    // Reset all stores
    useEditorStore.setState({
      currentFile: null,
      editorContent: '',
      frontmatter: {},
      rawFrontmatter: '',
      imports: '',
      isDirty: false,
      autoSaveTimeoutId: null,
      lastSaveTimestamp: null,
    })

    useProjectStore.setState({
      projectPath: '/test',
      globalSettings: {
        general: {
          autoSaveDelay: 2, // 2 seconds debounce
          ideCommand: 'code',
          theme: 'system',
          highlights: {
            nouns: false,
            verbs: false,
            adjectives: false,
            adverbs: false,
            conjunctions: false,
          },
        },
        appearance: {
          headingColor: {
            light: '#000000',
            dark: '#FFFFFF',
          },
        },
        version: 1,
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

  describe('MDX Imports Preservation', () => {
    beforeEach(() => {
      // Use real timers for these tests since we don't care about auto-save timing
      vi.useRealTimers()

      // Mock the schema field order event that saveFile waits for
      window.addEventListener('get-schema-field-order', _event => {
        // Immediately respond with an empty field order
        window.dispatchEvent(
          new CustomEvent('schema-field-order-response', {
            detail: { fieldOrder: null },
          })
        )
      })
    })

    afterEach(() => {
      // Restore fake timers for other tests
      vi.useFakeTimers()

      // Clean up event listeners
      window.removeEventListener('get-schema-field-order', () => {})
    })

    it('should preserve imports when updating frontmatter and saving', async () => {
      // Setup: File with imports
      const mockImports = "import { Component } from 'astro:components';"

      useEditorStore.setState({
        currentFile: mockFileEntry,
        imports: mockImports,
        frontmatter: { title: 'Original Title' },
        editorContent: '# Content',
        isDirty: false,
        lastSaveTimestamp: Date.now(),
        autoSaveTimeoutId: null,
      })

      useProjectStore.setState({
        projectPath: '/test',
      })

      const store = useEditorStore.getState()

      // Update frontmatter - this is the operation that previously caused imports to be lost
      store.updateFrontmatterField('title', 'New Title')

      // Clear any scheduled auto-save and save manually for deterministic timing
      const state = useEditorStore.getState()
      if (state.autoSaveTimeoutId) {
        clearTimeout(state.autoSaveTimeoutId)
        useEditorStore.setState({ autoSaveTimeoutId: null })
      }

      await store.saveFile(false)

      // Verify: imports parameter was passed to save_markdown_content
      expect(globalThis.mockTauri.invoke).toHaveBeenCalledWith(
        'save_markdown_content',
        expect.objectContaining({
          imports: mockImports,
        })
      )
    })

    it('should preserve imports when editing content and saving', async () => {
      // Setup: File with complex multiline imports
      const mockImports = `import { Component } from 'astro:components';
import {
  Foo,
  Bar
} from './utils';`

      useEditorStore.setState({
        currentFile: mockFileEntry,
        imports: mockImports,
        frontmatter: { title: 'Test' },
        editorContent: 'Updated content',
        isDirty: true, // Mark as dirty so saveFile actually saves
        lastSaveTimestamp: Date.now(),
        autoSaveTimeoutId: null,
      })

      useProjectStore.setState({
        projectPath: '/test',
      })

      const store = useEditorStore.getState()

      // Trigger save directly
      await store.saveFile(false)

      // Verify: imports were preserved
      expect(globalThis.mockTauri.invoke).toHaveBeenCalledWith(
        'save_markdown_content',
        expect.objectContaining({
          imports: mockImports,
        })
      )
    })
  })
})
