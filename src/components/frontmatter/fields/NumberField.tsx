import React from 'react'
import { useFrontmatterValue } from '../../../hooks/useFrontmatterValue'
import { Input } from '../../ui/input'
import { valueToString } from '../utils'
import { FieldWrapper } from './FieldWrapper'
import type { FieldControlProps } from './types'

interface NumberFieldProps extends FieldControlProps {
  placeholder?: string
}

export const NumberField: React.FC<NumberFieldProps> = ({
  name,
  label,
  placeholder,
  field,
}) => {
  const [value, setValue] = useFrontmatterValue(name)
  const id = React.useId()

  return (
    <FieldWrapper label={label} field={field} value={value} htmlFor={id}>
      <Input
        id={id}
        type="number"
        placeholder={placeholder || `Enter ${label.toLowerCase()}...`}
        value={valueToString(value)}
        onChange={e => {
          const numValue = e.target.value ? Number(e.target.value) : undefined
          setValue(numValue)
        }}
      />
    </FieldWrapper>
  )
}
