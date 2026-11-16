import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { Dialect } from '@/lib/bindings'
import { useProjectStore } from '@/store/projectStore'
import { toast } from '@/lib/toast'
import {
  clearIgnoredIssues,
  HARPER_DIALECTS,
  readCopyedit,
  setDialect,
  setDictionary,
} from '@/lib/editor/extensions/harper'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TagInput } from '@/components/ui/tag-input'
import { SettingsSection } from '../SettingsSection'

const DIALECT_ITEMS = Object.entries(HARPER_DIALECTS).map(([value, name]) => ({
  value: value as Dialect,
  label: `${name} English`,
}))

/**
 * Settings for the Copyedit panel's checks. Which checks are on is switched
 * in the panel itself.
 */
export const CopyeditPane: React.FC = () => {
  const dialect = useProjectStore(
    state => readCopyedit(state.globalSettings).dialect
  )
  const dictionary = useProjectStore(
    useShallow(state => readCopyedit(state.globalSettings).dictionary)
  )
  const id = React.useId()

  return (
    <SettingsSection title="Spelling, Grammar and Style">
      <Field>
        <FieldLabel id={`${id}-dialect`}>English</FieldLabel>
        <FieldContent>
          <Select
            items={DIALECT_ITEMS}
            value={dialect}
            onValueChange={(value: Dialect | null) => {
              if (value) setDialect(value)
            }}
          >
            <SelectTrigger aria-labelledby={`${id}-dialect`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIALECT_ITEMS.map(item => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>
            Spelling and grammar follow this dialect: British English accepts
            “colour” and flags “color”.
          </FieldDescription>
        </FieldContent>
      </Field>

      <Field>
        <FieldLabel htmlFor={`${id}-dictionary`}>Dictionary</FieldLabel>
        <FieldContent>
          <TagInput
            inputId={`${id}-dictionary`}
            tags={dictionary.map(word => ({ id: word, text: word }))}
            onTagsChange={tags => setDictionary(tags.map(tag => tag.text))}
            placeholder="Add a word…"
          />
          <FieldDescription>
            Words the spelling check accepts. Add them here, or with Add to
            Dictionary on a spelling mistake.
          </FieldDescription>
        </FieldContent>
      </Field>

      <Field>
        <FieldLabel>Ignored issues</FieldLabel>
        <FieldContent>
          <Button
            variant="outline"
            className="w-fit"
            onClick={() => {
              clearIgnoredIssues()
              toast.success('Ignored issues will show again')
            }}
          >
            Clear Ignored Issues
          </Button>
          <FieldDescription>
            An issue you ignore stays hidden wherever the same words appear.
            This shows every one again.
          </FieldDescription>
        </FieldContent>
      </Field>
    </SettingsSection>
  )
}
