import { useRef } from 'react'
import { commands, type JsonValue } from '@/types'
import { useEditorStore } from '../store/editorStore'
import { useProjectStore } from '../store/projectStore'
import { useUIStore } from '../store/uiStore'
import {
  useCreateFileMutation,
  type CreateFilePayload,
} from './mutations/useCreateFileMutation'
import { deserializeCompleteSchema } from '../lib/schema'
import { newFileFrontmatter } from '../lib/files/new-file'
import { toast } from '../lib/toast'
import { todayIsoDate } from '../lib/dates'
import { fieldMappings, getCollection } from '../lib/project-scan'
import { fileNameStem } from '../lib/files/file-name-pattern'
import { rememberNewFile } from '../lib/files/rename'

// Helper function to singularize collection name
const singularize = (word: string): string => {
  const pluralRules = [
    { suffix: 'ies', replacement: 'y' }, // stories -> story
    { suffix: 'es', replacement: 'e' }, // articles -> article (not articl)
    { suffix: 's', replacement: '' }, // notes -> note
  ]

  for (const rule of pluralRules) {
    if (word.endsWith(rule.suffix)) {
      return word.slice(0, -rule.suffix.length) + rule.replacement
    }
  }
  return word
}

/**
 * Creates a file named by the collection's pattern (without a title yet) in
 * the folder open in the sidebar, with frontmatter from the collection's
 * schema (a placeholder title, today's date, see `newFileFrontmatter`),
 * then opens it and focuses its title or the editor. A file whose pattern uses
 * the title is renamed once the title is written (`renameNewFileFromTitle`).
 * Plain function rather than inline in the hook so the React Compiler can
 * compile the hook (it can't handle `throw` inside `try`).
 */
async function createFileInCurrentFolder(
  createFile: (payload: CreateFilePayload) => Promise<unknown>
): Promise<void> {
  // Get current values from store state
  const { selectedCollection, currentSubdirectory } = useProjectStore.getState()
  const currentProjectPath = useProjectStore.getState().projectPath

  if (!selectedCollection || !currentProjectPath) {
    toast.error('No collection selected')
    return
  }

  const collection = getCollection(selectedCollection)
  if (!collection) {
    toast.error('Collection not found')
    return
  }

  // Calculate target directory (collection root or subdirectory)
  const targetDirectory = currentSubdirectory
    ? `${collection.path}/${currentSubdirectory}`
    : collection.path

  // The collection's pattern with no title yet, which may leave just the date,
  // or today's date if it leaves nothing
  const today = todayIsoDate()
  const stem =
    fileNameStem(collection.settings.fileNamePattern.value, {
      title: '',
      date: new Date(),
    }) || today

  // A free name the collection's pattern includes, in its new file type
  const nameResult = await commands.newFileName(
    targetDirectory,
    collection,
    stem,
    currentProjectPath
  )
  if (nameResult.status === 'error') {
    throw new Error(nameResult.error)
  }
  const filename = nameResult.data
  if (!filename) {
    toast.error("A new file here wouldn't be part of the collection", {
      description: "The collection's pattern leaves out files in this folder.",
    })
    return
  }

  const fields = collection.completeSchema
    ? (deserializeCompleteSchema(collection.completeSchema)?.fields ?? [])
    : []
  const mappings = fieldMappings(collection)
  const hasTitleField = fields.some(f => f.name === mappings.title)

  const singularName = singularize(selectedCollection)
  const defaultTitle = `New ${singularName.charAt(0).toUpperCase() + singularName.slice(1)}`

  // Create the file in target directory (respects current subdirectory)
  await createFile({
    directory: targetDirectory,
    filename,
    frontmatter: newFileFrontmatter(
      fields,
      mappings,
      defaultTitle,
      today
    ) as Record<string, JsonValue>,
    schemaFieldOrder: fields.map(f => f.name),
    projectPath: currentProjectPath,
  })

  // Open the new file
  const newFileResult = await commands.resolveFileEntry(
    `${targetDirectory}/${filename}`,
    currentProjectPath
  )
  if (newFileResult.status === 'error') {
    throw new Error(newFileResult.error)
  }
  const newFile = newFileResult.data

  if (newFile) {
    // Get current functions from store state
    const { openFile } = useEditorStore.getState()
    const { frontmatterPanelVisible, toggleFrontmatterPanel } =
      useUIStore.getState()

    openFile(newFile)
    if (hasTitleField) rememberNewFile(newFile.path, defaultTitle)

    // Open frontmatter panel if we have a title field
    if (hasTitleField && !frontmatterPanelVisible) {
      toggleFrontmatterPanel()
    }

    // Focus the appropriate element after a delay to allow UI to update
    setTimeout(() => {
      if (hasTitleField) {
        // Try to find and focus the title field by ID
        const titleField = document.getElementById(
          'frontmatter-title-field'
        ) as HTMLTextAreaElement
        if (titleField) {
          titleField.focus()
          titleField.select()
        }
      } else {
        // No title field, focus the main editor
        const cmEditor = document.querySelector(
          '.cm-editor .cm-content'
        ) as HTMLElement
        if (cmEditor) {
          cmEditor.focus()
        }
      }
    }, 200)
  }
}

export const useCreateFile = () => {
  const createFileMutation = useCreateFileMutation()

  // React ref for concurrency guard (doesn't trigger re-renders)
  const isCreatingRef = useRef(false)

  const createNewFile = async () => {
    if (isCreatingRef.current) {
      return // Silently ignore concurrent calls
    }

    isCreatingRef.current = true
    await createFileInCurrentFolder(createFileMutation.mutateAsync).catch(
      error =>
        toast.error('Failed to create new file', {
          description:
            error instanceof Error ? error.message : 'Unknown error occurred',
        })
    )
    isCreatingRef.current = false
  }

  return { createNewFile }
}
