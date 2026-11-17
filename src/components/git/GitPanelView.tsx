import { useEffect, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  CircleCheck,
  GitBranch,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react'
import type {
  GitChange,
  GitEntry,
  GitState,
  GitWorkingTree,
} from '@/lib/bindings'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { fileName } from '../../lib/git/entry-files'
import { gitProblem, readOnlyReason } from '../../lib/git/setup'
import { changeStatus, type GitTone } from '../../lib/git/status'
import { formatLastOpened } from '../../lib/projects/display'
import { ProblemCallout } from '../project-settings/Problems'

const DOT_COLOURS: Record<GitTone, string> = {
  added: 'bg-git-added',
  modified: 'bg-git-modified',
  deleted: 'bg-git-deleted',
  conflict: 'bg-git-conflict',
}

const LETTER_COLOURS: Record<GitTone, string> = {
  added: 'text-git-added',
  modified: 'text-git-modified',
  deleted: 'text-git-deleted',
  conflict: 'text-git-conflict',
}

/** Says why the commit and push buttons don't work yet */
const NOT_YET = 'Committing and pushing from AE come next'

export interface GitPanelViewProps {
  /** Undefined until git has been read once */
  state?: GitState
  /** Reading git failed outright */
  error?: string
  /** When git was last read, so the refresh button spins once each time */
  readAt: number
  onRefresh: () => void
  /** The open entry, or null with no file open */
  entry: {
    /** Its file name */
    name: string
    /** Its collection's name, as written */
    collection: string
  } | null
  /** The entry's own change, if it has one */
  entryChange: GitChange | null
  /** Files the entry's text names */
  used: GitChange[]
  /** Files its text named earlier this session, but doesn't now */
  unused: GitChange[]
  others: GitChange[]
  isTicked: (path: string) => boolean
  onTick: (path: string, ticked: boolean) => void
  /** Opens a changed content file */
  onOpen: (change: GitChange) => void
  onOpenSettings: () => void
  /** Whether the ticked files are staged, with the commit card open */
  staging: boolean
  /** The commit message: the prefill, or what's been typed for this entry */
  message: string
  onMessageChange: (message: string) => void
  onStage: () => void
  onUnstage: () => void
  /** For relative dates, so the styleguide stays the same */
  now?: Date
}

/** The Git tab, from what's passed in. See `GitPanel`. */
export function GitPanelView({
  state,
  error,
  readAt,
  onRefresh,
  entry,
  entryChange,
  used,
  unused,
  others,
  isTicked,
  onTick,
  onOpen,
  onOpenSettings,
  staging,
  message,
  onMessageChange,
  onStage,
  onUnstage,
  now,
}: GitPanelViewProps) {
  const tree = state?.tree
  const readOnly = tree && readOnlyReason(tree, tree.changes)
  const rows = {
    prefix: tree?.prefix ?? '',
    locked: staging,
    isTicked,
    onTick,
    onOpen,
  }
  const ticked = [...used, ...unused, ...others].filter(c => isTicked(c.path))
  const toStage = entryChange ? [entryChange, ...ticked] : ticked
  // The open entry as git sees it, once git has been read for it
  const gitEntry = entry && tree?.entry ? tree.entry : null

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-5 overflow-y-auto p-4 text-sm">
        {tree && <RepositoryLine tree={tree} />}

        {error && (
          <ProblemCallout
            problem={{
              level: 'error',
              message: "AE couldn't read git for this project.",
              detail: error,
            }}
          />
        )}
        {state?.problem && (
          <div className="space-y-2">
            <ProblemCallout problem={gitProblem(state.problem, null)} />
            <Button variant="outline" size="sm" onClick={onOpenSettings}>
              Project Settings
            </Button>
          </div>
        )}
        {readOnly && <ProblemCallout problem={readOnly} />}

        {tree && entry && gitEntry && (
          <section className="space-y-2">
            <EntryCard
              entry={gitEntry}
              name={entry.name}
              collection={entry.collection}
              change={entryChange}
              now={now}
            />
            {!readOnly && gitEntry.state !== 'outsideRepository' && (
              <CommitCard
                changes={toStage}
                alreadyStaged={tree.changes.filter(
                  c => c.staged && !toStage.includes(c)
                )}
                branch={tree.branch}
                staging={staging}
                message={message}
                onMessageChange={onMessageChange}
                prefix={tree.prefix}
                onStage={onStage}
                onUnstage={onUnstage}
              />
            )}
          </section>
        )}

        {gitEntry && (used.length > 0 || unused.length > 0) && (
          <section className="space-y-2">
            <h3 className="font-medium text-foreground">Files it uses</h3>
            <ul className="space-y-1">
              {used.map(change => (
                <FileRow key={change.path} change={change} {...rows} />
              ))}
              {unused.map(change => (
                <FileRow
                  key={change.path}
                  change={change}
                  note="No longer used in the entry"
                  {...rows}
                />
              ))}
            </ul>
          </section>
        )}

        {tree && (
          <OtherChanges
            // Folded away beside an entry, open when there's no entry
            key={entry ? 'entry' : 'none'}
            changes={others}
            withEntry={entry !== null}
            {...rows}
          />
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t px-4 py-2 text-xs text-muted-foreground">
        <span>Updates as git changes</span>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-6"
          onClick={onRefresh}
          aria-label="Read git's status again"
          title="Read git's status again. This doesn't fetch."
        >
          <RefreshCw
            // A new key each read, so it spins once
            key={readAt}
            className={cn(
              'size-3.5',
              readAt > 0 && 'animate-[spin_450ms_ease-out_1]'
            )}
          />
        </Button>
      </div>
    </div>
  )
}

/**
 * The branch, its upstream, and how many commits it's ahead or behind, with
 * Push. Context for the rest of the tab, so it's kept quiet.
 */
function RepositoryLine({ tree }: { tree: GitWorkingTree }) {
  const counts = tree.upstream ? (
    <>
      {tree.ahead > 0 && (
        <span
          className="inline-flex items-center"
          title={`${tree.ahead} ${tree.ahead === 1 ? 'commit' : 'commits'} ahead of ${tree.upstream}`}
        >
          <ArrowUp className="size-3" />
          {tree.ahead}
        </span>
      )}
      {tree.behind > 0 && (
        <span
          className="inline-flex items-center"
          title={`${tree.behind} ${tree.behind === 1 ? 'commit' : 'commits'} behind ${tree.upstream}`}
        >
          <ArrowDown className="size-3" />
          {tree.behind}
        </span>
      )}
      {tree.ahead === 0 && tree.behind === 0 && <span>in sync</span>}
    </>
  ) : null

  return (
    <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
      <GitBranch className="size-3.5 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="font-medium text-foreground">
          {tree.branch ?? 'Detached HEAD'}
        </span>
        {!tree.hasCommits ? (
          <span>no commits yet</span>
        ) : tree.branch && !tree.upstream ? (
          <span>no upstream</span>
        ) : (
          tree.upstream && (
            <span className="inline-flex items-center gap-1.5">
              <span className="truncate">{tree.upstream}</span>
              {counts}
            </span>
          )
        )}
      </div>
      <Button
        variant="outline"
        size="sm"
        className="h-6 px-2 text-xs"
        disabled
        title={NOT_YET}
      >
        Push
      </Button>
    </div>
  )
}

/** The open entry: its status in git's terms, and when it was last committed */
function EntryCard({
  entry,
  name,
  collection,
  change,
  now,
}: {
  entry: GitEntry
  name: string
  collection: string
  change: GitChange | null
  now?: Date
}) {
  const status = change
    ? changeStatus(change)
    : { label: UNCHANGED_LABELS[entry.state] ?? 'Unchanged', tone: null }
  const commit = entry.lastCommit
  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-medium text-foreground">This entry</h3>
        <span className="truncate text-xs text-muted-foreground">
          {collection}
        </span>
      </div>
      <div className="space-y-0.5 rounded-md border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <StatusDot tone={status.tone} />
          <span
            className="min-w-0 flex-1 truncate font-medium"
            title={entry.path}
          >
            {name}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {status.label}
          </span>
        </div>
        <p className="pl-4 text-xs text-muted-foreground">
          {entry.state === 'outsideRepository'
            ? "It's in a different repository from the project, so it can't be committed here."
            : commit
              ? `Last committed ${relativeDate(commit.time, now)} by ${commit.author}`
              : 'Never committed'}
        </p>
      </div>
    </>
  )
}

/** The entry's status when git has no change for it */
const UNCHANGED_LABELS: Partial<Record<GitEntry['state'], string>> = {
  unchanged: 'Committed',
  ignored: 'Ignored',
  outsideRepository: 'Another repository',
}

/**
 * Staging and committing the entry with the files ticked below. Folded, it's
 * the Stage button; staged, it's `StagedCard`.
 */
function CommitCard({
  changes,
  alreadyStaged,
  branch,
  staging,
  message,
  onMessageChange,
  prefix,
  onStage,
  onUnstage,
}: {
  /** The entry's change and the ticked files */
  changes: GitChange[]
  /** Files staged by something else, which a commit would also take */
  alreadyStaged: GitChange[]
  branch: string | null
  staging: boolean
  message: string
  onMessageChange: (message: string) => void
  prefix: string
  onStage: () => void
  onUnstage: () => void
}) {
  const count = changes.length
  const files = `${count} ${count === 1 ? 'file' : 'files'}`
  if (!staging) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        disabled={count === 0}
        onClick={onStage}
      >
        {count === 0 ? 'Nothing to stage' : `Stage ${files}`}
      </Button>
    )
  }
  return (
    <StagedCard
      changes={changes}
      alreadyStaged={alreadyStaged}
      branch={branch}
      message={message}
      onMessageChange={onMessageChange}
      prefix={prefix}
      onUnstage={onUnstage}
    />
  )
}

/**
 * The open commit card: a banner saying the files are staged, the message
 * (focused and selected, ready to type over), Cancel and Commit, and exactly
 * what the commit will hold.
 */
function StagedCard({
  changes,
  alreadyStaged,
  branch,
  message,
  onMessageChange,
  prefix,
  onUnstage,
}: {
  changes: GitChange[]
  alreadyStaged: GitChange[]
  branch: string | null
  message: string
  onMessageChange: (message: string) => void
  prefix: string
  onUnstage: () => void
}) {
  const messageRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    messageRef.current?.focus()
    messageRef.current?.select()
  }, [])
  const count = changes.length + alreadyStaged.length
  const files = `${count} ${count === 1 ? 'file' : 'files'}`
  return (
    <div className="overflow-hidden rounded-md border bg-muted/30">
      <p className="flex items-center gap-1.5 bg-git-added/15 px-3 py-1.5 text-xs font-medium text-foreground">
        <CircleCheck className="size-3.5 shrink-0 text-git-added" />
        {files} staged for commit
      </p>
      <div className="space-y-3 p-3">
        <div className="space-y-1.5">
          <Label htmlFor="git-commit-message" className="text-xs">
            Commit message
          </Label>
          <Textarea
            ref={messageRef}
            id="git-commit-message"
            value={message}
            onChange={event => onMessageChange(event.target.value)}
            rows={2}
            className="resize-none bg-background text-sm"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onUnstage}>
            Cancel
          </Button>
          <Button size="sm" disabled title={NOT_YET}>
            Commit {files}
          </Button>
        </div>
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>To be committed to {branch ?? 'this commit'}:</p>
          <ul className="space-y-0.5">
            {[...changes, ...alreadyStaged].map(change => {
              // As git will have it once staged
              const status = changeStatus({
                ...change,
                staged: true,
                unstaged: false,
              })
              const elsewhere = alreadyStaged.includes(change)
              return (
                <li
                  key={change.path}
                  className="flex items-center gap-2"
                  title={change.path.slice(prefix.length)}
                >
                  <span className="min-w-0 flex-1 truncate">
                    {fileName(change.path)}
                    {elsewhere && (
                      <span className="italic"> · staged outside AE</span>
                    )}
                  </span>
                  <StatusLetter status={status} />
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}

function StatusDot({ tone }: { tone: GitTone | null }) {
  return (
    <span
      aria-hidden
      className={cn(
        'size-2 shrink-0 rounded-full',
        tone ? DOT_COLOURS[tone] : 'bg-muted-foreground/40'
      )}
    />
  )
}

/** VS Code's status letter, coloured, with git's word for it as a tooltip */
function StatusLetter({ status }: { status: ReturnType<typeof changeStatus> }) {
  return (
    <span
      title={status.label}
      aria-label={status.label}
      className={cn(
        'w-3 shrink-0 text-center font-mono text-xs font-semibold',
        LETTER_COLOURS[status.tone]
      )}
    >
      {status.letter}
    </span>
  )
}

/** A commit time as "just now", "3 days ago" or "on 27 Oct", to follow a verb */
function relativeDate(seconds: number, now?: Date): string {
  const text = formatLastOpened(new Date(seconds * 1000).toISOString(), now)
  // A date like "27 Oct", rather than "3 days ago"
  if (/^\d+ [A-Z]/.test(text)) return `on ${text}`
  return text.charAt(0).toLowerCase() + text.slice(1)
}

interface RowProps {
  /** The project folder within the repository, stripped from paths shown */
  prefix: string
  /** Staged, so the ticks can't change until the card is cancelled */
  locked: boolean
  isTicked: (path: string) => boolean
  onTick: (path: string, ticked: boolean) => void
  onOpen: (change: GitChange) => void
}

function OtherChanges({
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

function FileRow({
  change,
  note,
  prefix,
  locked,
  isTicked,
  onTick,
  onOpen,
}: RowProps & { change: GitChange; note?: string }) {
  const shown = change.path.startsWith(prefix)
    ? change.path.slice(prefix.length)
    : change.path
  const openable = /\.mdx?$/i.test(change.path) && change.kind !== 'deleted'
  return (
    <li>
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
