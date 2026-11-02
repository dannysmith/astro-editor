import React from 'react'
import { useEditorStore } from '../../../store/editorStore'
import { getNestedValue } from '../../../lib/object-utils'
import { FieldWrapper } from './FieldWrapper'
import { ImagePicker } from './ImagePicker'
import type { FieldProps } from '../../../types/common'
import type { SchemaField } from '../../../lib/schema'

interface ImageFieldProps extends FieldProps {
  field?: SchemaField
}

export const ImageField: React.FC<ImageFieldProps> = ({
  name,
  label,
  required,
  field,
}) => {
  const value = useEditorStore(state => getNestedValue(state.frontmatter, name))
  const updateFrontmatterField = useEditorStore(
    state => state.updateFrontmatterField
  )
  const labelId = `${React.useId()}-label`

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
      <ImagePicker
        value={typeof value === 'string' ? value : ''}
        onChange={path => updateFrontmatterField(name, path)}
        labelId={labelId}
      />
    </FieldWrapper>
  )
}
