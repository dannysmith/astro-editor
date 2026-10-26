import React from 'react'
import { useEditorStore } from '../../../store/editorStore'
import { getNestedValue } from '../../../lib/object-utils'
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

  const labelId = `${React.useId()}-label`

  const items = [
    {
      value: NONE_SENTINEL,
      label: <span className="text-muted-foreground">(None)</span>,
    },
    ...options.map(option => ({ value: option, label: option })),
  ]

  return (
    <FieldWrapper
      label={label}
      labelId={labelId}
      required={required}
      description={
        field && 'description' in field ? field.description : undefined
      }
      defaultValue={field?.default}
      constraints={field?.constraints}
      currentValue={value}
    >
      <Select
        items={items}
        value={value && typeof value === 'string' ? value : NONE_SENTINEL}
        onValueChange={value => {
          if (value === null) return
          // Special sentinel value means clear the field
          const finalValue = value === NONE_SENTINEL ? undefined : value
          updateFrontmatterField(name, finalValue)
        }}
      >
        <SelectTrigger aria-labelledby={labelId}>
          <SelectValue placeholder={`Select ${label.toLowerCase()}...`} />
        </SelectTrigger>
        <SelectContent>
          {items.map(item => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldWrapper>
  )
}
