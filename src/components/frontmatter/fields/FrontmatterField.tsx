import React from 'react'
import { useEditorStore } from '../../../store/editorStore'
import { useEffectiveSettings } from '../../../lib/project-registry/effective-settings'
import { FieldType, type ZodField, type SchemaField } from '../../../lib/schema'
import { StringField } from './StringField'
import { TextareaField } from './TextareaField'
import { NumberField } from './NumberField'
import { BooleanField } from './BooleanField'
import { DateField } from './DateField'
import { EnumField } from './EnumField'
import { ArrayField } from './ArrayField'

interface FrontmatterFieldProps {
  name: string
  label: string
  field?: ZodField | SchemaField
}

function isSchemaField(field: ZodField | SchemaField): field is SchemaField {
  // SchemaField has 'required' property, ZodField has 'optional'
  return 'required' in field
}

export const FrontmatterField: React.FC<FrontmatterFieldProps> = ({
  name,
  label,
  field,
}) => {
  const { frontmatter } = useEditorStore()
  const { frontmatterMappings } = useEffectiveSettings()

  // Determine field properties based on field type
  let fieldType: string
  let required: boolean
  let enumValues: string[] | undefined

  if (field) {
    if (isSchemaField(field)) {
      // New SchemaField format
      fieldType = field.type
      required = field.required
      enumValues = field.enumValues
    } else {
      // Legacy ZodField format
      fieldType = field.type
      required = !field.optional
      enumValues = field.options
    }
  } else {
    fieldType = 'string'
    required = false
  }

  // Check if this field should be treated as an array based on schema or frontmatter value
  const shouldUseArrayField =
    fieldType === (FieldType.Array as string) ||
    fieldType === 'Array' ||
    (!field &&
      Array.isArray(frontmatter[name]) &&
      frontmatter[name].every((item: unknown) => typeof item === 'string'))

  // Handle boolean fields
  if (
    fieldType === (FieldType.Boolean as string) ||
    fieldType === 'Boolean' ||
    fieldType === 'checkbox'
  ) {
    return <BooleanField name={name} label={label} field={field} />
  }

  // Handle number/integer fields
  if (
    fieldType === (FieldType.Number as string) ||
    fieldType === (FieldType.Integer as string) ||
    fieldType === 'Number' ||
    fieldType === 'number' ||
    fieldType === 'integer'
  ) {
    return <NumberField name={name} label={label} required={required} />
  }

  // Handle date fields
  if (
    fieldType === (FieldType.Date as string) ||
    fieldType === 'Date' ||
    fieldType === 'date'
  ) {
    return <DateField name={name} label={label} required={required} />
  }

  // Handle enum fields
  if (
    (fieldType === (FieldType.Enum as string) ||
      fieldType === 'Enum' ||
      fieldType === 'enum') &&
    enumValues
  ) {
    return (
      <EnumField
        name={name}
        label={label}
        options={enumValues}
        required={required}
      />
    )
  }

  // Handle array fields
  if (shouldUseArrayField) {
    return <ArrayField name={name} label={label} required={required} />
  }

  // Handle email fields
  if (fieldType === (FieldType.Email as string) || fieldType === 'email') {
    return (
      <StringField name={name} label={label} required={required} type="email" />
    )
  }

  // Handle URL fields
  if (fieldType === (FieldType.URL as string) || fieldType === 'url') {
    return (
      <StringField name={name} label={label} required={required} type="url" />
    )
  }

  // Handle reference fields (as string for V1)
  if (
    fieldType === (FieldType.Reference as string) ||
    fieldType === 'reference'
  ) {
    return <StringField name={name} label={label} required={required} />
  }

  // Check if this field should get special treatment based on effective settings
  if (name === frontmatterMappings.title) {
    return (
      <TextareaField
        name={name}
        label={label}
        className="text-lg font-bold text-gray-900 dark:text-white"
        minRows={1}
        maxRows={3}
        required={required}
      />
    )
  }

  if (name === frontmatterMappings.description) {
    return (
      <TextareaField
        name={name}
        label={label}
        minRows={3}
        maxRows={16}
        required={required}
      />
    )
  }

  // Default to string field
  return <StringField name={name} label={label} required={required} />
}
