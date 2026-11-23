import type { GitWorkingTree } from '@/lib/bindings'

/** What the Git tab staged, and for which entry */
export interface Staging {
  /** The project it was staged in */
  project: string
  /** The entry's absolute path, as the editor has it. Follows a rename */
  entry: string
  /** The staged paths, relative to the repository root */
  paths: string[]
}

/** What the Git tab's staging means for the open entry */
export interface StagingState {
  /** The paths staged for the open entry, so its commit card is open */
  ours: string[] | null
  /** Staging for another entry, which has to be committed or cancelled first,
   * since one commit takes everything staged */
  elsewhere: Staging | null
  /** Why Pull can't run now */
  pullBlocked: string | null
}

/**
 * Staging counts only while git still has some of its paths staged, so
 * committing or unstaging them in another app folds the card, and it can't
 * reopen when something else is staged later. Pull rebases when the branch
 * is ahead, which unstages whatever's staged, whoever staged it (Rust refuses
 * it too).
 */
export function stagingState({
  staging,
  project,
  entry,
  tree,
}: {
  staging: Staging | null
  project: string
  /** The open entry's absolute path */
  entry: string | null
  tree: GitWorkingTree | null | undefined
}): StagingState {
  const live =
    staging &&
    staging.project === project &&
    tree?.staged.some(change => staging.paths.includes(change.path))
      ? staging
      : null
  return {
    ours: live && live.entry === entry ? live.paths : null,
    elsewhere: live && live.entry !== entry ? live : null,
    pullBlocked:
      tree && tree.ahead > 0 && tree.staged.length > 0
        ? 'Commit or unstage the staged files first'
        : null,
  }
}
