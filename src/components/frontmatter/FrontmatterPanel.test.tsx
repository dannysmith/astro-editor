import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/dom'
import { FrontmatterPanel } from './FrontmatterPanel'
import { useEditorStore } from '../../store/editorStore'
import type { Collection, FileEntry } from '@/types'
import { renderWithProviders } from '../../test/test-utils'

// Mock the query hook - will be configured per test
import { useCollectionsQuery } from '../../hooks/queries/useCollectionsQuery'
vi.mock('../../hooks/queries/useCollectionsQuery')

// Helper to create mock file entries with all required fields
const createMockFile = (overrides: Partial<FileEntry> = {}): FileEntry => ({
  id: 'posts/test',
  path: '/project/posts/test.md',
  name: 'test',
  extension: 'md',
  isDraft: false,
  collection: 'posts',
  last_modified: null,
  frontmatter: null,
  ...overrides,
})

describe('FrontmatterPanel Component', () => {
  // Helper to set up collections mock
  const mockCollectionsQuery = (collections: Collection[] = []) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    vi.mocked(useCollectionsQuery).mockReturnValue({
      data: collections,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
  }

  beforeEach(() => {
    // Default mock - no collections
    mockCollectionsQuery([])

    useEditorStore.setState({
      currentFile: null,
      frontmatter: {},
      updateFrontmatter: (frontmatter: Record<string, unknown>) => {
        useEditorStore.setState({ frontmatter })
      },
      updateFrontmatterField: (key: string, value: unknown) => {
        const { frontmatter } = useEditorStore.getState()
        const newFrontmatter = { ...frontmatter }

        if (
          value === null ||
          value === undefined ||
          value === '' ||
          (Array.isArray(value) && value.length === 0)
        ) {
          delete newFrontmatter[key]
        } else {
          newFrontmatter[key] = value
        }

        useEditorStore.setState({ frontmatter: newFrontmatter })
      },
    })
  })

  it('should show placeholder when no file is selected', () => {
    renderWithProviders(<FrontmatterPanel />)

    expect(
      screen.getByText('Select a file to edit its frontmatter.')
    ).toBeInTheDocument()
  })

  it('should show frontmatter fields when file is selected', () => {
    const mockFile = createMockFile()

    const mockFrontmatter = {
      title: 'Test Post',
      draft: false,
      tags: ['test', 'demo'],
      publishDate: '2023-12-01',
      rating: 5,
    }

    const mockCollection = {
      name: 'posts',
      path: '/project/posts',
      complete_schema: JSON.stringify({
        collectionName: 'posts',
        fields: [
          {
            name: 'title',
            label: 'Title',
            fieldType: 'string',
            required: true,
          },
          {
            name: 'draft',
            label: 'Draft',
            fieldType: 'boolean',
            required: false,
          },
          { name: 'tags', label: 'Tags', fieldType: 'array', required: false },
          {
            name: 'publishDate',
            label: 'Publish Date',
            fieldType: 'date',
            required: false,
          },
          {
            name: 'rating',
            label: 'Rating',
            fieldType: 'number',
            required: false,
          },
        ],
      }),
    }

    // Update mock to return collection
    mockCollectionsQuery([mockCollection])

    useEditorStore.setState({
      currentFile: mockFile,
      frontmatter: mockFrontmatter,
    })

    renderWithProviders(<FrontmatterPanel />)

    expect(screen.getByDisplayValue('Test Post')).toBeInTheDocument()
    expect(screen.getByRole('switch')).toBeInTheDocument()
    expect(screen.getByText('01/12/2023')).toBeInTheDocument() // Date shows as button text
    expect(screen.getByDisplayValue('5')).toBeInTheDocument()
  })

  it('should handle text input changes', () => {
    useEditorStore.setState({
      currentFile: createMockFile(),
      frontmatter: { title: 'Original Title' },
    })

    renderWithProviders(<FrontmatterPanel />)

    const titleInput = screen.getByDisplayValue('Original Title')
    fireEvent.change(titleInput, { target: { value: 'New Title' } })

    expect(useEditorStore.getState().frontmatter.title).toBe('New Title')
  })

  it('should handle boolean input changes', () => {
    const mockCollection = {
      name: 'posts',
      path: '/project/posts',
      complete_schema: JSON.stringify({
        collectionName: 'posts',
        fields: [
          {
            name: 'draft',
            label: 'Draft',
            fieldType: 'boolean',
            required: false,
          },
        ],
      }),
    }

    mockCollectionsQuery([mockCollection])

    useEditorStore.setState({
      currentFile: createMockFile(),
      frontmatter: { draft: false },
    })

    renderWithProviders(<FrontmatterPanel />)

    const draftSwitch = screen.getByRole('switch')
    expect(draftSwitch).not.toBeChecked()

    fireEvent.click(draftSwitch)

    expect(useEditorStore.getState().frontmatter.draft).toBe(true)
  })

  it('should handle number input changes', () => {
    const mockCollection = {
      name: 'posts',
      path: '/project/posts',
      complete_schema: JSON.stringify({
        collectionName: 'posts',
        fields: [
          {
            name: 'rating',
            label: 'Rating',
            fieldType: 'number',
            required: false,
          },
        ],
      }),
    }

    mockCollectionsQuery([mockCollection])

    useEditorStore.setState({
      currentFile: createMockFile(),
      frontmatter: { rating: 3 },
    })

    renderWithProviders(<FrontmatterPanel />)

    const ratingInput = screen.getByDisplayValue('3')
    fireEvent.change(ratingInput, { target: { value: '5' } })

    expect(useEditorStore.getState().frontmatter.rating).toBe(5)
  })

  it('should show message when no frontmatter fields exist', () => {
    useEditorStore.setState({
      currentFile: createMockFile(),
      frontmatter: {},
    })

    renderWithProviders(<FrontmatterPanel />)

    expect(screen.getByText('No frontmatter fields found.')).toBeInTheDocument()
  })

  it('should use schema information when available', () => {
    const mockCollection = {
      name: 'posts',
      path: '/project/posts',
      complete_schema: JSON.stringify({
        collectionName: 'posts',
        fields: [
          {
            name: 'title',
            label: 'Title',
            fieldType: 'string',
            required: true,
          },
          {
            name: 'publishDate',
            label: 'Publish Date',
            fieldType: 'date',
            required: false,
          },
          {
            name: 'draft',
            label: 'Draft',
            fieldType: 'boolean',
            required: false,
          },
          { name: 'tags', label: 'Tags', fieldType: 'array', required: false },
        ],
      }),
    }

    mockCollectionsQuery([mockCollection])

    useEditorStore.setState({
      currentFile: createMockFile(),
      frontmatter: { title: 'Test Post' },
    })

    renderWithProviders(<FrontmatterPanel />)

    // Should show all schema fields, even if not in frontmatter
    expect(screen.getByDisplayValue('Test Post')).toBeInTheDocument()
    expect(screen.getByRole('switch')).toBeInTheDocument() // Boolean field
    expect(screen.getByPlaceholderText('Enter tags...')).toBeInTheDocument() // Array field

    // Should show required indicator for title field (1 required field: title)
    expect(screen.getAllByText('*')).toHaveLength(1)
  })

  it('should show all schema fields even when not in frontmatter', () => {
    const mockCollection = {
      name: 'posts',
      path: '/project/posts',
      complete_schema: JSON.stringify({
        collectionName: 'posts',
        fields: [
          {
            name: 'title',
            label: 'Title',
            fieldType: 'string',
            required: true,
          },
          {
            name: 'description',
            label: 'Description',
            fieldType: 'string',
            required: false,
          },
          {
            name: 'publishDate',
            label: 'Publish Date',
            fieldType: 'date',
            required: false,
          },
        ],
      }),
    }

    mockCollectionsQuery([mockCollection])

    useEditorStore.setState({
      currentFile: createMockFile(),
      frontmatter: { title: 'Test Post' }, // Only has title, missing description and publishDate
    })

    renderWithProviders(<FrontmatterPanel />)

    // Should show all schema fields - focus on business logic, not UI details
    expect(screen.getByDisplayValue('Test Post')).toBeInTheDocument() // title
    expect(
      screen.getByPlaceholderText('Enter description...')
    ).toBeInTheDocument() // description (empty)

    // Verify the key business logic: missing fields are shown with empty values
    expect(useEditorStore.getState().frontmatter).toEqual({
      title: 'Test Post',
    })
  })

  it('should remove field from frontmatter when emptied', () => {
    useEditorStore.setState({
      currentFile: createMockFile(),
      frontmatter: { title: 'Test Post', description: 'Some description' },
    })

    renderWithProviders(<FrontmatterPanel />)

    const descriptionInput = screen.getByDisplayValue('Some description')
    fireEvent.change(descriptionInput, { target: { value: '' } })

    // Field should be removed from frontmatter when emptied
    const state = useEditorStore.getState()
    expect(state.frontmatter).toEqual({ title: 'Test Post' })
    expect(state.frontmatter.description).toBeUndefined()
  })

  it('should use TagInput for array fields defined in schema', () => {
    const mockCollection = {
      name: 'posts',
      path: '/project/posts',
      complete_schema: JSON.stringify({
        collectionName: 'posts',
        fields: [
          { name: 'tags', label: 'Tags', fieldType: 'array', required: false },
        ],
      }),
    }

    mockCollectionsQuery([mockCollection])

    useEditorStore.setState({
      currentFile: createMockFile(),
      frontmatter: { tags: ['react', 'typescript'] },
    })

    renderWithProviders(<FrontmatterPanel />)

    // Should render as TagInput with existing tags
    expect(screen.getByText('react')).toBeInTheDocument()
    expect(screen.getByText('typescript')).toBeInTheDocument()

    // Should have tag removal buttons
    expect(screen.getByLabelText('Remove react tag')).toBeInTheDocument()
    expect(screen.getByLabelText('Remove typescript tag')).toBeInTheDocument()
  })

  it('should use TagInput for array fields not in schema but present in frontmatter', () => {
    const mockCollection = {
      name: 'posts',
      path: '/project/posts',
      complete_schema: JSON.stringify({
        collectionName: 'posts',
        fields: [
          {
            name: 'title',
            label: 'Title',
            fieldType: 'string',
            required: true,
          },
        ],
      }),
    }

    mockCollectionsQuery([mockCollection])

    useEditorStore.setState({
      currentFile: createMockFile(),
      frontmatter: {
        title: 'Test Post',
        categories: ['tech', 'programming'], // Not in schema but is array of strings
      },
    })

    renderWithProviders(<FrontmatterPanel />)

    // Should render title as textarea (from schema)
    expect(screen.getByDisplayValue('Test Post')).toBeInTheDocument()

    // Should render categories as TagInput (inferred from frontmatter)
    expect(screen.getByText('tech')).toBeInTheDocument()
    expect(screen.getByText('programming')).toBeInTheDocument()
    expect(screen.getByLabelText('Remove tech tag')).toBeInTheDocument()
    expect(screen.getByLabelText('Remove programming tag')).toBeInTheDocument()
  })

  it('should not use TagInput for non-string arrays in frontmatter', () => {
    useEditorStore.setState({
      currentFile: createMockFile(),
      frontmatter: {
        numbers: [1, 2, 3], // Array but not strings
        mixed: ['string', 123], // Mixed array
      },
    })

    renderWithProviders(<FrontmatterPanel />)

    // Should render as text inputs, not TagInput
    expect(screen.getByDisplayValue('1,2,3')).toBeInTheDocument()
    expect(screen.getByDisplayValue('string,123')).toBeInTheDocument()

    // Should not have tag removal buttons
    expect(screen.queryByLabelText(/Remove.*tag/)).not.toBeInTheDocument()
  })

  it('should handle proper arrays from backend parsing', () => {
    useEditorStore.setState({
      currentFile: createMockFile(),
      frontmatter: {
        title: 'Test Post',
        tags: ['javascript', 'typescript', 'react'], // Proper array from backend
        categories: ['tech', 'programming'], // Another proper array
      },
    })

    renderWithProviders(<FrontmatterPanel />)

    // Should render title as text input
    expect(screen.getByDisplayValue('Test Post')).toBeInTheDocument()

    // Should render tags as TagInput
    expect(screen.getByText('javascript')).toBeInTheDocument()
    expect(screen.getByText('typescript')).toBeInTheDocument()
    expect(screen.getByText('react')).toBeInTheDocument()
    expect(screen.getByLabelText('Remove javascript tag')).toBeInTheDocument()

    // Should render categories as TagInput
    expect(screen.getByText('tech')).toBeInTheDocument()
    expect(screen.getByText('programming')).toBeInTheDocument()
    expect(screen.getByLabelText('Remove tech tag')).toBeInTheDocument()
  })
})
