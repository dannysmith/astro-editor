import React from 'react'
import { useEditorStore } from '../../../store/editorStore'
import { Input } from '../../ui/input'
import { valueToString } from '../utils'
import type { FieldProps } from '../../../types/common'

interface StringFieldProps extends FieldProps {
  placeholder?: string
  type?: 'text' | 'email' | 'url'
}

export const StringField: React.FC<StringFieldProps> = ({
  name,
  label,
  placeholder,
  className,
  required,
  type = 'text',
}) => {
  const { frontmatter, updateFrontmatterField } = useEditorStore()

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">
        {label}
        {required && (
          <span className="text-[var(--color-required)] ml-1">*</span>
        )}
      </label>
      <Input
        type={type}
        name={name}
        placeholder={placeholder || `Enter ${label.toLowerCase()}...`}
        className={className}
        value={valueToString(frontmatter[name])}
        onChange={e => updateFrontmatterField(name, e.target.value)}
      />
    </div>
  )
}
