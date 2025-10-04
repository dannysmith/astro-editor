import React from 'react'
import { useEditorStore } from '../../../store/editorStore'
import { TagInput, type Tag } from '../../ui/tag-input'
import { tagsToStringArray } from '../utils'
import { FieldWrapper } from './FieldWrapper'
import type { FieldProps } from '../../../types/common'
import type { ZodField, SchemaField } from '../../../lib/schema'

interface ArrayFieldProps extends FieldProps {
  field?: ZodField | SchemaField
}

export const ArrayField: React.FC<ArrayFieldProps> = ({
  name,
  label,
  required,
  field,
}) => {
  const { frontmatter, updateFrontmatterField } = useEditorStore()

  // Convert frontmatter array to tags
  const currentValue = frontmatter[name]
  const tags =
    Array.isArray(currentValue) &&
    currentValue.every((item): item is string => typeof item === 'string')
      ? currentValue.map((str, index) => ({
          id: `${name}-${str}-${index}`,
          text: str,
        }))
      : []

  return (
    <FieldWrapper
      label={label}
      required={required}
      description={
        field && 'description' in field ? field.description : undefined
      }
      defaultValue={field?.default}
      constraints={field?.constraints}
      currentValue={frontmatter[name]}
    >
      <TagInput
        placeholder={`Enter ${label.toLowerCase()}...`}
        tags={tags}
        onTagsChange={(newTags: Tag[]) => {
          const stringArray = tagsToStringArray(newTags)
          updateFrontmatterField(
            name,
            stringArray.length > 0 ? stringArray : undefined
          )
        }}
      />
    </FieldWrapper>
  )
}
