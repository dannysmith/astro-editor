import React from 'react'
import { useEditorStore, getNestedValue } from '../../../store/editorStore'
import { DatePicker } from '../../ui/date-picker'
import { FieldWrapper } from './FieldWrapper'
import type { FieldProps } from '../../../types/common'
import type { SchemaField } from '../../../lib/schema'

interface DateFieldProps extends FieldProps {
  field?: SchemaField
}

export const DateField: React.FC<DateFieldProps> = ({
  name,
  label,
  required,
  field,
}) => {
  const { frontmatter, updateFrontmatterField } = useEditorStore()
  const value = getNestedValue(frontmatter, name)

  return (
    <FieldWrapper
      label={label}
      required={required}
      description={
        field && 'description' in field ? field.description : undefined
      }
      defaultValue={field?.default}
      constraints={field?.constraints}
      currentValue={value}
    >
      <DatePicker
        value={
          value && typeof value === 'string'
            ? new Date(value)
            : undefined
        }
        onChange={(date: Date | undefined) => {
          const dateValue =
            date instanceof Date && !isNaN(date.getTime())
              ? date.toISOString().split('T')[0]
              : undefined
          updateFrontmatterField(name, dateValue)
        }}
        placeholder="Select date..."
      />
    </FieldWrapper>
  )
}
