import { RefreshCw } from 'lucide-react'
import type { GitChange, GitEntry, GitState } from '@/lib/bindings'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { gitProblem, readOnlyReason } from '../../lib/git/setup'
import { changeStatus } from '../../lib/git/status'
import { howLongAgo } from '../../lib/projects/display'
import { ProblemCallout } from '../project-settings/Problems'
import { CommitCard, type GitCommitProps } from './CommitCard'
import { FileRow, OtherChanges } from './FileList'
import { RepositoryStrip, type GitSyncProps } from './RepositoryStrip'
import { StatusDot, fileMenu, type FileMenu } from './status-marks'

export interface GitPanelViewProps {
  /** Undefined until git has been read once */
  state?: GitState
  /** Reading git failed outright */
  error?: string
  /**
   * When the refresh button last read git, so it spins once each time. Reads
   * that happen by themselves (saves, other apps) don't spin it
   */
  refreshedAt: number
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
  /** Files AE added for it this session that its text no longer names */
  unused: GitChange[]
  /** The entry's path before AE renamed it, when that's among `used` */
  renamedFrom: string | null
  /** Deletes one of the `unused` files, after asking */
  onDeleteUnused: (path: string) => void
  others: GitChange[]
  isTicked: (path: string) => boolean
  onTick: (path: string, ticked: boolean) => void
  /** Opens a changed content file */
  onOpen: (change: GitChange) => void
  onFileMenu: FileMenu
  onOpenSettings: () => void
  sync: GitSyncProps
  commit: GitCommitProps
  /** For relative dates, so the styleguide stays the same */
  now?: Date
}

/**
 * The Git tab, from what's passed in. See `GitPanel`. Top to bottom: the
 * repository strip, the entry and its commit card, the files it uses, and
 * the project's other changes.
 */
export function GitPanelView({
  state,
  error,
  refreshedAt,
  onRefresh,
  entry,
  entryChange,
  used,
  unused,
  renamedFrom,
  onDeleteUnused,
  others,
  isTicked,
  onTick,
  onOpen,
  onFileMenu,
  onOpenSettings,
  sync,
  commit,
  now,
}: GitPanelViewProps) {
  const tree = state?.tree
  const readOnly = tree && readOnlyReason(tree, tree.changes)
  // The open entry as git sees it, once git has been read for it
  const gitEntry = entry && tree?.entry ? tree.entry : null
  // Ticks only mean something when there's a commit to put files in: an
  // entry in this repository, not ignored, and git not in a read-only state
  const committable =
    gitEntry !== null &&
    !readOnly &&
    gitEntry.state !== 'outsideRepository' &&
    gitEntry.state !== 'ignored'
  const rows = {
    prefix: tree?.prefix ?? '',
    locked:
      !committable || commit.staging || commit.pending !== null || commit.busy,
    isTicked,
    onTick,
    onOpen,
    onFileMenu,
  }
  const ticked = [...used, ...unused, ...others].filter(c => isTicked(c.path))
  const toStage = entryChange ? [entryChange, ...ticked] : ticked

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-5 overflow-y-auto p-4 text-sm">
        {tree && (
          <RepositoryStrip
            tree={tree}
            sync={sync}
            canSync={
              !readOnly && tree.branch !== null && tree.upstream !== null
            }
          />
        )}

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
          <ProblemCallout
            problem={gitProblem(state.problem, null)}
            action={
              <Button variant="outline" size="sm" onClick={onOpenSettings}>
                Project Settings
              </Button>
            }
          />
        )}
        {readOnly && <ProblemCallout problem={readOnly} />}

        {tree && entry && gitEntry && (
          <section className="space-y-2">
            <EntryCard
              entry={gitEntry}
              name={entry.name}
              collection={entry.collection}
              change={entryChange}
              onFileMenu={onFileMenu}
              now={now}
            />
            {committable && (
              <CommitCard
                toStage={toStage}
                tree={tree}
                onFileMenu={onFileMenu}
                {...commit}
              />
            )}
          </section>
        )}

        {gitEntry && (used.length > 0 || unused.length > 0) && (
          <section className="space-y-2">
            <h3 className="font-medium text-foreground">Files it uses</h3>
            <ul className="space-y-1">
              {used.map(change => (
                <FileRow
                  key={change.path}
                  change={change}
                  note={
                    change.path === renamedFrom
                      ? "The entry's old name, renamed in AE"
                      : undefined
                  }
                  {...rows}
                />
              ))}
              {unused.map(change => (
                <FileRow
                  key={change.path}
                  change={change}
                  note="No longer used in the entry"
                  warning
                  deleteItem={
                    // Not once it's gone, nor while AE has files staged, since
                    // it may be one of them
                    change.kind === 'deleted'
                      ? undefined
                      : {
                          enabled:
                            !rows.locked && commit.stagedElsewhere === null,
                          onDelete: () => onDeleteUnused(change.path),
                        }
                  }
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
            // A new key each refresh, so it spins once
            key={refreshedAt}
            className={cn(
              'size-3.5',
              refreshedAt > 0 && 'animate-[spin_450ms_ease-out_1]'
            )}
          />
        </Button>
      </div>
    </div>
  )
}

/** The open entry: its status in git's terms, and when it was last committed */
function EntryCard({
  entry,
  name,
  collection,
  change,
  onFileMenu,
  now,
}: {
  entry: GitEntry
  name: string
  collection: string
  change: GitChange | null
  onFileMenu: FileMenu
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
      <div
        className="space-y-0.5 rounded-md border px-3 py-2.5"
        onContextMenu={
          // Empty when the entry is in another repository
          entry.path
            ? fileMenu(onFileMenu, entry.path, entry.state !== 'deleted')
            : undefined
        }
      >
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

/** A commit time as "just now", "3 days ago" or "on 27 Oct", to follow a verb */
function relativeDate(seconds: number, now?: Date): string {
  const ago = howLongAgo(new Date(seconds * 1000), now)
  return 'phrase' in ago ? ago.phrase : `on ${ago.date}`
}
