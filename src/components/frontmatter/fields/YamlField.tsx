import React from 'react'
import { useEditorStore, getNestedValue } from '../../../store/editorStore'
import { AutoExpandingTextarea } from '../../ui/auto-expanding-textarea'
import { FieldWrapper } from './FieldWrapper'
import type { FieldProps } from '../../../types/common'
import type { SchemaField } from '../../../lib/schema'

interface YamlFieldProps extends FieldProps {
  field?: SchemaField
}

/**
 * YamlField - A fallback field for complex array types (dates, objects, etc.)
 * Displays the value as YAML-like text for manual editing
 *
 * Note: This uses JSON.stringify for now. In the future, we could add
 * a proper YAML library for better formatting.
 */
export const YamlField: React.FC<YamlFieldProps> = ({
  name,
  label,
  required,
  field,
}) => {
  const { frontmatter, updateFrontmatterField } = useEditorStore()
  const value = getNestedValue(frontmatter, name)
  const [error, setError] = React.useState<string | null>(null)

  // Convert value to YAML-like string for display
  const displayValue = React.useMemo(() => {
    if (value === undefined || value === null) return ''

    try {
      // Format as indented JSON (close enough to YAML for arrays)
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }, [value])

  const handleChange = (newValue: string) => {
    if (newValue.trim() === '') {
      // Empty value - clear the field
      setError(null)
      updateFrontmatterField(name, undefined)
      return
    }

    try {
      // Try to parse as JSON
      const parsed = JSON.parse(newValue)
      setError(null)
      updateFrontmatterField(name, parsed)
    } catch (err) {
      // Show validation error but don't update value
      setError(err instanceof Error ? err.message : 'Invalid JSON')
    }
  }

  return (
    <FieldWrapper
      label={label}
      required={required}
      description={
        field && 'description' in field
          ? field.description
          : 'Edit as JSON array (e.g., ["item1", "item2"])'
      }
      defaultValue={field?.default}
      constraints={field?.constraints}
      currentValue={value}
    >
      <div className="space-y-2">
        <AutoExpandingTextarea
          value={displayValue}
          onChange={e => handleChange(e.target.value)}
          placeholder={`Enter ${label.toLowerCase()} as JSON array...`}
          className="font-mono text-sm"
          minRows={3}
          maxRows={20}
        />
        {error && (
          <p className="text-sm text-destructive">
            Invalid JSON: {error}
          </p>
        )}
      </div>
    </FieldWrapper>
  )
}
