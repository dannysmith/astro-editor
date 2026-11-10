/**
 * Remembers the entry open in each project, so opening the project goes back
 * to it. The registry stores it (`set_last_entry`), relative to the project.
 * It's a convenience: a failed write is logged, never shown.
 */

import { debug, warn as logWarn } from '@tauri-apps/plugin-log'
import { commands, type ProjectMetadata } from '../bindings'
import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'

/** How long a file stays open before it's remembered, so flicking through files writes only the last */
const REMEMBER_DELAY_MS = 1000

let pending: { projectId: string; filePath: string | null } | null = null
let timer: ReturnType<typeof setTimeout> | null = null

/**
 * Remembers `filePath` (absolute) as the open project's entry, or forgets it
 * with null, after a short delay. Only the latest call within the delay is
 * written, unless the project changed, when the earlier one is written first.
 */
export function rememberLastEntry(filePath: string | null): void {
  const projectId = useProjectStore.getState().currentProjectId
  if (!projectId) return
  if (pending && pending.projectId !== projectId) void flushLastEntry()
  pending = { projectId, filePath }
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => void flushLastEntry(), REMEMBER_DELAY_MS)
}

/**
 * The latest write. Each write waits for the one before, so they land in
 * order, and a flush waits for one already under way.
 */
let writing: Promise<void> = Promise.resolve()

/**
 * Writes a remembered entry now, and waits for any write under way. Call
 * before quitting or switching projects. Never throws: the binding rethrows
 * IPC failures, and nothing that waits on this should fail because of it.
 */
export async function flushLastEntry(): Promise<void> {
  if (timer) clearTimeout(timer)
  timer = null
  const entry = pending
  pending = null
  if (entry) writing = writing.then(() => write(entry))
  await writing
}

async function write(entry: {
  projectId: string
  filePath: string | null
}): Promise<void> {
  const failed = (reason: string) =>
    void logWarn(
      `Astro Editor [LAST_ENTRY] Couldn't remember the open file: ${reason}`
    )
  await commands
    .setLastEntry(entry.projectId, entry.filePath)
    .then(result => {
      if (result.status === 'error') failed(result.error)
    })
    .catch((error: unknown) => failed(String(error)))
}

/**
 * Opens the entry `project` had open when it was last left, if it's still an
 * entry in one of its collections. Opens nothing if `overtaken` (a later
 * project open) or once any file has been opened meanwhile, by a deep link or
 * the writer, which wins. Opens through `openFile`, so it reads from disk.
 */
export async function reopenLastEntry(
  project: ProjectMetadata,
  overtaken: () => boolean
): Promise<void> {
  const superseded = () =>
    overtaken() || useEditorStore.getState().currentFile !== null
  if (!project.lastEntry || superseded()) return

  const result = await commands.resolveFileEntry(
    `${project.path}/${project.lastEntry}`,
    project.path
  )
  if (superseded()) return
  if (result.status === 'error' || !result.data) {
    void debug(
      `Astro Editor [LAST_ENTRY] Not reopening ${project.lastEntry}: it isn't an entry any more`
    )
    return
  }
  useEditorStore.getState().openFile(result.data)
}
