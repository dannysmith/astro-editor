import React from 'react'
import { useEditorStore } from '../../../store/editorStore'
import { Switch } from '../../ui/switch'
import { FieldWrapper } from './FieldWrapper'
import type { FieldProps } from '../../../types/common'
import type { ZodField, SchemaField } from '../../../lib/schema'

interface BooleanFieldProps extends FieldProps {
  field?: ZodField | SchemaField
}

export const BooleanField: React.FC<BooleanFieldProps> = ({
  name,
  label,
  field,
}) => {
  const { frontmatter, updateFrontmatterField } = useEditorStore()

  // Helper function to get boolean value considering schema defaults
  const getBooleanValue = (value: unknown) => {
    // If field has a value, use it (handling both boolean and string values)
    if (value !== undefined && value !== null && value !== '') {
      return value === true || value === 'true'
    }

    // If no value, check schema default
    if (field?.default !== undefined) {
      if (field.default === 'true') {
        return true
      }
      if (field.default === 'false') {
        return false
      }
      // For other values, convert to boolean
      return Boolean(field.default)
    }

    // Fallback to false for boolean fields
    return false
  }

  // Check if field is required (handle both ZodField and SchemaField)
  const isRequired = field
    ? 'required' in field
      ? field.required
      : !field.optional
    : false

  return (
    <FieldWrapper
      label={label}
      required={isRequired}
      description={
        field && 'description' in field ? field.description : undefined
      }
      defaultValue={field?.default}
      currentValue={frontmatter[name]}
      layout="horizontal"
    >
      <Switch
        checked={getBooleanValue(frontmatter[name])}
        onCheckedChange={checked => updateFrontmatterField(name, checked)}
      />
    </FieldWrapper>
  )
}
