import React, { useId } from 'react'
import type { SettingSource } from '@/lib/bindings'
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
import { PreferencesTextInput } from '../preferences/PreferencesTextInput'
import { SOURCE_LABELS } from '../../lib/project-settings/describe'
import { chooseProjectFolder } from '../../lib/project-settings/actions'
import { ProblemNote } from './Problems'

interface SettingProps {
  label: string
  /** Where its value came from; none for a setting with nothing to fall back to */
  source?: SettingSource | null
  /** Unsets it. Offered when it's set. */
  onReset?: () => void
  description?: React.ReactNode
  /** Shown when nothing was found for it, saying what won't work */
  missing?: string
  /** For a switch, which sits beside the label */
  inline?: boolean
  /** The control. `id` names an input; `labelId` names a select's trigger. */
  children: (ids: { id: string; labelId: string }) => React.ReactNode
}

/** One setting: its label and source, its control and what it does */
export function Setting({
  label,
  source,
  onReset,
  description,
  missing,
  inline = false,
  children,
}: SettingProps) {
  const id = useId()
  const labelId = `${id}-label`
  const heading = (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <FieldLabel id={labelId} htmlFor={id}>
        {label}
      </FieldLabel>
      {source && <SourceNote source={source} onReset={onReset} />}
    </div>
  )

  return (
    <Field>
      {inline ? (
        <div className="flex items-center justify-between gap-4">
          {heading}
          {children({ id, labelId })}
        </div>
      ) : (
        heading
      )}
      <FieldContent>
        {!inline && children({ id, labelId })}
        {description && <FieldDescription>{description}</FieldDescription>}
        {missing && source === 'missing' && (
          <ProblemNote problem={{ level: 'warning', message: missing }} />
        )}
      </FieldContent>
    </Field>
  )
}

function SourceNote({
  source,
  onReset,
}: {
  source: SettingSource
  onReset?: () => void
}) {
  return (
    <span className="text-xs text-muted-foreground">
      {SOURCE_LABELS[source]}
      {source === 'set' && onReset && (
        <>
          {' · '}
          <Button
            variant="link"
            className="h-auto p-0 text-xs text-muted-foreground"
            onClick={onReset}
          >
            Reset
          </Button>
        </>
      )}
    </span>
  )
}

export interface SelectChoice {
  value: string
  label: React.ReactNode
}

/** A dropdown of `choices`, named by a setting's label */
export function SettingSelect({
  choices,
  value,
  onChange,
  labelId,
}: {
  choices: SelectChoice[]
  value: string
  onChange: (value: string) => void
  labelId: string
}) {
  return (
    <Select
      items={choices}
      value={value}
      onValueChange={next => {
        if (next) onChange(next)
      }}
    >
      <SelectTrigger aria-labelledby={labelId} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {choices.map(choice => (
          <SelectItem key={choice.value} value={choice.value}>
            {choice.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/**
 * A folder in the project: typed, or chosen with the folder picker. An empty
 * value unsets it.
 */
export function FolderInput({
  id,
  value,
  placeholder,
  start,
  onChange,
}: {
  id: string
  value: string
  placeholder: string
  /** Where the folder picker starts */
  start: string
  onChange: (folder: string) => void
}) {
  return (
    <div className="flex gap-2">
      <PreferencesTextInput
        id={id}
        value={value}
        placeholder={placeholder}
        onCommit={onChange}
      />
      <Button
        variant="outline"
        onClick={() =>
          void chooseProjectFolder(start).then(folder => {
            if (folder) onChange(folder)
          })
        }
      >
        Choose…
      </Button>
    </div>
  )
}
