import { useEffect, useRef } from 'react'
import { CircleCheck } from 'lucide-react'
import type { GitChange, GitWorkingTree } from '@/lib/bindings'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { GitWrite } from '../../lib/git/actions'
import { fileName } from '../../lib/git/entry-files'
import { changeStatus } from '../../lib/git/status'
import { counted } from '../../lib/plural'
import { ProblemCallout } from '../project-settings/Problems'
import { StatusLetter, fileMenu, type FileMenu } from './status-marks'

/** Staging and committing the open entry, from `GitPanel` */
export interface GitCommitProps {
  /** Whether AE has staged files for the entry, with the card open */
  staging: boolean
  /** The paths AE staged, so others in the index are marked */
  ourPaths: string[]
  /** The write under way for this entry, if any */
  pending: GitWrite['action'] | null
  /** Another git command is under way (for another entry, or a pull) */
  busy: boolean
  /**
   * AE staged files for another entry, which must be committed or cancelled
   * before this one can stage: one commit takes everything staged
   */
  stagedElsewhere: { name: string; onOpen: () => void } | null
  /** Which write failed last, and why, in git's words */
  error: { action: GitWrite['action']; message: string } | null
  /** The hash of the commit just made for the entry */
  committed: string | null
  /** The commit message: the prefill, or what's been typed for this entry */
  message: string
  onMessageChange: (message: string) => void
  /** Stages these paths, relative to the repository root */
  onStage: (paths: string[]) => void
  onUnstage: () => void
  onCommit: () => void
}

/**
 * Staging and committing the entry with the files ticked below. Folded, it's
 * the Stage button (and the last commit's hash, once there is one); staged,
 * it's `StagedCard`.
 */
export function CommitCard({
  toStage,
  tree,
  onFileMenu,
  ...commit
}: GitCommitProps & {
  /** The entry's change and the ticked files */
  toStage: GitChange[]
  tree: GitWorkingTree
  onFileMenu: FileMenu
}) {
  if (commit.staging) {
    return <StagedCard {...commit} tree={tree} onFileMenu={onFileMenu} />
  }
  if (commit.stagedElsewhere) {
    return (
      <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs text-muted-foreground">
        <span className="min-w-0 flex-1">
          Files are staged for {commit.stagedElsewhere.name}. Commit or cancel
          them there first.
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={commit.stagedElsewhere.onOpen}
        >
          Open
        </Button>
      </div>
    )
  }
  const count = toStage.length
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        disabled={count === 0 || commit.pending !== null || commit.busy}
        onClick={() => commit.onStage(toStage.map(change => change.path))}
      >
        {commit.pending === 'stage'
          ? 'Staging…'
          : count === 0
            ? 'Nothing to stage'
            : `Stage ${counted(count, 'file')}`}
      </Button>
      <WriteError error={commit.error} />
      {commit.committed && !commit.error && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CircleCheck className="size-3.5 shrink-0 text-git-added" />
          Committed <span className="font-mono">{commit.committed}</span>
          {tree.branch && ` to ${tree.branch}`}
        </p>
      )}
    </>
  )
}

/** What failed, by the write that failed */
const ERROR_MESSAGES: Record<GitWrite['action'], string> = {
  stage: "Git couldn't stage the files.",
  unstage: "Git couldn't unstage the files.",
  commit: "Git couldn't commit.",
}

function WriteError({ error }: { error: GitCommitProps['error'] }) {
  if (!error) return null
  return (
    <ProblemCallout
      problem={{
        level: 'error',
        message: ERROR_MESSAGES[error.action],
        detail: error.message,
      }}
    />
  )
}

/**
 * The open commit card: a banner saying the files are staged, the message
 * (focused and selected, ready to type over), Cancel and Commit, and exactly
 * what the commit will hold, as git has it
 */
function StagedCard({
  tree,
  ourPaths,
  pending,
  busy,
  error,
  message,
  onMessageChange,
  onUnstage,
  onCommit,
  onFileMenu,
}: GitCommitProps & { tree: GitWorkingTree; onFileMenu: FileMenu }) {
  const messageRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    messageRef.current?.focus()
    messageRef.current?.select()
  }, [])
  const files = counted(tree.staged.length, 'file')
  const waiting = pending !== null || busy
  const canCommit = !waiting && message.trim() !== ''
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
            onKeyDown={event => {
              if (event.key === 'Enter' && event.metaKey && canCommit) {
                event.preventDefault()
                onCommit()
              }
            }}
            rows={2}
            className="resize-none bg-background text-sm"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={waiting}
            onClick={onUnstage}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!canCommit}
            onClick={onCommit}
            title="Commit (⌘↩)"
          >
            {pending === 'commit' ? 'Committing…' : `Commit ${files}`}
          </Button>
        </div>
        <WriteError error={error} />
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>To be committed to {tree.branch ?? 'this commit'}:</p>
          <ul className="space-y-0.5">
            {tree.staged.map(change => (
              <li
                key={change.path}
                className="flex items-center gap-2"
                title={change.path}
                onContextMenu={fileMenu(
                  onFileMenu,
                  change.path,
                  change.kind !== 'deleted'
                )}
              >
                <span className="min-w-0 flex-1 truncate">
                  {fileName(change.path)}
                  {!ourPaths.includes(change.path) && (
                    <span className="italic"> · staged outside AE</span>
                  )}
                </span>
                <StatusLetter status={changeStatus(change)} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
