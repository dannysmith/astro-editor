import React from 'react'
import { useEditorStore } from '../../../store/editorStore'
import { Input } from '../../ui/input'
import { valueToString } from '../utils'
import { FieldWrapper } from './FieldWrapper'
import type { FieldProps } from '../../../types/common'
import type { ZodField, SchemaField } from '../../../lib/schema'

interface NumberFieldProps extends FieldProps {
  placeholder?: string
  field?: ZodField | SchemaField
}

export const NumberField: React.FC<NumberFieldProps> = ({
  name,
  label,
  placeholder,
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
      <Input
        type="number"
        placeholder={placeholder || `Enter ${label.toLowerCase()}...`}
        value={valueToString(frontmatter[name])}
        onChange={e => {
          const numValue = e.target.value ? Number(e.target.value) : undefined
          updateFrontmatterField(name, numValue)
        }}
      />
    </FieldWrapper>
  )
}
