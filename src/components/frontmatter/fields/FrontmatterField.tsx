import React from 'react'
import { useEditorStore } from '../../../store/editorStore'
import { useEffectiveSettings } from '../../../hooks/settings/useEffectiveSettings'
import { FieldType, type SchemaField } from '../../../lib/schema'
import { StringField } from './StringField'
import { TextareaField } from './TextareaField'
import { NumberField } from './NumberField'
import { BooleanField } from './BooleanField'
import { DateField } from './DateField'
import { EnumField } from './EnumField'
import { ArrayField } from './ArrayField'
import { ReferenceField } from './ReferenceField'
import { YamlField } from './YamlField'
import { ImageField } from './ImageField'

interface FrontmatterFieldProps {
  name: string
  label: string
  field?: SchemaField
  collectionName?: string
}

export const FrontmatterField: React.FC<FrontmatterFieldProps> = ({
  name,
  label,
  field,
  collectionName,
}) => {
  const fieldValue = useEditorStore(state => state.frontmatter?.[name])
  const { frontmatterMappings } = useEffectiveSettings(collectionName)

  // Determine field properties from SchemaField
  let fieldType: string
  let required: boolean
  let enumValues: string[] | undefined

  if (field) {
    fieldType = field.type
    required = field.required
    enumValues = field.enumValues
  } else {
    fieldType = 'string'
    required = false
  }

  // Check if this is an array of references (should use ReferenceField in multi-select mode)
  const isArrayReference =
    (fieldType === (FieldType.Array as string) || fieldType === 'Array') &&
    field?.subReference

  // Check if this is a complex array (dates, objects, etc.) that should use YamlField
  const isComplexArray =
    !isArrayReference &&
    (fieldType === (FieldType.Array as string) || fieldType === 'Array') &&
    field?.subType &&
    field.subType !== FieldType.String &&
    field.subType !== FieldType.Number &&
    field.subType !== FieldType.Integer

  // Check if this field should be treated as an array based on schema or frontmatter value
  const shouldUseArrayField = React.useMemo(() => {
    return (
      !isArrayReference &&
      !isComplexArray &&
      (fieldType === (FieldType.Array as string) ||
        fieldType === 'Array' ||
        (!field &&
          Array.isArray(fieldValue) &&
          fieldValue.every((item: unknown) => typeof item === 'string')))
    )
  }, [isArrayReference, isComplexArray, fieldType, field, fieldValue])

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
    return (
      <NumberField
        name={name}
        label={label}
        required={required}
        field={field}
      />
    )
  }

  // Handle date fields
  if (
    fieldType === (FieldType.Date as string) ||
    fieldType === 'Date' ||
    fieldType === 'date'
  ) {
    return (
      <DateField name={name} label={label} required={required} field={field} />
    )
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
        field={field}
      />
    )
  }

  // Handle array reference fields (multi-select references)
  if (isArrayReference) {
    return (
      <ReferenceField
        name={name}
        label={label}
        required={required}
        field={field}
      />
    )
  }

  // Handle complex array fields (dates, objects, etc.) with YAML fallback
  if (isComplexArray) {
    return (
      <YamlField name={name} label={label} required={required} field={field} />
    )
  }

  // Handle array fields (strings and numbers)
  if (shouldUseArrayField) {
    return (
      <ArrayField name={name} label={label} required={required} field={field} />
    )
  }

  // Handle image fields
  if (fieldType === (FieldType.Image as string) || fieldType === 'image') {
    return (
      <ImageField name={name} label={label} required={required} field={field} />
    )
  }

  // Handle email fields
  if (fieldType === (FieldType.Email as string) || fieldType === 'email') {
    return (
      <StringField
        name={name}
        label={label}
        required={required}
        type="email"
        field={field}
      />
    )
  }

  // Handle URL fields
  if (fieldType === (FieldType.URL as string) || fieldType === 'url') {
    return (
      <StringField
        name={name}
        label={label}
        required={required}
        type="url"
        field={field}
      />
    )
  }

  // Handle reference fields
  if (
    fieldType === (FieldType.Reference as string) ||
    fieldType === 'reference'
  ) {
    return (
      <ReferenceField
        name={name}
        label={label}
        required={required}
        field={field}
      />
    )
  }

  // Check if this field should get special treatment based on effective settings
  if (name === frontmatterMappings.title) {
    return (
      <TextareaField
        name={name}
        label={label}
        className="text-lg font-bold text-heading"
        minRows={1}
        maxRows={3}
        required={required}
        field={field}
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
        field={field}
      />
    )
  }

  // Default to string field
  return (
    <StringField name={name} label={label} required={required} field={field} />
  )
}
