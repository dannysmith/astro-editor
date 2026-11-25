import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { ArrayField } from './ArrayField'
import { useEditorStore } from '../../../store/editorStore'
import { renderWithProviders } from '../../../test/test-utils'
import { FieldType } from '../../../lib/schema'

describe('ArrayField Component', () => {
  beforeEach(() => {
    useEditorStore.setState({
      frontmatter: {},
      updateFrontmatterField: vi.fn((key: string, value: unknown) => {
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
      }),
    })
  })

  describe('Array Validation Logic', () => {
    it('should handle proper string arrays', () => {
      useEditorStore.setState({
        frontmatter: { tags: ['react', 'typescript', 'vite'] },
      })

      renderWithProviders(<ArrayField name="tags" label="Tags" />)

      expect(screen.getByText('react')).toBeInTheDocument()
      expect(screen.getByText('typescript')).toBeInTheDocument()
      expect(screen.getByText('vite')).toBeInTheDocument()
    })

    it('should handle empty arrays', () => {
      useEditorStore.setState({
        frontmatter: { tags: [] },
      })

      renderWithProviders(<ArrayField name="tags" label="Tags" />)

      expect(screen.getByRole('combobox')).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /remove.*tag/i })
      ).not.toBeInTheDocument()
    })

    it('should handle undefined values', () => {
      useEditorStore.setState({
        frontmatter: { tags: undefined },
      })

      renderWithProviders(<ArrayField name="tags" label="Tags" />)

      expect(screen.getByRole('combobox')).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /remove.*tag/i })
      ).not.toBeInTheDocument()
    })

    it('should handle non-array values gracefully', () => {
      useEditorStore.setState({
        frontmatter: { tags: 'not-an-array' },
      })

      renderWithProviders(<ArrayField name="tags" label="Tags" />)

      expect(screen.getByRole('combobox')).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /remove.*tag/i })
      ).not.toBeInTheDocument()
    })

    it('should handle arrays with non-string values', () => {
      useEditorStore.setState({
        frontmatter: { tags: [123, true, null, 'valid-string'] },
      })

      renderWithProviders(<ArrayField name="tags" label="Tags" />)

      // Should not render tags for mixed array types
      expect(screen.getByRole('combobox')).toBeInTheDocument()
      expect(screen.queryByText('123')).not.toBeInTheDocument()
      expect(screen.queryByText('valid-string')).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /remove.*tag/i })
      ).not.toBeInTheDocument()
    })

    it('should handle arrays with some non-string values', () => {
      useEditorStore.setState({
        frontmatter: { tags: ['react', 123, 'typescript'] },
      })

      renderWithProviders(<ArrayField name="tags" label="Tags" />)

      // Array validation should fail, showing empty input
      expect(screen.getByRole('combobox')).toBeInTheDocument()
      expect(screen.queryByText('react')).not.toBeInTheDocument()
      expect(screen.queryByText('typescript')).not.toBeInTheDocument()
    })
  })

  describe('Tag ID Generation', () => {
    it('should generate unique IDs for tags', () => {
      useEditorStore.setState({
        frontmatter: { tags: ['react', 'react', 'typescript'] },
      })

      renderWithProviders(<ArrayField name="tags" label="Tags" />)

      // Should show both 'react' tags (with different indices)
      const reactTags = screen.getAllByText('react')
      expect(reactTags).toHaveLength(2)

      // Should have unique remove buttons
      const removeButtons = screen.getAllByRole('button', {
        name: /remove.*tag/i,
      })
      expect(removeButtons).toHaveLength(3) // 2 react + 1 typescript
    })

    it('should handle tags with special characters in names', () => {
      useEditorStore.setState({
        frontmatter: { tags: ['React.js', 'Node.js', 'C++', 'C#'] },
      })

      renderWithProviders(<ArrayField name="tags" label="Tags" />)

      expect(screen.getByText('React.js')).toBeInTheDocument()
      expect(screen.getByText('Node.js')).toBeInTheDocument()
      expect(screen.getByText('C++')).toBeInTheDocument()
      expect(screen.getByText('C#')).toBeInTheDocument()
    })
  })

  describe('Tag Management', () => {
    it('should add new tags', () => {
      useEditorStore.setState({
        frontmatter: { tags: ['react'] },
      })

      renderWithProviders(<ArrayField name="tags" label="Tags" />)

      const input = screen.getByRole('combobox')
      fireEvent.change(input, { target: { value: 'typescript' } })
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

      const { frontmatter } = useEditorStore.getState()
      expect(frontmatter.tags).toEqual(['react', 'typescript'])
    })

    it('should remove tags', () => {
      useEditorStore.setState({
        frontmatter: { tags: ['react', 'typescript', 'vite'] },
      })

      renderWithProviders(<ArrayField name="tags" label="Tags" />)

      const removeButton = screen.getByLabelText('Remove typescript tag')
      fireEvent.click(removeButton)

      const { frontmatter } = useEditorStore.getState()
      expect(frontmatter.tags).toEqual(['react', 'vite'])
    })

    it('should handle removing all tags', () => {
      useEditorStore.setState({
        frontmatter: { tags: ['react'] },
      })

      renderWithProviders(<ArrayField name="tags" label="Tags" />)

      const removeButton = screen.getByLabelText('Remove react tag')
      fireEvent.click(removeButton)

      const { frontmatter } = useEditorStore.getState()
      expect(frontmatter.tags).toBeUndefined() // Should be removed from frontmatter
    })

    it('should prevent duplicate tags', () => {
      useEditorStore.setState({
        frontmatter: { tags: ['react', 'typescript'] },
      })

      renderWithProviders(<ArrayField name="tags" label="Tags" />)

      const input = screen.getByRole('combobox')
      fireEvent.change(input, { target: { value: 'react' } })
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

      const { frontmatter } = useEditorStore.getState()
      expect(frontmatter.tags).toEqual(['react', 'typescript']) // No duplicate added
    })

    it('should trim whitespace from new tags', () => {
      useEditorStore.setState({
        frontmatter: { tags: [] },
      })

      renderWithProviders(<ArrayField name="tags" label="Tags" />)

      const input = screen.getByRole('combobox')
      fireEvent.change(input, { target: { value: '  typescript  ' } })
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

      const { frontmatter } = useEditorStore.getState()
      expect(frontmatter.tags).toEqual(['typescript'])
    })

    it('should ignore empty tags', () => {
      useEditorStore.setState({
        frontmatter: { tags: ['react'] },
      })

      renderWithProviders(<ArrayField name="tags" label="Tags" />)

      const input = screen.getByRole('combobox')
      fireEvent.change(input, { target: { value: '   ' } })
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

      const { frontmatter } = useEditorStore.getState()
      expect(frontmatter.tags).toEqual(['react']) // No empty tag added
    })
  })

  describe('Required Field Indicator', () => {
    it('should show required indicator when required=true', () => {
      renderWithProviders(
        <ArrayField
          name="tags"
          label="Tags"
          field={{
            name: 'tags',
            label: 'Tags',
            type: FieldType.Array,
            required: true,
          }}
        />
      )

      expect(screen.getByText('(required)')).toBeInTheDocument()
    })

    it('should not show required indicator when required=false', () => {
      renderWithProviders(<ArrayField name="tags" label="Tags" />)

      expect(screen.queryByText('(required)')).not.toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle very long tag names', () => {
      const longTag = 'a'.repeat(100)
      useEditorStore.setState({
        frontmatter: { tags: [longTag] },
      })

      renderWithProviders(<ArrayField name="tags" label="Tags" />)

      expect(screen.getByText(longTag)).toBeInTheDocument()
      expect(screen.getByLabelText(`Remove ${longTag} tag`)).toBeInTheDocument()
    })

    it('should handle tags with unicode characters', () => {
      useEditorStore.setState({
        frontmatter: { tags: ['🚀', '测试', 'Ñiño'] },
      })

      renderWithProviders(<ArrayField name="tags" label="Tags" />)

      expect(screen.getByText('🚀')).toBeInTheDocument()
      expect(screen.getByText('测试')).toBeInTheDocument()
      expect(screen.getByText('Ñiño')).toBeInTheDocument()
    })

    it('should handle array with empty string elements', () => {
      useEditorStore.setState({
        frontmatter: { tags: ['react', '', 'typescript'] },
      })

      renderWithProviders(<ArrayField name="tags" label="Tags" />)

      // Should show all elements including empty strings as tags
      expect(screen.getByText('react')).toBeInTheDocument()
      expect(screen.getByText('typescript')).toBeInTheDocument()
      // Empty string creates a tag with no visible text but still has remove button
      expect(
        screen.getAllByRole('button', { name: /remove.*tag/i })
      ).toHaveLength(3)
    })
  })
})
