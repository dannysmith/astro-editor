import React from 'react'
import { useFrontmatterValue } from '../../../hooks/useFrontmatterValue'
import { Switch } from '../../ui/switch'
import { FieldWrapper } from './FieldWrapper'
import type { FieldControlProps } from './types'
import { booleanDefault } from '../../../lib/schema'

export const BooleanField: React.FC<FieldControlProps> = ({
  name,
  label,
  field,
}) => {
  const [value, setValue] = useFrontmatterValue(name)

  // The file's value (boolean or text), otherwise the schema's default
  const getBooleanValue = (value: unknown) => {
    if (value !== undefined && value !== null && value !== '') {
      return value === true || value === 'true'
    }
    return booleanDefault(field)
  }

  const id = React.useId()

  return (
    <FieldWrapper
      label={label}
      field={field}
      value={value}
      htmlFor={id}
      layout="horizontal"
      // The switch itself shows the default
      hideDefaultValue
    >
      <Switch
        id={id}
        checked={getBooleanValue(value)}
        onCheckedChange={checked => setValue(checked)}
      />
    </FieldWrapper>
  )
}
