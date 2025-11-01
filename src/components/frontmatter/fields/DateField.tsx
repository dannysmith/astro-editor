import React from 'react'
import { useEditorStore } from '../../../store/editorStore'
import { getNestedValue } from '../../../lib/object-utils'
import { DatePicker } from '../../ui/date-picker'
import { FieldWrapper } from './FieldWrapper'
import type { FieldProps } from '../../../types/common'
import type { SchemaField } from '../../../lib/schema'
import { formatIsoDate } from '../../../lib/dates'

interface DateFieldProps extends FieldProps {
  field?: SchemaField
}

export const DateField: React.FC<DateFieldProps> = ({
  name,
  label,
  required,
  field,
}) => {
  const value = useEditorStore(state => getNestedValue(state.frontmatter, name))
  const updateFrontmatterField = useEditorStore(
    state => state.updateFrontmatterField
  )

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
        value={value && typeof value === 'string' ? new Date(value) : undefined}
        onChange={(date: Date | undefined) => {
          const dateValue =
            date instanceof Date && !isNaN(date.getTime())
              ? formatIsoDate(date)
              : undefined
          updateFrontmatterField(name, dateValue)
        }}
        placeholder="Select date..."
      />
    </FieldWrapper>
  )
}
