import React, { useId } from 'react'
import { FolderOpen, Plus, RotateCcw, X, type LucideIcon } from 'lucide-react'
import type { SettingSource } from '@/lib/bindings'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PreferencesTextInput } from '../preferences/PreferencesTextInput'
import { chooseProjectFolder } from '../../lib/project-settings/actions'

/** A collection page's icon, the size of the project's on the project page */
export function PageIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-[22%] bg-muted">
      <Icon className="size-5 text-icon" />
    </span>
  )
}

/** A page's heading, with its icon and a sentence about where it comes from */
export function PageHeader({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <header className="flex items-center gap-3">
      {icon}
      <div className="min-w-0 space-y-0.5">
        <h2 className="truncate text-lg font-semibold text-heading">{title}</h2>
        {children && (
          <p className="text-sm text-muted-foreground">{children}</p>
        )}
      </div>
    </header>
  )
}

/**
 * A titled box of settings, one row each. `note` sits at the heading's other
 * end, for something true of every setting in it.
 */
export function SettingsGroup({
  title,
  note,
  children,
}: {
  title: string
  note?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-4 px-1">
        <h3 className="text-sm font-medium text-heading">{title}</h3>
        {note && <span className="text-xs text-muted-foreground">{note}</span>}
      </div>
      <div className="divide-y rounded-lg border">{children}</div>
    </section>
  )
}

interface SettingProps {
  label: React.ReactNode
  /** One line under the label: what it's for, or what you'll notice */
  help?: React.ReactNode
  /**
   * Where its value came from. Only one the user set is shown, as a pill
   * with a reset; the rest are said by the control's first choice or not at
   * all. See the user guide's Project Settings page.
   */
  source: SettingSource
  /** Unsets it */
  onReset?: () => void
  /** What a reset goes back to, for the reset's tooltip */
  resetTo?: string
  /** Puts the control under the label, full width */
  wide?: boolean
  /** The control. `id` names an input; `labelId` names a select's trigger. */
  children: (ids: { id: string; labelId: string }) => React.ReactNode
}

/** One setting: its label and help on the left, its control on the right */
export function Setting({
  label,
  help,
  source,
  onReset,
  resetTo,
  wide = false,
  children,
}: SettingProps) {
  const id = useId()
  const labelId = `${id}-label`
  const control = children({ id, labelId })

  return (
    <div className="px-4 py-3">
      <div className="flex min-h-9 items-center justify-between gap-6">
        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <label id={labelId} htmlFor={id} className="text-sm">
              {label}
            </label>
            {source === 'set' && onReset && (
              <SetByYou onReset={onReset} resetTo={resetTo} />
            )}
          </div>
          {help && <p className="text-xs text-muted-foreground">{help}</p>}
        </div>
        {!wide && (
          <div className="flex w-72 shrink-0 justify-end">{control}</div>
        )}
      </div>
      {wide && <div className="mt-3">{control}</div>}
    </div>
  )
}

/** Marks a setting the user changed, with a button that unsets it */
function SetByYou({
  onReset,
  resetTo,
}: {
  onReset: () => void
  resetTo?: string
}) {
  return (
    <span className="inline-flex h-5 items-center gap-0.5 rounded-full bg-filter-bg pr-0.5 pl-2 text-xs text-filter">
      Set by you
      <button
        type="button"
        title={resetTo ? `Reset to ${resetTo}` : 'Reset'}
        aria-label={resetTo ? `Reset to ${resetTo}` : 'Reset'}
        onClick={onReset}
        className="rounded-full p-1 hover:bg-filter/15 focus-visible:ring-1 focus-visible:ring-filter focus-visible:outline-none"
      >
        <RotateCcw className="size-3" />
      </button>
    </span>
  )
}

/**
 * A dropdown's first choice when it's a value AE found or inherited, like
 * "Detected: title" or "Same as project: relative to the file"
 */
export function FoundValue({
  source,
  value,
}: {
  source: string
  value: React.ReactNode
}) {
  return (
    <span>
      <span className="text-muted-foreground">{source}: </span>
      {value}
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

/** Asks for a folder in the project with the folder picker */
function ChooseFolderButton({
  start,
  onChoose,
}: {
  start: string
  onChoose: (folder: string) => void
}) {
  return (
    <Button
      variant="outline"
      size="icon"
      title="Choose…"
      aria-label="Choose a folder"
      className="shrink-0"
      onClick={() =>
        void chooseProjectFolder(start).then(folder => {
          if (folder) onChoose(folder)
        })
      }
    >
      <FolderOpen />
    </Button>
  )
}

/**
 * A folder in the project: typed, or chosen with the folder picker. The
 * placeholder is the folder in use; an empty value unsets it.
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
    <div className="flex w-full gap-2">
      <PreferencesTextInput
        id={id}
        value={value}
        placeholder={placeholder}
        onCommit={onChange}
        className="font-mono text-xs"
      />
      <ChooseFolderButton start={start} onChoose={onChange} />
    </div>
  )
}

/** Folders in the project, each removable, with a button to add one */
export function FolderList({
  folders,
  start,
  onChange,
}: {
  folders: string[]
  /** Where the folder picker starts */
  start: string
  onChange: (folders: string[]) => void
}) {
  return (
    <div className="space-y-2">
      {folders.length > 0 && (
        <ul className="divide-y rounded-md border">
          {folders.map(folder => (
            <li
              key={folder}
              className="flex items-center justify-between gap-2 py-1 pr-1 pl-3"
            >
              <span className="truncate font-mono text-xs">{folder}</span>
              <Button
                variant="ghost"
                size="sm"
                title="Remove"
                aria-label={`Remove ${folder}`}
                className="size-6 p-0 text-muted-foreground"
                onClick={() => onChange(folders.filter(f => f !== folder))}
              >
                <X className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          void chooseProjectFolder(start).then(folder => {
            if (folder && !folders.includes(folder)) {
              onChange([...folders, folder])
            }
          })
        }
      >
        <Plus /> Add Folder…
      </Button>
    </div>
  )
}
