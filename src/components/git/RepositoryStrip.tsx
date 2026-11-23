import { useState } from 'react'
import { ArrowDown, ArrowUp, GitBranch } from 'lucide-react'
import type { GitCommit, GitWorkingTree } from '@/lib/bindings'
import { Button } from '@/components/ui/button'
import { counted } from '../../lib/plural'
import { ProblemCallout } from '../project-settings/Problems'

/** Pushing and pulling the branch, from `GitPanel` */
export interface GitSyncProps {
  /** The one under way, if any */
  pending: 'push' | 'pull' | null
  /** Another git command is under way (staging, committing) */
  busy: boolean
  /** Why Pull can't run now, if it can't */
  pullBlocked: string | null
  /** Which failed last, and why */
  error: { action: 'push' | 'pull'; message: string } | null
  onPush: () => void
  onPull: () => void
}

/**
 * The branch, its upstream, and how many commits it's ahead or behind, with
 * Pull and Push. Context for the rest of the tab, so it's kept quiet. The
 * counts open the lists of commits to push and to pull.
 */
export function RepositoryStrip({
  tree,
  sync,
  canSync,
}: {
  tree: GitWorkingTree
  sync: GitSyncProps
  /** Not in a read-only state, and on a branch with an upstream */
  canSync: boolean
}) {
  const [open, setOpen] = useState(false)
  const upstream = tree.upstream ?? ''
  const listed = tree.outgoing.length > 0 || tree.incoming.length > 0
  const waiting = sync.pending !== null || sync.busy
  const counts = (
    <>
      {tree.ahead > 0 && (
        <span className="inline-flex items-center">
          <ArrowUp className="size-3" />
          {tree.ahead}
        </span>
      )}
      {tree.behind > 0 && (
        <span className="inline-flex items-center">
          <ArrowDown className="size-3" />
          {tree.behind}
        </span>
      )}
      {tree.ahead === 0 && tree.behind === 0 && <span>in sync</span>}
    </>
  )
  const pushTitle =
    tree.behind > 0
      ? `Pull first: ${upstream} has commits you don't have`
      : tree.ahead === 0
        ? 'Nothing to push'
        : `Push ${counted(tree.ahead, 'commit')} to ${upstream}${tree.superproject ? ". This doesn't update the parent repository's pointer to this submodule" : ''}`

  return (
    <div className="space-y-2">
      <div className="rounded-md bg-muted/50 text-xs text-muted-foreground">
        {/* One line when it fits. Narrower, the buttons wrap onto their own
            line, and then the upstream's name is cut short */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
          <div className="flex min-w-0 flex-auto items-center gap-2 whitespace-nowrap">
            <GitBranch className="size-3.5 shrink-0" />
            <span className="max-w-[60%] shrink-0 truncate font-medium text-foreground">
              {tree.branch ?? 'Detached HEAD'}
            </span>
            {!tree.hasCommits ? (
              <span className="truncate">no commits yet</span>
            ) : tree.branch && !tree.upstream ? (
              <span className="truncate">no upstream</span>
            ) : (
              tree.upstream && (
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate" title={tree.upstream}>
                    {tree.upstream}
                  </span>
                  {listed ? (
                    <button
                      type="button"
                      onClick={() => setOpen(!open)}
                      aria-expanded={open}
                      aria-label={`${tree.ahead} to push, ${tree.behind} to pull. ${open ? 'Hide' : 'Show'} the commits`}
                      title={open ? 'Hide the commits' : 'Show the commits'}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-sm hover:text-foreground"
                    >
                      {counts}
                    </button>
                  ) : (
                    <span className="inline-flex shrink-0 items-center gap-1.5">
                      {counts}
                    </span>
                  )}
                </span>
              )
            )}
          </div>
          {canSync && (
            // The titles are on wrappers: a disabled button takes no pointer
            // events, so its own title would never show, and that's when
            // the reason matters
            <div className="ml-auto flex shrink-0 gap-1">
              <span
                title={
                  sync.pullBlocked ??
                  `Fetch, then bring in new commits from ${upstream} if that can be done cleanly`
                }
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  disabled={waiting || sync.pullBlocked !== null}
                  onClick={sync.onPull}
                >
                  {sync.pending === 'pull' ? 'Pulling…' : 'Pull'}
                </Button>
              </span>
              <span title={pushTitle}>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  disabled={waiting || tree.ahead === 0 || tree.behind > 0}
                  onClick={sync.onPush}
                >
                  {sync.pending === 'push' ? 'Pushing…' : 'Push'}
                </Button>
              </span>
            </div>
          )}
        </div>
        {open && listed && (
          <div className="space-y-2 border-t border-border/60 px-3 py-2">
            <CommitList title="To push" commits={tree.outgoing} />
            <CommitList
              title="To pull, as of the last fetch"
              commits={tree.incoming}
            />
            {tree.superproject && tree.outgoing.length > 0 && (
              <p>
                Pushing doesn&apos;t update the parent repository&apos;s pointer
                to this submodule.
              </p>
            )}
          </div>
        )}
      </div>
      {sync.error && (
        <ProblemCallout
          problem={{
            level: 'error',
            message:
              sync.error.action === 'push'
                ? "Git couldn't push."
                : "AE didn't pull.",
            detail: sync.error.message,
          }}
        />
      )}
    </div>
  )
}

/** Commits to push or pull: their subjects, with hash and author on hover */
function CommitList({
  title,
  commits,
}: {
  title: string
  commits: GitCommit[]
}) {
  if (commits.length === 0) return null
  return (
    <div className="space-y-0.5">
      <p>{title}</p>
      <ul>
        {commits.map(commit => (
          <li
            key={commit.hash}
            className="flex gap-2"
            title={`${commit.hash} by ${commit.author}`}
          >
            <span className="min-w-0 flex-1 truncate text-foreground">
              {commit.subject}
            </span>
            <span className="shrink-0 font-mono">{commit.hash}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
