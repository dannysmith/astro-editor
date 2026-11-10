import React from 'react'
import { useEditorStore } from '../../../store/editorStore'
import { getNestedValue } from '../../../lib/object-utils'
import { Switch } from '../../ui/switch'
import { FieldLabel, FieldDescription } from '../../ui/field'
import type { FieldProps } from '../../../types/common'
import { booleanDefault, type SchemaField } from '../../../lib/schema'

interface BooleanFieldProps extends FieldProps {
  field?: SchemaField
}

export const BooleanField: React.FC<BooleanFieldProps> = ({
  name,
  label,
  field,
}) => {
  const value = useEditorStore(state => getNestedValue(state.frontmatter, name))
  const updateFrontmatterField = useEditorStore(
    state => state.updateFrontmatterField
  )

  // The file's value (boolean or text), otherwise the schema's default
  const getBooleanValue = (value: unknown) => {
    if (value !== undefined && value !== null && value !== '') {
      return value === true || value === 'true'
    }
    return booleanDefault(field)
  }

  const id = React.useId()
  const isRequired = field ? field.required : false
  const description =
    field && 'description' in field ? field.description : undefined

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <FieldLabel htmlFor={id}>
          {label}
          {isRequired && <span className="ml-1 text-required">*</span>}
        </FieldLabel>
        <Switch
          id={id}
          checked={getBooleanValue(value)}
          onCheckedChange={checked => updateFrontmatterField(name, checked)}
        />
      </div>
      {description && <FieldDescription>{description}</FieldDescription>}
    </div>
  )
}
