import React from 'react'
import { useEditorStore } from '../../../store/editorStore'
import { getNestedValue } from '../../../lib/object-utils'
import { Input } from '../../ui/input'
import { valueToString } from '../utils'
import { FieldWrapper } from './FieldWrapper'
import type { FieldProps } from '../../../types/common'
import type { SchemaField } from '../../../lib/schema'

interface StringFieldProps extends FieldProps {
  placeholder?: string
  type?: 'text' | 'email' | 'url'
  field?: SchemaField
}

export const StringField: React.FC<StringFieldProps> = ({
  name,
  label,
  placeholder,
  className,
  required,
  type = 'text',
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
        type={type}
        name={name}
        placeholder={placeholder || `Enter ${label.toLowerCase()}...`}
        className={className}
        value={valueToString(value)}
        onChange={e => updateFrontmatterField(name, e.target.value)}
      />
    </FieldWrapper>
  )
}
