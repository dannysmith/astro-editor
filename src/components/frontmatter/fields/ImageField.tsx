import React from 'react'
import { useFrontmatterValue } from '../../../hooks/useFrontmatterValue'
import { FieldWrapper } from './FieldWrapper'
import { ImagePicker } from './ImagePicker'
import type { FieldControlProps } from './types'

export const ImageField: React.FC<FieldControlProps> = ({
  name,
  label,
  field,
}) => {
  const [value, setValue] = useFrontmatterValue(name)
  const labelId = `${React.useId()}-label`

  return (
    <FieldWrapper label={label} field={field} value={value} labelId={labelId}>
      <ImagePicker
        value={typeof value === 'string' ? value : ''}
        onChange={path => setValue(path)}
        labelId={labelId}
      />
    </FieldWrapper>
  )
}
