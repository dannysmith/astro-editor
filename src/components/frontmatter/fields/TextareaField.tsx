import React from 'react'
import { useEditorStore } from '../../../store/editorStore'
import { getNestedValue } from '../../../lib/object-utils'
import { AutoExpandingTextarea } from '../../ui/auto-expanding-textarea'
import { valueToString } from '../utils'
import { CopyAsSlugLink } from './CopyAsSlugLink'
import { FieldWrapper } from './FieldWrapper'
import { renameNewFileFromTitle } from '../../../lib/files/rename'
import type { FieldProps } from '../../../types/common'
import type { SchemaField } from '../../../lib/schema'

interface TextareaFieldProps extends FieldProps {
  placeholder?: string
  minRows?: number
  maxRows?: number
  field?: SchemaField
  /**
   * The collection's title field: it gets the "Copy as slug" link and the id
   * new files focus, and a new file is renamed from it on blur
   */
  isTitle?: boolean
}

export const TextareaField: React.FC<TextareaFieldProps> = ({
  name,
  label,
  placeholder,
  className,
  minRows = 2,
  maxRows = 6,
  required,
  field,
  isTitle = false,
}) => {
  const value = useEditorStore(state => getNestedValue(state.frontmatter, name))
  const updateFrontmatterField = useEditorStore(
    state => state.updateFrontmatterField
  )
  const generatedId = React.useId()
  const id = isTitle ? 'frontmatter-title-field' : generatedId

  return (
    <FieldWrapper
      label={label}
      htmlFor={id}
      required={required}
      description={
        field && 'description' in field ? field.description : undefined
      }
      defaultValue={field?.default}
      constraints={field?.constraints}
      currentValue={value}
    >
      <AutoExpandingTextarea
        id={id}
        placeholder={placeholder || `Enter ${label.toLowerCase()}...`}
        className={className}
        minRows={minRows}
        maxRows={maxRows}
        value={valueToString(value)}
        onChange={e => updateFrontmatterField(name, e.target.value)}
        onBlur={isTitle ? () => void renameNewFileFromTitle() : undefined}
      />
      {isTitle && <CopyAsSlugLink text={valueToString(value)} />}
    </FieldWrapper>
  )
}
