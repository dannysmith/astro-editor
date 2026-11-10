import React from 'react'
import { useEditorStore } from '../../../store/editorStore'
import { getNestedValue } from '../../../lib/object-utils'
import { Input } from '../../ui/input'
import { AutoExpandingTextarea } from '../../ui/auto-expanding-textarea'
import { valueToString } from '../utils'
import { FieldWrapper } from './FieldWrapper'
import type { FieldProps } from '../../../types/common'
import type { SchemaField } from '../../../lib/schema'

interface StringFieldProps extends FieldProps {
  placeholder?: string
  type?: 'text' | 'email' | 'url'
  field?: SchemaField
}

export const StringField: React.FC<StringFieldProps> = ({
  name,
  label,
  placeholder,
  className,
  required,
  type = 'text',
  field,
}) => {
  const value = useEditorStore(state => getNestedValue(state.frontmatter, name))
  const updateFrontmatterField = useEditorStore(
    state => state.updateFrontmatterField
  )
  const id = React.useId()

  // An <input> drops line breaks from its value, so editing a value that has
  // them would join its lines. Once a file's value has shown the textarea, it
  // keeps it, so deleting the last line break doesn't swap the control (and
  // lose focus) mid-edit.
  const filePath = useEditorStore(state => state.currentFile?.path ?? null)
  const [multilineFile, setMultilineFile] = React.useState<
    string | null | undefined
  >(undefined)
  const hasLineBreak = valueToString(value).includes('\n')
  if (hasLineBreak && multilineFile !== filePath) setMultilineFile(filePath)
  const multiline = hasLineBreak || multilineFile === filePath

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
      {multiline ? (
        <AutoExpandingTextarea
          id={id}
          name={name}
          className={className}
          value={valueToString(value)}
          onChange={e => updateFrontmatterField(name, e.target.value)}
        />
      ) : (
        <Input
          id={id}
          type={type}
          name={name}
          placeholder={placeholder || `Enter ${label.toLowerCase()}...`}
          className={className}
          value={valueToString(value)}
          onChange={e => updateFrontmatterField(name, e.target.value)}
        />
      )}
    </FieldWrapper>
  )
}
