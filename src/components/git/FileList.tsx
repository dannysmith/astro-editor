import { useState } from 'react'
import { ChevronRight, TriangleAlert } from 'lucide-react'
import type { GitChange } from '@/lib/bindings'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { fileName } from '../../lib/git/entry-files'
import { changeStatus } from '../../lib/git/status'
import { StatusLetter, fileMenu, type FileMenu } from './status-marks'

/** What every file row needs */
export interface RowProps {
  /** The project folder within the repository, stripped from paths shown */
  prefix: string
  /** Files are staged or a git command is running, so ticks can't change */
  locked: boolean
  isTicked: (path: string) => boolean
  onTick: (path: string, ticked: boolean) => void
  /** Opens a changed content file */
  onOpen: (change: GitChange) => void
  onFileMenu: FileMenu
}

/**
 * The project's other changes, folded away beside an entry (to tick into its
 * commit), open when there's no entry
 */
export function OtherChanges({
  changes,
  withEntry,
  ...rows
}: RowProps & { changes: GitChange[]; withEntry: boolean }) {
  const [open, setOpen] = useState(!withEntry)
  if (changes.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        {withEntry
          ? 'No other uncommitted changes in this project.'
          : 'No uncommitted changes in this project.'}
      </p>
    )
  }
  return (
    <section className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex items-center gap-1 text-left font-medium text-foreground"
      >
        <ChevronRight
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-90'
          )}
        />
        {withEntry ? 'Other changes' : 'Changes'}
        <span className="font-normal text-muted-foreground">
          {changes.length}
        </span>
      </button>
      {open && (
        <>
          <p className="text-xs text-muted-foreground">
            {withEntry
              ? 'Uncommitted changes elsewhere in this project. Tick any to commit them with this entry.'
              : 'Uncommitted changes in this project.'}
          </p>
          <ul className="space-y-1">
            {changes.map(change => (
              <FileRow key={change.path} change={change} {...rows} />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

/**
 * A changed file: a tick for the commit, its name (a link for content files),
 * an optional note with a warning sign, and its status letter
 */
export function FileRow({
  change,
  note,
  prefix,
  locked,
  isTicked,
  onTick,
  onOpen,
  onFileMenu,
}: RowProps & { change: GitChange; note?: string }) {
  const shown = change.path.startsWith(prefix)
    ? change.path.slice(prefix.length)
    : change.path
  const openable = /\.mdx?$/i.test(change.path) && change.kind !== 'deleted'
  return (
    <li
      onContextMenu={fileMenu(
        onFileMenu,
        change.path,
        change.kind !== 'deleted'
      )}
    >
      <div className="flex items-center gap-2">
        <Checkbox
          checked={isTicked(change.path)}
          disabled={locked}
          onCheckedChange={checked => onTick(change.path, checked)}
          aria-label={`Include ${shown}`}
        />
        {openable ? (
          <button
            type="button"
            title={`${shown}. Click to open.`}
            onClick={() => onOpen(change)}
            className="min-w-0 flex-1 truncate text-left hover:underline"
          >
            {fileName(change.path)}
          </button>
        ) : (
          <span title={shown} className="min-w-0 flex-1 truncate">
            {fileName(change.path)}
          </span>
        )}
        {note && (
          <TriangleAlert
            aria-hidden
            className="size-3.5 shrink-0 text-warning"
          />
        )}
        <StatusLetter status={changeStatus(change)} />
      </div>
      {note && <p className="pl-6 text-xs text-muted-foreground">{note}</p>}
    </li>
  )
}
