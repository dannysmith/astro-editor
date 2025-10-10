import React from 'react'
import { useEditorStore, getNestedValue } from '../../../store/editorStore'
import { AutoExpandingTextarea } from '../../ui/auto-expanding-textarea'
import { valueToString } from '../utils'
import { FieldWrapper } from './FieldWrapper'
import type { FieldProps } from '../../../types/common'
import type { SchemaField } from '../../../lib/schema'

interface TextareaFieldProps extends FieldProps {
  placeholder?: string
  minRows?: number
  maxRows?: number
  field?: SchemaField
}

export const TextareaField: React.FC<TextareaFieldProps> = ({
  name,
  label,
  placeholder,
  className,
  minRows = 2,
  maxRows = 6,
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
      <AutoExpandingTextarea
        id={name === 'title' ? 'frontmatter-title-field' : undefined}
        placeholder={placeholder || `Enter ${label.toLowerCase()}...`}
        className={className}
        minRows={minRows}
        maxRows={maxRows}
        value={valueToString(value)}
        onChange={e => updateFrontmatterField(name, e.target.value)}
      />
    </FieldWrapper>
  )
}
