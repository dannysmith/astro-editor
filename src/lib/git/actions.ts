/**
 * The Git tab's writes, for its mutations. Those that take the entry's
 * contents save it first, so what's staged, committed or checked is what the
 * writer sees. They throw with a message to show when anything fails.
 */

import { error as logError } from '@tauri-apps/plugin-log'
import { commands, type MarkdownContent } from '@/lib/bindings'
import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'
import { deleteFile } from '../files/delete'
import { queryClient } from '../query-client'
import { queryKeys } from '../query-keys'
import { toast } from '../toast'
import { fileName } from './entry-files'

/** One of the tab's writes, for the entry at `entry` (its absolute path, as the editor has it) */
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
  void reloadEntry()
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
 * Reads the entry again after git may have changed it on disk (a `pre-commit`
 * hook's formatter, a pull), rather than waiting for the file watcher, so
 * editing only resumes on the new text. Unsaved edits win, as they do
 * everywhere. Resolves once
 * the editor's store holds what was read, not just the query: the store takes
 * it in an effect a moment later, and an edit in between would win over it.
 */
async function reloadEntry() {
  const { currentFile, isDirty } = useEditorStore.getState()
  const { projectPath } = useProjectStore.getState()
  if (!currentFile || !projectPath || isDirty) return
  const queryKey = queryKeys.fileContent(projectPath, currentFile.path)
  await queryClient.invalidateQueries({ queryKey })
  const read = queryClient.getQueryData<MarkdownContent>(queryKey)
  if (read) {
    await useEditorStore
      .getState()
      .untilLoaded(currentFile.path, read.content, read.raw_frontmatter)
  }
}

/** Pushes the branch to its upstream */
export async function pushBranch(projectPath: string) {
  const result = await commands.gitPush(projectPath)
  if (result.status === 'error') throw new Error(result.error)
}

/**
 * Fetches and brings in the upstream's new commits, when that can be done
 * cleanly. Fetches while the writer goes on writing, then pauses editing and
 * saves the entry, so the check for uncommitted changes the remote also
 * changed sees the writer's latest and nothing typed after it is left to save
 * over the pulled text. Reads the entry again before editing resumes, whether
 * or not the pull worked: one that failed part way may still have changed it.
 * Returns how many commits came in.
 */
export async function pullBranch(projectPath: string): Promise<number> {
  const fetched = await commands.gitFetch(projectPath)
  if (fetched.status === 'error') throw new Error(fetched.error)
  useEditorStore.setState({ editingPaused: true })
  try {
    await saveEntry()
    const result = await commands.gitPull(projectPath)
    await reloadEntry()
    if (result.status === 'error') throw new Error(result.error)
    return result.data
  } finally {
    useEditorStore.setState({ editingPaused: false })
  }
}

/**
 * Deletes a file AE added for the entry that it no longer uses (absolute
 * `path`), the same way the sidebar deletes files. Shows a toast if it fails.
 * Resolves to whether the file was deleted.
 */
export async function deleteUnusedFile(
  projectPath: string,
  path: string
): Promise<boolean> {
  try {
    return await deleteFile(path, projectPath, fileName(path))
  } catch (error) {
    void logError(`Failed to delete file: ${String(error)}`)
    toast.error("Couldn't delete the file", {
      description: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}
