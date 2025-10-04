import React from 'react'
import { useEditorStore } from '../../../store/editorStore'
import { DatePicker } from '../../ui/date-picker'
import { FieldWrapper } from './FieldWrapper'
import type { FieldProps } from '../../../types/common'
import type { ZodField, SchemaField } from '../../../lib/schema'

interface DateFieldProps extends FieldProps {
  field?: ZodField | SchemaField
}

export const DateField: React.FC<DateFieldProps> = ({
  name,
  label,
  required,
  field,
}) => {
  const { frontmatter, updateFrontmatterField } = useEditorStore()

  return (
    <FieldWrapper
      label={label}
      required={required}
      description={
        field && 'description' in field ? field.description : undefined
      }
      defaultValue={field?.default}
      constraints={field?.constraints}
      currentValue={frontmatter[name]}
    >
      <DatePicker
        value={
          frontmatter[name] && typeof frontmatter[name] === 'string'
            ? new Date(frontmatter[name])
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
