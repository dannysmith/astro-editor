import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from '../editorStore'
import type { FileEntry } from '@/types'
import { useProjectStore } from '../projectStore'
import { resetToastMocks } from '../../test/mocks/toast'

const mockFileEntry: FileEntry = {
  id: 'test-file',
  name: 'test.md',
  path: '/test/content/blog/test.md',
  extension: 'md',
  isDraft: false,
  collection: 'blog',
}

describe('Store ↔ Query Integration Tests', () => {
  beforeEach(() => {
    // Reset stores
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
          autoSaveDelay: 2,
          ideCommand: 'code',
          theme: 'system',
          highlights: {
            nouns: false,
            verbs: false,
            adjectives: false,
            adverbs: false,
            conjunctions: false,
          },
          defaultFileType: 'md',
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

  describe('Dirty State Management', () => {
    it('should set dirty state when content changes', () => {
      // Setup: File open, clean state
      useEditorStore.setState({
        currentFile: mockFileEntry,
        isDirty: false,
      })

      const store = useEditorStore.getState()
      expect(store.isDirty).toBe(false)

      // Change content
      store.setEditorContent('modified content')

      // Verify: Dirty state is now true
      const updatedStore = useEditorStore.getState()
      expect(updatedStore.isDirty).toBe(true)
    })

    it('should set dirty state when frontmatter changes', () => {
      useEditorStore.setState({
        currentFile: mockFileEntry,
        isDirty: false,
      })

      const store = useEditorStore.getState()
      expect(store.isDirty).toBe(false)

      // Change frontmatter
      store.updateFrontmatterField('title', 'New Title')

      // Verify: Dirty state is now true
      const updatedStore = useEditorStore.getState()
      expect(updatedStore.isDirty).toBe(true)
    })

    it('should reset dirty state when opening new file', () => {
      // Setup: Current file is dirty
      useEditorStore.setState({
        currentFile: mockFileEntry,
        editorContent: 'dirty content',
        isDirty: true,
      })

      const store = useEditorStore.getState()
      expect(store.isDirty).toBe(true)

      // Open different file
      const newFile: FileEntry = {
        ...mockFileEntry,
        id: 'new-file',
        name: 'new.md',
        path: '/test/content/blog/new.md',
      }

      store.openFile(newFile)

      // Verify: Dirty state was reset and file identifier updated
      const updatedStore = useEditorStore.getState()
      expect(updatedStore.isDirty).toBe(false)
      expect(updatedStore.currentFile).toEqual(newFile)
    })
  })

  describe('File Switching', () => {
    it('should update file identifier when opening file', () => {
      const store = useEditorStore.getState()

      // Open file (content loading is now handled by useFileContentQuery)
      store.openFile(mockFileEntry)

      // Verify: File identifier updated and clean state set
      const updatedStore = useEditorStore.getState()
      expect(updatedStore.currentFile).toEqual(mockFileEntry)
      expect(updatedStore.isDirty).toBe(false)
    })
  })

  describe('Content and Frontmatter Updates', () => {
    it('should merge frontmatter updates correctly', () => {
      useEditorStore.setState({
        frontmatter: { title: 'Original', author: 'John' },
      })

      const store = useEditorStore.getState()

      // Update one field
      store.updateFrontmatterField('title', 'Updated')

      // Verify: Field updated, others preserved
      const updatedStore = useEditorStore.getState()
      expect(updatedStore.frontmatter).toEqual({
        title: 'Updated',
        author: 'John',
      })
    })

    it('should remove frontmatter field when set to empty value', () => {
      useEditorStore.setState({
        frontmatter: { title: 'Title', tags: ['a', 'b'], draft: true },
      })

      const store = useEditorStore.getState()

      // Set field to empty string
      store.updateFrontmatterField('title', '')

      // Verify: Field removed
      let updatedStore = useEditorStore.getState()
      expect(updatedStore.frontmatter).toEqual({
        tags: ['a', 'b'],
        draft: true,
      })

      // Set array to empty
      store.updateFrontmatterField('tags', [])

      // Verify: Array field removed
      updatedStore = useEditorStore.getState()
      expect(updatedStore.frontmatter).toEqual({
        draft: true,
      })
    })

    it('should handle nested frontmatter updates', () => {
      useEditorStore.setState({
        frontmatter: {
          author: {
            name: 'John',
            email: 'john@example.com',
          },
        },
      })

      const store = useEditorStore.getState()

      // Update nested field using dot notation
      store.updateFrontmatterField('author.name', 'Jane')

      // Verify: Nested field updated
      const updatedStore = useEditorStore.getState()
      expect(updatedStore.frontmatter).toEqual({
        author: {
          name: 'Jane',
          email: 'john@example.com',
        },
      })
    })
  })
})
