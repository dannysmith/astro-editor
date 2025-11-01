import React from 'react'
import { useEditorStore, getNestedValue } from '../../../store/editorStore'
import { Switch } from '../../ui/switch'
import { FieldWrapper } from './FieldWrapper'
import type { FieldProps } from '../../../types/common'
import type { SchemaField } from '../../../lib/schema'

interface BooleanFieldProps extends FieldProps {
  field?: SchemaField
}

export const BooleanField: React.FC<BooleanFieldProps> = ({
  name,
  label,
  field,
}) => {
  const value = useEditorStore(state => getNestedValue(state.frontmatter, name))
  const updateFrontmatterField = useEditorStore(
    state => state.updateFrontmatterField
  )

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

  // Check if field is required
  const isRequired = field ? field.required : false

  return (
    <FieldWrapper
      label={label}
      required={isRequired}
      description={
        field && 'description' in field ? field.description : undefined
      }
      defaultValue={field?.default}
      currentValue={value}
      layout="horizontal"
      hideDefaultValue={true}
    >
      <Switch
        checked={getBooleanValue(value)}
        onCheckedChange={checked => updateFrontmatterField(name, checked)}
      />
    </FieldWrapper>
  )
}
