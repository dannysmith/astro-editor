import type { GitChange } from '@/lib/bindings'

/** Which status colour a change takes: the `--git-*` tokens */
export type GitTone = 'added' | 'modified' | 'deleted' | 'conflict'

/**
 * A change's status in git's terms, the letter VS Code shows for it, and its
 * colour. Other tools stage files too, so staged and partly staged changes are
 * named; the letter is the same either way, as in VS Code.
 */
export function changeStatus(change: GitChange): {
  label: string
  letter: string
  tone: GitTone
} {
  const partly = change.staged && change.unstaged
  switch (change.kind) {
    case 'conflicted':
      return { label: 'Conflicted', letter: '!', tone: 'conflict' }
    case 'deleted':
      return { label: 'Deleted', letter: 'D', tone: 'deleted' }
    case 'renamed':
      return {
        label: partly ? 'Renamed, partly staged' : 'Renamed',
        letter: 'R',
        tone: 'added',
      }
    case 'new':
      if (!change.staged) {
        return { label: 'Untracked', letter: 'U', tone: 'added' }
      }
      return {
        label: partly ? 'Added, partly staged' : 'Added',
        letter: 'A',
        tone: 'added',
      }
    case 'modified':
      return {
        label: partly ? 'Partly staged' : change.staged ? 'Staged' : 'Modified',
        letter: 'M',
        tone: 'modified',
      }
  }
}
