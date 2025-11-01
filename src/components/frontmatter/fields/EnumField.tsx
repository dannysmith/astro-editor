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
import { NONE_SENTINEL } from './constants'

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
      <Select
        value={value && typeof value === 'string' ? value : NONE_SENTINEL}
        onValueChange={value => {
          // Special sentinel value means clear the field
          const finalValue = value === NONE_SENTINEL ? undefined : value
          updateFrontmatterField(name, finalValue)
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder={`Select ${label.toLowerCase()}...`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_SENTINEL}>
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
