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
        <div className="flex items-center gap-2 px-3 py-2">
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
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <span className="truncate">{tree.upstream}</span>
                  {listed ? (
                    <button
                      type="button"
                      onClick={() => setOpen(!open)}
                      aria-expanded={open}
                      title={open ? 'Hide the commits' : 'Show the commits'}
                      className="inline-flex items-center gap-1.5 rounded-sm hover:text-foreground"
                    >
                      {counts}
                    </button>
                  ) : (
                    counts
                  )}
                </span>
              )
            )}
          </div>
          {canSync && (
            <div className="flex shrink-0 gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs"
                disabled={waiting || sync.pullBlocked !== null}
                onClick={sync.onPull}
                title={
                  sync.pullBlocked ??
                  `Fetch, then bring in new commits from ${upstream} if that can be done cleanly`
                }
              >
                {sync.pending === 'pull' ? 'Pulling…' : 'Pull'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs"
                disabled={waiting || tree.ahead === 0 || tree.behind > 0}
                onClick={sync.onPush}
                title={pushTitle}
              >
                {sync.pending === 'push' ? 'Pushing…' : 'Push'}
              </Button>
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
