import React from 'react'
import { useEditorStore } from '../../../store/editorStore'
import { Switch } from '../../ui/switch'
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
    <div className="flex items-center justify-between">
      <label className="text-sm font-medium text-foreground">
        {label}
        {isRequired && <span className="text-destructive ml-1">*</span>}
      </label>
      <Switch
        checked={getBooleanValue(frontmatter[name])}
        onCheckedChange={checked => updateFrontmatterField(name, checked)}
      />
    </div>
  )
}
