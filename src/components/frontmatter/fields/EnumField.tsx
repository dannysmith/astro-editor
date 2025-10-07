import React from 'react'
import { useEditorStore, getNestedValue } from '../../../store/editorStore'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select'
import { FieldWrapper } from './FieldWrapper'
import type { FieldProps } from '../../../types/common'
import type { SchemaField } from '../../../lib/schema'

interface EnumFieldProps extends FieldProps {
  options: string[]
  field?: SchemaField
}

export const EnumField: React.FC<EnumFieldProps> = ({
  name,
  label,
  options,
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
      <Select
        value={value && typeof value === 'string' ? value : '__NONE__'}
        onValueChange={value => {
          // Special sentinel value means clear the field
          const finalValue = value === '__NONE__' ? undefined : value
          updateFrontmatterField(name, finalValue)
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder={`Select ${label.toLowerCase()}...`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__NONE__">
            <span className="text-muted-foreground">(None)</span>
          </SelectItem>
          {options.map(option => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldWrapper>
  )
}
