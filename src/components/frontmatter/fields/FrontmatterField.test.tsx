import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { FrontmatterField } from './FrontmatterField'
import { useEditorStore } from '../../../store/editorStore'
import { renderWithProviders } from '../../../test/test-utils'
import { FieldType, type SchemaField } from '../../../lib/schema'

// Mock the project registry utils
vi.mock('../../../../lib/project-registry/effective-settings', () => ({
  useEffectiveSettings: () => ({
    frontmatterMappings: {
      title: 'title',
      description: 'description',
    },
  }),
}))

describe('FrontmatterField Orchestrator', () => {
  beforeEach(() => {
    useEditorStore.setState({
      frontmatter: {},
      updateFrontmatterField: vi.fn(),
    })
  })

  describe('Field Type Selection Logic', () => {
    it('should render BooleanField for Boolean schema type', () => {
      const booleanField: SchemaField = {
        name: 'draft',
        label: 'Draft',
        type: FieldType.Boolean,
        required: false,
      }

      renderWithProviders(
        <FrontmatterField name="draft" label="Draft" field={booleanField} />
      )

      expect(screen.getByRole('switch')).toBeInTheDocument()
    })

    it('should render BooleanField for checkbox input type', () => {
      const checkboxField: SchemaField = {
        name: 'published',
        label: 'Published',
        type: FieldType.Boolean,
        required: true,
      }

      renderWithProviders(
        <FrontmatterField
          name="published"
          label="Published"
          field={checkboxField}
        />
      )

      expect(screen.getByRole('switch')).toBeInTheDocument()
    })

    it('should render NumberField for Number schema type', () => {
      const numberField: SchemaField = {
        name: 'rating',
        label: 'Rating',
        type: FieldType.Number,
        required: false,
      }

      renderWithProviders(
        <FrontmatterField name="rating" label="Rating" field={numberField} />
      )

      expect(screen.getByRole('spinbutton')).toBeInTheDocument()
    })

    it('should render DateField for Date schema type', () => {
      const dateField: SchemaField = {
        name: 'publishDate',
        label: 'Publish Date',
        type: FieldType.Date,
        required: false,
      }

      renderWithProviders(
        <FrontmatterField
          name="publishDate"
          label="Publish Date"
          field={dateField}
        />
      )

      expect(screen.getByRole('button')).toBeInTheDocument() // Date picker button
    })

    it('should render EnumField for Enum schema type with options', () => {
      const enumField: SchemaField = {
        name: 'status',
        label: 'Status',
        type: FieldType.Enum,
        required: true,
        enumValues: ['draft', 'published', 'archived'],
      }

      renderWithProviders(
        <FrontmatterField name="status" label="Status" field={enumField} />
      )

      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    it('should render ArrayField for Array schema type', () => {
      const arrayField: SchemaField = {
        name: 'tags',
        label: 'Tags',
        type: FieldType.Array,
        required: false,
      }

      renderWithProviders(
        <FrontmatterField name="tags" label="Tags" field={arrayField} />
      )

      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })
  })

  describe('Array Field Detection without Schema', () => {
    it('should use ArrayField for string arrays in frontmatter without schema', () => {
      useEditorStore.setState({
        frontmatter: { categories: ['tech', 'programming'] },
      })

      renderWithProviders(
        <FrontmatterField name="categories" label="Categories" />
      )

      expect(screen.getByText('tech')).toBeInTheDocument()
      expect(screen.getByText('programming')).toBeInTheDocument()
    })

    it('should not use ArrayField for non-string arrays', () => {
      useEditorStore.setState({
        frontmatter: { numbers: [1, 2, 3] },
      })

      renderWithProviders(<FrontmatterField name="numbers" label="Numbers" />)

      // Should render as StringField, not ArrayField
      expect(screen.getByRole('textbox')).toBeInTheDocument()
      expect(screen.queryByText('1')).not.toBeInTheDocument() // No tag display
    })

    it('should not use ArrayField for mixed arrays', () => {
      useEditorStore.setState({
        frontmatter: { mixed: ['string', 123, true] },
      })

      renderWithProviders(<FrontmatterField name="mixed" label="Mixed" />)

      // Should render as StringField, not ArrayField
      expect(screen.getByRole('textbox')).toBeInTheDocument()
      expect(screen.queryByText('string')).not.toBeInTheDocument() // No tag display
    })

    it('should not use ArrayField for non-array values', () => {
      useEditorStore.setState({
        frontmatter: { notArray: 'just a string' },
      })

      renderWithProviders(
        <FrontmatterField name="notArray" label="Not Array" />
      )

      expect(screen.getByDisplayValue('just a string')).toBeInTheDocument()
    })
  })

  describe('Special Field Mappings', () => {
    it('should render TextareaField for title mapping with special styling', () => {
      renderWithProviders(<FrontmatterField name="title" label="Title" />)

      const textarea = screen.getByRole('textbox')
      expect(textarea).toBeInTheDocument()
      expect(textarea).toHaveClass('text-lg', 'font-bold')
    })

    it('should render TextareaField for description mapping with larger size', () => {
      renderWithProviders(
        <FrontmatterField name="description" label="Description" />
      )

      const textarea = screen.getByRole('textbox')
      expect(textarea).toBeInTheDocument()
      // TextareaField should be rendered (can't easily test minRows/maxRows in JSDOM)
    })

    it('should override schema type for title mapping', () => {
      const stringField: SchemaField = {
        name: 'title',
        label: 'Title',
        type: FieldType.String,
        required: true,
      }

      renderWithProviders(
        <FrontmatterField name="title" label="Title" field={stringField} />
      )

      // Should render as TextareaField despite being String type in schema
      const textarea = screen.getByRole('textbox')
      expect(textarea).toBeInTheDocument()
      expect(textarea).toHaveClass('text-lg', 'font-bold')
    })

    it('should override schema type for description mapping', () => {
      const stringField: SchemaField = {
        name: 'description',
        label: 'Description',
        type: FieldType.String,
        required: false,
      }

      renderWithProviders(
        <FrontmatterField
          name="description"
          label="Description"
          field={stringField}
        />
      )

      // Should render as TextareaField despite being String type in schema
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })
  })

  describe('Required Field Handling', () => {
    it('should pass required=true for non-optional schema fields', () => {
      const requiredField: SchemaField = {
        name: 'title',
        label: 'Title',
        type: FieldType.String,
        required: true,
      }

      renderWithProviders(
        <FrontmatterField name="title" label="Title" field={requiredField} />
      )

      expect(screen.getByText('*')).toBeInTheDocument()
    })

    it('should pass required=false for optional schema fields', () => {
      const optionalField: SchemaField = {
        name: 'description',
        label: 'Description',
        type: FieldType.String,
        required: false,
      }

      renderWithProviders(
        <FrontmatterField
          name="description"
          label="Description"
          field={optionalField}
        />
      )

      expect(screen.queryByText('*')).not.toBeInTheDocument()
    })

    it('should default to required=false when no schema field', () => {
      renderWithProviders(
        <FrontmatterField name="custom" label="Custom Field" />
      )

      expect(screen.queryByText('*')).not.toBeInTheDocument()
    })
  })

  describe('Complex Branching Logic', () => {
    it('should prioritize Array schema type over frontmatter array detection', () => {
      const arrayField: SchemaField = {
        name: 'tags',
        label: 'Tags',
        type: FieldType.Array,
        required: false,
      }

      useEditorStore.setState({
        frontmatter: { tags: 'not-an-array-but-schema-says-array' },
      })

      renderWithProviders(
        <FrontmatterField name="tags" label="Tags" field={arrayField} />
      )

      // Should render ArrayField because schema says Array
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('should prioritize Boolean schema type over input type detection', () => {
      const booleanField: SchemaField = {
        name: 'flag',
        label: 'Flag',
        type: FieldType.Boolean,
        required: false,
      }

      renderWithProviders(
        <FrontmatterField name="flag" label="Flag" field={booleanField} />
      )

      // Should render BooleanField (switch) not based on input type
      expect(screen.getByRole('switch')).toBeInTheDocument()
    })

    it('should handle multiple conditions in shouldUseArrayField', () => {
      // Test the complex condition: field?.type === 'Array' || (!field && Array.isArray(...))

      // Case 1: No field, but frontmatter has string array
      useEditorStore.setState({
        frontmatter: { categories: ['tech', 'programming'] },
      })

      renderWithProviders(
        <FrontmatterField name="categories" label="Categories" />
      )

      expect(screen.getByText('tech')).toBeInTheDocument()
      expect(screen.getByText('programming')).toBeInTheDocument()
    })

    it('should handle enum field without options gracefully', () => {
      const enumFieldNoOptions: SchemaField = {
        name: 'status',
        label: 'Status',
        type: FieldType.Enum,
        required: false,
        // Missing enumValues property
      }

      renderWithProviders(
        <FrontmatterField
          name="status"
          label="Status"
          field={enumFieldNoOptions}
        />
      )

      // Should fall back to StringField when Enum has no options
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('should handle input type fallback chain', () => {
      // Test the fallback for Unknown type
      const unknownField: SchemaField = {
        name: 'unknown',
        label: 'Unknown',
        type: FieldType.Unknown,
        required: false,
      }

      renderWithProviders(
        <FrontmatterField name="unknown" label="Unknown" field={unknownField} />
      )

      // Should fall back to StringField for unknown types
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle undefined field gracefully', () => {
      renderWithProviders(
        <FrontmatterField name="custom" label="Custom" field={undefined} />
      )

      // Should render StringField by default
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('should handle field with all optional properties undefined', () => {
      const minimalField: SchemaField = {
        name: 'minimal',
        label: 'Minimal',
        type: FieldType.String,
        required: false,
      }

      renderWithProviders(
        <FrontmatterField name="minimal" label="Minimal" field={minimalField} />
      )

      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('should handle empty frontmatter values for array detection', () => {
      useEditorStore.setState({
        frontmatter: { emptyArray: [] },
      })

      renderWithProviders(
        <FrontmatterField name="emptyArray" label="Empty Array" />
      )

      // Empty array should still trigger ArrayField
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })
  })
})
