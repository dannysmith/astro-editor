import React from 'react'
import { useFrontmatterValue } from '../../../hooks/useFrontmatterValue'
import { AutoExpandingTextarea } from '../../ui/auto-expanding-textarea'
import { valueToString } from '../utils'
import { CopyAsSlugLink } from './CopyAsSlugLink'
import { FieldWrapper } from './FieldWrapper'
import { renameNewFileFromTitle } from '../../../lib/files/rename'
import type { FieldControlProps } from './types'

interface TextareaFieldProps extends FieldControlProps {
  placeholder?: string
  minRows?: number
  maxRows?: number
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
  field,
  isTitle = false,
}) => {
  const [value, setValue] = useFrontmatterValue(name)
  const generatedId = React.useId()
  const id = isTitle ? 'frontmatter-title-field' : generatedId

  return (
    <FieldWrapper label={label} field={field} value={value} htmlFor={id}>
      <AutoExpandingTextarea
        id={id}
        placeholder={placeholder || `Enter ${label.toLowerCase()}...`}
        className={className}
        minRows={minRows}
        maxRows={maxRows}
        value={valueToString(value)}
        onChange={e => setValue(e.target.value)}
        onBlur={isTitle ? () => void renameNewFileFromTitle() : undefined}
      />
      {isTitle && <CopyAsSlugLink text={valueToString(value)} />}
    </FieldWrapper>
  )
}
