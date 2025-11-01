import React from 'react'
import { useEditorStore, getNestedValue } from '../../../store/editorStore'
import { Input } from '../../ui/input'
import { valueToString } from '../utils'
import { FieldWrapper } from './FieldWrapper'
import type { FieldProps } from '../../../types/common'
import type { SchemaField } from '../../../lib/schema'

interface NumberFieldProps extends FieldProps {
  placeholder?: string
  field?: SchemaField
}

export const NumberField: React.FC<NumberFieldProps> = ({
  name,
  label,
  placeholder,
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
      <Input
        type="number"
        placeholder={placeholder || `Enter ${label.toLowerCase()}...`}
        value={valueToString(value)}
        onChange={e => {
          const numValue = e.target.value ? Number(e.target.value) : undefined
          updateFrontmatterField(name, numValue)
        }}
      />
    </FieldWrapper>
  )
}
