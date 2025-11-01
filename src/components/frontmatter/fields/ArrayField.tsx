import React from 'react'
import { useEditorStore, getNestedValue } from '../../../store/editorStore'
import { TagInput, type Tag } from '../../ui/tag-input'
import { tagsToStringArray } from '../utils'
import { FieldWrapper } from './FieldWrapper'
import { FieldType } from '../../../lib/schema'
import type { FieldProps } from '../../../types/common'
import type { SchemaField } from '../../../lib/schema'

interface ArrayFieldProps extends FieldProps {
  field?: SchemaField
}

export const ArrayField: React.FC<ArrayFieldProps> = ({
  name,
  label,
  required,
  field,
}) => {
  const value = useEditorStore(state => getNestedValue(state.frontmatter, name))
  const updateFrontmatterField = useEditorStore(
    state => state.updateFrontmatterField
  )

  // Check if this is a number array
  const isNumberArray =
    field?.subType === FieldType.Number || field?.subType === FieldType.Integer

  // Convert frontmatter array to tags
  const currentValue = value
  const tags = React.useMemo(() => {
    if (!Array.isArray(currentValue)) return []

    // For number arrays, convert numbers to strings
    if (isNumberArray) {
      return currentValue
        .filter((item): item is number => typeof item === 'number')
        .map((num, index) => ({
          id: `${name}-${num}-${index}`,
          text: String(num),
        }))
    }

    // For string arrays
    return currentValue.every(
      (item): item is string => typeof item === 'string'
    )
      ? currentValue.map((str, index) => ({
          id: `${name}-${str}-${index}`,
          text: str,
        }))
      : []
  }, [currentValue, isNumberArray, name])

  const handleTagsChange = React.useCallback(
    (newTags: Tag[]) => {
      if (isNumberArray) {
        // Convert tags to numbers, filter out invalid numbers
        const numberArray = newTags
          .map(tag => Number(tag.text))
          .filter(num => !isNaN(num))

        updateFrontmatterField(
          name,
          numberArray.length > 0 ? numberArray : undefined
        )
      } else {
        // Keep as strings
        const stringArray = tagsToStringArray(newTags)
        updateFrontmatterField(
          name,
          stringArray.length > 0 ? stringArray : undefined
        )
      }
    },
    [isNumberArray, name, updateFrontmatterField]
  )

  return (
    <FieldWrapper
      label={label}
      required={required}
      description={
        field && 'description' in field ? field.description : undefined
      }
      defaultValue={field?.default}
      constraints={field?.constraints}
      currentValue={value}
    >
      <TagInput
        placeholder={`Enter ${label.toLowerCase()}...`}
        tags={tags}
        onTagsChange={handleTagsChange}
      />
    </FieldWrapper>
  )
}
