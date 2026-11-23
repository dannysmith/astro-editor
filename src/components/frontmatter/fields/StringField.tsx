import React from 'react'
import { shownFilePath, useEditorStore } from '../../../store/editorStore'
import { useFrontmatterValue } from '../../../hooks/useFrontmatterValue'
import { Input } from '../../ui/input'
import { AutoExpandingTextarea } from '../../ui/auto-expanding-textarea'
import { valueToString } from '../utils'
import { FieldWrapper } from './FieldWrapper'
import type { FieldControlProps } from './types'

interface StringFieldProps extends FieldControlProps {
  placeholder?: string
  type?: 'text' | 'email' | 'url'
}

export const StringField: React.FC<StringFieldProps> = ({
  name,
  label,
  placeholder,
  className,
  type = 'text',
  field,
}) => {
  const [value, setValue] = useFrontmatterValue(name)
  const id = React.useId()

  // An <input> drops line breaks from its value, so editing a value that has
  // them would join its lines. Once a file's value has shown the textarea, it
  // keeps it, so deleting the last line break doesn't swap the control (and
  // lose focus) mid-edit.
  const filePath = useEditorStore(shownFilePath)
  const [multilineFile, setMultilineFile] = React.useState<
    string | null | undefined
  >(undefined)
  const hasLineBreak = valueToString(value).includes('\n')
  if (hasLineBreak && multilineFile !== filePath) setMultilineFile(filePath)
  const multiline = hasLineBreak || multilineFile === filePath

  return (
    <FieldWrapper label={label} field={field} value={value} htmlFor={id}>
      {multiline ? (
        <AutoExpandingTextarea
          id={id}
          name={name}
          className={className}
          value={valueToString(value)}
          onChange={e => setValue(e.target.value)}
        />
      ) : (
        <Input
          id={id}
          type={type}
          name={name}
          placeholder={placeholder || `Enter ${label.toLowerCase()}...`}
          className={className}
          value={valueToString(value)}
          onChange={e => setValue(e.target.value)}
        />
      )}
    </FieldWrapper>
  )
}
