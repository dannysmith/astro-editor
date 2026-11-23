import React from 'react'
import { useFrontmatterValue } from '../../../hooks/useFrontmatterValue'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select'
import { FieldWrapper } from './FieldWrapper'
import type { FieldControlProps } from './types'
import { NONE_SENTINEL } from './constants'

interface EnumFieldProps extends FieldControlProps {
  options: string[]
}

export const EnumField: React.FC<EnumFieldProps> = ({
  name,
  label,
  options,
  field,
}) => {
  const [value, setValue] = useFrontmatterValue(name)

  const labelId = `${React.useId()}-label`

  const items = [
    {
      value: NONE_SENTINEL,
      label: <span className="text-muted-foreground">(None)</span>,
    },
    ...options.map(option => ({ value: option, label: option })),
  ]

  return (
    <FieldWrapper label={label} field={field} value={value} labelId={labelId}>
      <Select
        items={items}
        value={value && typeof value === 'string' ? value : NONE_SENTINEL}
        onValueChange={value => {
          if (value === null) return
          // Special sentinel value means clear the field
          const finalValue = value === NONE_SENTINEL ? undefined : value
          setValue(finalValue)
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
