import React from 'react'
import { useFrontmatterValue } from '../../../hooks/useFrontmatterValue'
import { useTagSuggestions } from '../../../hooks/useTagSuggestions'
import { TagInput, type Tag } from '../../ui/tag-input'
import { tagsToStringArray } from '../utils'
import { FieldWrapper } from './FieldWrapper'
import { FieldType } from '../../../lib/schema'
import type { FieldControlProps } from './types'

export const ArrayField: React.FC<FieldControlProps> = ({
  name,
  label,
  field,
}) => {
  const [value, setValue] = useFrontmatterValue(name)
  const [focused, setFocused] = React.useState(false)

  const id = React.useId()

  // Check if this is a number array
  const isNumberArray =
    field?.subType === FieldType.Number || field?.subType === FieldType.Integer

  // Lists of strings suggest the values the collection already uses
  const suggestions = useTagSuggestions(name, focused && !isNumberArray)

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

        setValue(numberArray.length > 0 ? numberArray : undefined)
      } else {
        // Keep as strings
        const stringArray = tagsToStringArray(newTags)
        setValue(stringArray.length > 0 ? stringArray : undefined)
      }
    },
    [isNumberArray, setValue]
  )

  return (
    <FieldWrapper label={label} field={field} value={value} htmlFor={id}>
      <TagInput
        inputId={id}
        placeholder={`Enter ${label.toLowerCase()}...`}
        tags={tags}
        onTagsChange={handleTagsChange}
        suggestions={isNumberArray ? undefined : suggestions}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </FieldWrapper>
  )
}
