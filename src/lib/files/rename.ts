/**
 * Renaming the open file to follow its collection's file name pattern: by the
 * Rename File from Pattern command, the published date's "Rename file to
 * match" link, and once for a file created this session, when its title is
 * first written. Also the sidebar's rename, which guards the open file the
 * same way: saved first, and never written back to its old path.
 */

import { commands, type Collection, type FileEntry } from '@/lib/bindings'
import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'
import { fieldMappings, getCollection } from '../project-scan'
import { queryClient } from '../query-client'
import { isFileListing } from '../query-keys'
import { slugFromTitle } from '../slug'
import { toast } from '../toast'
import { fileNameStem, patternHasTitle } from './file-name-pattern'
import { getPublishedDate } from './sorting'

/** Files created this session, by path, with the placeholder title they got */
const newFiles = new Map<string, string>()

/** Remembers a file just created, so it's renamed once its title is written */
export function rememberNewFile(path: string, placeholderTitle: string) {
  newFiles.set(path, placeholderTitle)
}

/** The open file's rename, while it's under way: its path, and its new one */
let pendingRename: { from: string; to: Promise<string> } | null = null

/**
 * While the file at `path` is being renamed, the path it ends up at. Saves
 * wait for it, so they never write to the old path and bring the old file
 * back. Null otherwise, so other saves don't wait.
 */
export function renameUnderWay(path: string): Promise<string> | null {
  return pendingRename?.from === path ? pendingRename.to : null
}

/**
 * A file's name without its extension, or null for an `index` file. Astro
 * names those by their folder, so they're never renamed (as `rename_entry`
 * also enforces), and renaming only ever touches the file.
 */
export function renamableStem(path: string): string | null {
  const name = (path.split('/').at(-1) ?? '').replace(/\.[^.]+$/, '')
  return name === 'index' ? null : name
}

/** The title and date a file's name is made from: today without a date */
export function fileNameValues(
  frontmatter: Record<string, unknown>,
  collection: Collection
): { title: string; date: Date } {
  const mappings = fieldMappings(collection)
  const title = frontmatter[mappings.title]
  return {
    title: typeof title === 'string' ? title : '',
    date: getPublishedDate(frontmatter, mappings.publishedDate) ?? new Date(),
  }
}

/**
 * Renames the open file to `stem` (or `stem-1`… on a clash), keeping its
 * extension. Saves unsaved edits first, and doesn't rename if that fails.
 */
export async function renameOpenFile(stem: string): Promise<void> {
  const { currentFile } = useEditorStore.getState()
  const { projectPath } = useProjectStore.getState()
  const collection = getCollection(currentFile?.collection)
  if (!currentFile || !projectPath || !collection) return
  if (renamableStem(currentFile.path) === null) {
    toast.info("Files named index aren't renamed", {
      description: 'Astro names them by their folder.',
    })
    return
  }

  const { isDirty } = useEditorStore.getState()
  if (isDirty && !(await saveBeforeRename(currentFile.path))) return

  const rename = renameOnDisk(currentFile, collection, stem, projectPath)
  const from = currentFile.path
  pendingRename = {
    from,
    to: rename.then(
      result => (result === 'no-match' ? from : result.to),
      () => from
    ),
  }
  const result = await rename.catch((error: unknown) => {
    toast.error("Couldn't rename the file", {
      description: error instanceof Error ? error.message : String(error),
    })
    return 'failed' as const
  })
  pendingRename = null

  if (result === 'failed') return
  if (result === 'no-match') {
    toast.error("Couldn't rename the file", {
      description: "No name would match the collection's pattern.",
    })
    return
  }
  const name = result.to.slice(result.to.lastIndexOf('/') + 1)
  if (result.to === result.from) {
    toast.info(`It's already named ${name}`)
    return
  }

  void queryClient.invalidateQueries({
    predicate: ({ queryKey }) => isFileListing(queryKey, projectPath),
  })
  toast.success(`Renamed to ${name}`)
}

/**
 * Saves the open file at `path`, which has unsaved edits. False if the save
 * failed or another file was opened meanwhile (which saves this one again),
 * so the file shouldn't be renamed. Only called when the file is dirty, so a
 * clean file's rename starts straight away.
 */
async function saveBeforeRename(path: string): Promise<boolean> {
  const { saveFile, lastSaveTimestamp } = useEditorStore.getState()
  await saveFile(false)
  const after = useEditorStore.getState()
  return (
    after.lastSaveTimestamp !== lastSaveTimestamp &&
    after.currentFile?.path === path
  )
}

/**
 * Renames the file at `from` to `to` with `renameOnDisk`, which does it on
 * disk, as the sidebar's rename does. If it's the open file, its unsaved
 * edits are saved first (resolving false, unrenamed, if that fails), saves
 * of the old path wait for the rename and go to the new one, and the store
 * follows it. Rejects if the rename does.
 */
export async function renameFile(
  from: string,
  to: string,
  projectPath: string,
  renameOnDisk: () => Promise<unknown>
): Promise<boolean> {
  const isOpen = useEditorStore.getState().currentFile?.path === from
  const { isDirty } = useEditorStore.getState()
  if (isOpen && isDirty && !(await saveBeforeRename(from))) return false

  const renaming = renameOnDisk().then(() =>
    followRenamedFile(from, to, projectPath)
  )
  if (isOpen) {
    pendingRename = {
      from,
      to: renaming.then(
        () => to,
        () => from
      ),
    }
  }
  await renaming.finally(() => {
    if (isOpen) pendingRename = null
  })
  return true
}

/**
 * Renames the file in Rust and points the store at its new path, if it's
 * still open
 */
async function renameOnDisk(
  file: FileEntry,
  collection: Collection,
  stem: string,
  projectPath: string
): Promise<{ from: string; to: string } | 'no-match'> {
  const result = await commands.renameEntry(
    file.path,
    collection,
    stem,
    projectPath
  )
  if (result.status === 'error') throw new Error(result.error)
  const to = result.data
  if (to === null) return 'no-match'
  if (to !== file.path) {
    newFiles.delete(file.path)
    await followRenamedFile(file.path, to, projectPath)
  }
  return { from: file.path, to }
}

/**
 * Points the store at a renamed file's new path, if it's the open file: at
 * once, so a save can't write to the old path, then with the id it now has
 */
async function followRenamedFile(
  from: string,
  to: string,
  projectPath: string
): Promise<void> {
  const { currentFile, updateCurrentFileAfterRename } =
    useEditorStore.getState()
  if (currentFile?.path !== from) return
  const name = to.slice(to.lastIndexOf('/') + 1).replace(/\.[^.]+$/, '')
  updateCurrentFileAfterRename({ ...currentFile, path: to, name })

  const entry = await commands.resolveFileEntry(to, projectPath)
  if (
    entry.status === 'ok' &&
    entry.data &&
    useEditorStore.getState().currentFile?.path === to
  ) {
    updateCurrentFileAfterRename(entry.data)
  }
}

/** Renames the open file to the name its collection's pattern gives it now */
export async function renameOpenFileFromPattern(): Promise<void> {
  const { currentFile, frontmatter } = useEditorStore.getState()
  const collection = getCollection(currentFile?.collection)
  if (!currentFile || !collection) return
  const pattern = collection.settings.fileNamePattern.value
  const stem = fileNameStem(pattern, fileNameValues(frontmatter, collection))
  if (!stem) {
    toast.error("Couldn't rename the file", {
      description: patternHasTitle(pattern)
        ? 'Give it a title first.'
        : "The collection's file name pattern doesn't give a name.",
    })
    return
  }
  await renameOpenFile(stem)
}

/**
 * When the title of a file created this session is first written, renames
 * the file if its collection's pattern uses the title. Only once, and not
 * while the title is still the placeholder.
 */
export async function renameNewFileFromTitle(): Promise<void> {
  const { currentFile, frontmatter } = useEditorStore.getState()
  const collection = getCollection(currentFile?.collection)
  const placeholder = currentFile ? newFiles.get(currentFile.path) : undefined
  if (!currentFile || !collection || placeholder === undefined) return

  const pattern = collection.settings.fileNamePattern.value
  if (!patternHasTitle(pattern) || renamableStem(currentFile.path) === null) {
    newFiles.delete(currentFile.path)
    return
  }
  const values = fileNameValues(frontmatter, collection)
  if (values.title === placeholder || !slugFromTitle(values.title)) return

  newFiles.delete(currentFile.path)
  await renameOpenFile(fileNameStem(pattern, values))
}
