/**
 * The Git tab's writes, for its mutations. Those that take the entry's
 * contents save it first, so what's staged, committed or checked is what the
 * writer sees. They throw with a message to show when anything fails.
 */

import { commands } from '@/lib/bindings'
import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'
import { queryClient } from '../query-client'
import { queryKeys } from '../query-keys'

/** One of the tab's writes, for the entry at `entry` (repository-relative) */
export type GitWrite =
  | { action: 'stage'; entry: string; paths: string[] }
  | { action: 'unstage'; entry: string; paths: string[] }
  | { action: 'commit'; entry: string; paths: string[]; message: string }

/** Runs a write. A commit returns its abbreviated hash. */
export async function runGitWrite(
  projectPath: string,
  write: GitWrite
): Promise<string | null> {
  switch (write.action) {
    case 'stage':
      await stageFiles(projectPath, write.paths)
      return null
    case 'unstage':
      await unstageFiles(projectPath, write.paths)
      return null
    case 'commit':
      return commitFiles(projectPath, write.paths, write.message)
  }
}

/** Stages `paths` (relative to the repository root) */
async function stageFiles(projectPath: string, paths: string[]) {
  await saveEntry()
  const result = await commands.gitStage(projectPath, paths)
  if (result.status === 'error') throw new Error(result.error)
}

/** Takes `paths` out of the index again */
async function unstageFiles(projectPath: string, paths: string[]) {
  const result = await commands.gitUnstage(projectPath, paths)
  if (result.status === 'error') throw new Error(result.error)
}

/**
 * Stages `paths` again, to take anything saved since, and commits everything
 * staged. Returns the commit's abbreviated hash.
 */
async function commitFiles(
  projectPath: string,
  paths: string[],
  message: string
): Promise<string> {
  await saveEntry()
  const result = await commands.gitCommit(projectPath, paths, message)
  if (result.status === 'error') throw new Error(result.error)
  reloadEntry()
  return result.data
}

async function saveEntry() {
  const { isDirty, saveFile } = useEditorStore.getState()
  if (isDirty) await saveFile(false)
  // A failed save keeps the file dirty, and has said why
  if (useEditorStore.getState().isDirty) {
    throw new Error("The entry couldn't be saved, so nothing was changed.")
  }
}

/**
 * A `pre-commit` hook may have rewritten the entry on disk (a formatter), and
 * the file watcher ignores changes just after our own save, so read it again.
 * Unsaved edits made during the commit win, as they do everywhere.
 */
function reloadEntry() {
  const { currentFile, isDirty } = useEditorStore.getState()
  const { projectPath } = useProjectStore.getState()
  if (!currentFile || !projectPath || isDirty) return
  void queryClient.invalidateQueries({
    queryKey: queryKeys.fileContent(projectPath, currentFile.id),
  })
}

/** Pushes the branch to its upstream */
export async function pushBranch(projectPath: string) {
  const result = await commands.gitPush(projectPath)
  if (result.status === 'error') throw new Error(result.error)
}

/**
 * Fetches and brings in the upstream's new commits, when that can be done
 * cleanly. Saves the entry first, so the check for uncommitted changes the
 * remote also changed sees the writer's latest, and reads it again after,
 * since the pull may have changed it. Returns how many commits came in.
 */
export async function pullBranch(projectPath: string): Promise<number> {
  await saveEntry()
  const result = await commands.gitPull(projectPath)
  if (result.status === 'error') throw new Error(result.error)
  if (result.data > 0) reloadEntry()
  return result.data
}
