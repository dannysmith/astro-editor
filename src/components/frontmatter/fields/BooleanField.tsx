import React from 'react'
import { useEditorStore } from '../../../store/editorStore'
import { getNestedValue } from '../../../lib/object-utils'
import { Switch } from '../../ui/switch'
import { FieldLabel, FieldDescription } from '../../ui/field'
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

  const isRequired = field ? field.required : false
  const description =
    field && 'description' in field ? field.description : undefined

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <FieldLabel>
          {label}
          {isRequired && <span className="text-required ml-1">*</span>}
        </FieldLabel>
        <Switch
          checked={getBooleanValue(value)}
          onCheckedChange={checked => updateFrontmatterField(name, checked)}
        />
      </div>
      {description && <FieldDescription>{description}</FieldDescription>}
    </div>
  )
}
