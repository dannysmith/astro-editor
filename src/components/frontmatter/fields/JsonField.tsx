import React from 'react'
import { shownFilePath, useEditorStore } from '../../../store/editorStore'
import { useFrontmatterValue } from '../../../hooks/useFrontmatterValue'
import { AutoExpandingTextarea } from '../../ui/auto-expanding-textarea'
import { FieldWrapper } from './FieldWrapper'
import type { FieldControlProps } from './types'

/**
 * The JSON of what the store holds once `value` is written: an empty value
 * (`[]`, `""`, `null`) removes the key, so nothing. The draft is compared with
 * it, and replaced if they differ.
 */
const storedJson = (value: unknown): string =>
  value === null || value === '' || (Array.isArray(value) && value.length === 0)
    ? 'null'
    : JSON.stringify(value)

/** A frontmatter value as the JSON the field shows, indented */
const toJson = (value: unknown): string =>
  value === undefined || value === null ? '' : JSON.stringify(value, null, 2)

/**
 * JsonField - A fallback field for complex arrays (dates, objects, tuples) and
 * objects without fixed fields (records, discriminated unions), edited as JSON
 *
 * The text is a local draft, so it can be invalid JSON while the writer types;
 * the store only gets valid values. The draft is replaced when the stored value
 * changes some other way (another file, an outside edit), not by the writer's
 * own edits, which would reformat the text under the cursor. Switching file
 * always replaces it.
 */
export const JsonField: React.FC<FieldControlProps> = ({
  name,
  label,
  field,
}) => {
  const [value, setValue] = useFrontmatterValue(name)
  const filePath = useEditorStore(shownFilePath)
  const [error, setError] = React.useState<string | null>(null)
  const id = React.useId()

  const valueJson = JSON.stringify(value ?? null)
  const [draft, setDraft] = React.useState(() => toJson(value))
  // The stored value the draft matches, or was last written as, and its file:
  // another file starts afresh even if its value is the same
  const [draftValueJson, setDraftValueJson] = React.useState(valueJson)
  const [draftFilePath, setDraftFilePath] = React.useState(filePath)
  if (valueJson !== draftValueJson || filePath !== draftFilePath) {
    setDraftValueJson(valueJson)
    setDraftFilePath(filePath)
    setDraft(toJson(value))
    setError(null)
  }

  const handleChange = (newValue: string) => {
    setDraft(newValue)

    if (newValue.trim() === '') {
      // Empty value - clear the field
      setError(null)
      setDraftValueJson('null')
      setValue(undefined)
      return
    }

    try {
      const parsed = JSON.parse(newValue) as unknown
      setError(null)
      setDraftValueJson(storedJson(parsed))
      setValue(parsed)
    } catch (err) {
      // Keep the draft and the last valid value until the JSON parses
      setError(err instanceof Error ? err.message : 'Invalid JSON')
    }
  }

  return (
    <FieldWrapper
      label={label}
      field={field}
      value={value}
      htmlFor={id}
      description={
        field && 'description' in field ? field.description : 'Edit as JSON'
      }
    >
      <div className="space-y-2">
        <AutoExpandingTextarea
          id={id}
          value={draft}
          onChange={e => handleChange(e.target.value)}
          placeholder={`Enter ${label.toLowerCase()} as JSON...`}
          className="font-mono text-sm"
          minRows={3}
          maxRows={20}
        />
        {error && (
          <p className="text-sm text-destructive">Invalid JSON: {error}</p>
        )}
      </div>
    </FieldWrapper>
  )
}
