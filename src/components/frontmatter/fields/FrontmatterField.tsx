import React from 'react'
import { useEditorStore } from '../../../store/editorStore'
import { useFieldMappings } from '../../../hooks/settings'
import { fieldControl } from '../../../lib/field-control'
import type { SchemaField } from '../../../lib/schema'
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
import { ImageArrayField } from './ImageArrayField'

interface FrontmatterFieldProps {
  name: string
  label: string
  field?: SchemaField
  collectionName?: string
}

/** One frontmatter field, with the control `fieldControl` picks for it */
export const FrontmatterField: React.FC<FrontmatterFieldProps> = ({
  name,
  label,
  field,
  collectionName,
}) => {
  const fieldValue = useEditorStore(state => state.frontmatter?.[name])
  const mappings = useFieldMappings(collectionName)
  const required = field?.required ?? false
  const props = { name, label, required, field }

  switch (fieldControl(name, field, fieldValue, mappings)) {
    case 'boolean':
      return <BooleanField name={name} label={label} field={field} />
    case 'number':
      return <NumberField {...props} />
    case 'date':
      return <DateField {...props} />
    case 'enum':
      return <EnumField {...props} options={field?.enumValues ?? []} />
    case 'references':
    case 'reference':
      return <ReferenceField {...props} />
    case 'images':
      return <ImageArrayField {...props} />
    case 'yaml':
      return <YamlField {...props} />
    case 'list':
      return <ArrayField {...props} />
    case 'image':
      return <ImageField {...props} />
    case 'email':
      return <StringField {...props} type="email" />
    case 'url':
      return <StringField {...props} type="url" />
    case 'title':
      return (
        <TextareaField
          {...props}
          className="text-lg font-bold text-heading"
          minRows={1}
          maxRows={3}
          showCopyAsSlug
        />
      )
    case 'description':
      return <TextareaField {...props} minRows={3} maxRows={16} />
    case 'text':
      return <StringField {...props} />
  }
}
