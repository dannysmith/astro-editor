import { useState } from 'react'
import { ChevronRight, GitBranch, RefreshCw } from 'lucide-react'
import type {
  GitChange,
  GitChangeKind,
  GitEntry,
  GitState,
} from '@/lib/bindings'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { fileName } from '../../lib/git/entry-files'
import {
  describeUpstream,
  gitProblem,
  readOnlyReason,
} from '../../lib/git/setup'
import { formatLastOpened } from '../../lib/projects/display'
import { ProblemCallout, WithCode } from '../project-settings/Problems'

const KIND_LABELS: Record<GitChangeKind, string> = {
  new: 'New',
  modified: 'Changed',
  deleted: 'Deleted',
  renamed: 'Renamed',
  conflicted: 'Conflict',
}

export interface GitPanelViewProps {
  /** Undefined until git has been read once */
  state?: GitState
  /** Reading git failed outright */
  error?: string
  refreshing: boolean
  onRefresh: () => void
  /** The open entry's title, or its file name. Null with no file open. */
  title: string | null
  /** The changes that belong with the entry, the entry first */
  entryChanges: GitChange[]
  otherChanges: GitChange[]
  isTicked: (path: string) => boolean
  onTick: (path: string, ticked: boolean) => void
  /** Opens a changed content file */
  onOpen: (change: GitChange) => void
  onOpenSettings: () => void
  /** For relative dates, so the styleguide stays the same */
  now?: Date
}

/** The Git tab, from what's passed in. See `GitPanel`. */
export function GitPanelView({
  state,
  error,
  refreshing,
  onRefresh,
  title,
  entryChanges,
  otherChanges,
  isTicked,
  onTick,
  onOpen,
  onOpenSettings,
  now,
}: GitPanelViewProps) {
  const tree = state?.tree
  const problem = state?.problem
  const readOnly = tree && readOnlyReason(tree, tree.changes)
  const files = { prefix: tree?.prefix ?? '', isTicked, onTick, onOpen }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-5 overflow-y-auto p-4 text-sm">
        <div className="flex items-start gap-2">
          <GitBranch className="mt-0.5 size-4 shrink-0 text-icon" />
          <div className="min-w-0 flex-1 space-y-0.5 break-words">
            {tree ? (
              <>
                <p className="font-medium text-heading">
                  {tree.branch ?? 'Detached HEAD'}
                </p>
                <p className="text-xs text-muted-foreground">
                  <WithCode text={describeUpstream(tree)} />
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">
                {state || error ? 'Git' : 'Reading git…'}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="-my-1.5 size-7"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Refresh"
            title="Refresh"
          >
            <RefreshCw
              className={cn('size-3.5', refreshing && 'animate-spin')}
            />
          </Button>
        </div>

        {error && (
          <ProblemCallout
            problem={{
              level: 'error',
              message: "AE couldn't read git for this project.",
              detail: error,
            }}
          />
        )}
        {problem && (
          <div className="space-y-2">
            <ProblemCallout problem={gitProblem(problem, null)} />
            <Button variant="outline" size="sm" onClick={onOpenSettings}>
              Project Settings
            </Button>
          </div>
        )}
        {readOnly && <ProblemCallout problem={readOnly} />}

        {tree && title !== null && tree.entry && (
          <section className="space-y-3">
            <div className="space-y-0.5">
              <h3 className="font-medium break-words text-heading">{title}</h3>
              <p className="text-xs text-muted-foreground">
                {describeEntry(tree.entry, now)}
              </p>
            </div>
            {entryChanges.length > 0 && (
              <FileList changes={entryChanges} {...files} />
            )}
          </section>
        )}

        {tree && (
          <OtherChanges
            // A new entry starts with the others folded away, or open when
            // there's no entry to commit
            key={title === null ? 'none' : 'entry'}
            changes={otherChanges}
            startOpen={title === null}
            {...files}
          />
        )}
      </div>
    </div>
  )
}

/** The entry's state as a sentence, like "Changed since it was last committed, 3 days ago" */
function describeEntry(entry: GitEntry, now?: Date): string {
  const when = entry.lastCommit
    ? relativeDate(entry.lastCommit.time, now)
    : null
  switch (entry.state) {
    case 'new':
      return 'New, not committed yet'
    case 'modified':
      return when
        ? `Changed since it was last committed, ${when}`
        : 'Changed since it was last committed'
    case 'renamed':
      return 'Renamed, not committed yet'
    case 'deleted':
      return 'Deleted, not committed yet'
    case 'conflicted':
      return 'Has conflicts to resolve in your git tool'
    case 'unchanged':
      return when ? `Committed ${when}, no changes since` : 'No changes'
    case 'ignored':
      return 'Ignored by git'
    case 'outsideRepository':
      return "In a different repository from the project, so it can't be committed here"
  }
}

/** A commit time as "just now", "3 days ago" or "on 27 Oct", to follow a verb */
function relativeDate(seconds: number, now?: Date): string {
  const text = formatLastOpened(new Date(seconds * 1000).toISOString(), now)
  // A date like "27 Oct", rather than "3 days ago"
  if (/^\d+ [A-Z]/.test(text)) return `on ${text}`
  return text.charAt(0).toLowerCase() + text.slice(1)
}

interface FilesProps {
  /** The project folder within the repository, stripped from paths shown */
  prefix: string
  isTicked: (path: string) => boolean
  onTick: (path: string, ticked: boolean) => void
  onOpen: (change: GitChange) => void
}

function OtherChanges({
  changes,
  startOpen,
  ...files
}: FilesProps & { changes: GitChange[]; startOpen: boolean }) {
  const [open, setOpen] = useState(startOpen)
  if (changes.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        {startOpen ? 'No changes in the project.' : 'No other changes.'}
      </p>
    )
  }
  return (
    <section className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ChevronRight
          className={cn('size-3.5 transition-transform', open && 'rotate-90')}
        />
        {startOpen ? 'Changes' : 'Other changes'} ({changes.length})
      </button>
      {open && <FileList changes={changes} {...files} />}
    </section>
  )
}

function FileList({
  changes,
  prefix,
  isTicked,
  onTick,
  onOpen,
}: FilesProps & { changes: GitChange[] }) {
  return (
    <ul className="space-y-1">
      {changes.map(change => {
        const shown = change.path.startsWith(prefix)
          ? change.path.slice(prefix.length)
          : change.path
        const openable =
          /\.mdx?$/i.test(change.path) && change.kind !== 'deleted'
        return (
          <li key={change.path} className="flex items-center gap-2">
            <Checkbox
              checked={isTicked(change.path)}
              onCheckedChange={checked => onTick(change.path, checked)}
              aria-label={`Include ${shown}`}
            />
            {openable ? (
              <button
                type="button"
                title={shown}
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
            <span className="shrink-0 text-xs text-muted-foreground">
              {KIND_LABELS[change.kind]}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
