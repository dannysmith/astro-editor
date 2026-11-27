import { useRef } from 'react'
import {
  commands,
  type Collection,
  type JsonValue,
  type MarkdownContent,
} from '@/types'
import { useEditorStore } from '../store/editorStore'
import { useProjectStore } from '../store/projectStore'
import { useUIStore } from '../store/uiStore'
import {
  useCreateFileMutation,
  type CreateFilePayload,
} from './mutations/useCreateFileMutation'
import { deserializeCompleteSchema, frontmatterSchema } from '../lib/schema'
import { newFileFrontmatter } from '../lib/files/new-file'
import { toast } from '../lib/toast'
import { focusEditor } from '../lib/focus-utils'
import { todayIsoDate } from '../lib/dates'
import { fieldMappings, getCollection } from '../lib/project-scan'
import { fileNameStem } from '../lib/files/file-name-pattern'
import { nextIndexIn, rememberNewFile } from '../lib/files/rename'
import { getNestedValue } from '../lib/object-utils'

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

/** The collection's template, split for writing, or null if it has none */
async function readTemplate(
  collection: Collection,
  projectPath: string
): Promise<MarkdownContent | null> {
  const pathResult = await commands.newFileTemplate(collection, projectPath)
  if (pathResult.status === 'error') throw new Error(pathResult.error)
  if (!pathResult.data) return null

  const result = await commands.parseMarkdownContent(
    pathResult.data,
    projectPath
  )
  if (result.status === 'error') throw new Error(result.error)
  return result.data
}

/**
 * Creates a file named by the collection's pattern (without a title yet) in
 * `subdirectory` of the collection (its folder when null), from the
 * collection's template if it has one, with frontmatter from its schema (a
 * placeholder title, today's date, see `newFileFrontmatter`), then opens it
 * and focuses its title or the editor. A file whose pattern uses the title is
 * renamed once the title is written (`renameNewFileFromTitle`).
 * Plain function rather than inline in the hook so the React Compiler can
 * compile the hook (it can't handle `throw` inside `try`).
 */
async function createFileIn(
  createFile: (payload: CreateFilePayload) => Promise<unknown>,
  collectionName: string,
  subdirectory: string | null
): Promise<void> {
  const currentProjectPath = useProjectStore.getState().projectPath
  const collection = getCollection(collectionName)
  if (!collection || !currentProjectPath) {
    toast.error('Collection not found')
    return
  }

  // Calculate target directory (collection root or subdirectory)
  const targetDirectory = subdirectory
    ? `${collection.path}/${subdirectory}`
    : collection.path

  // The collection's pattern with no title yet, which may leave just the date,
  // or today's date if it leaves nothing
  const today = todayIsoDate()
  const now = new Date()
  const stem =
    fileNameStem(collection.settings.fileNamePattern.value, {
      title: '',
      date: now,
      now,
      index: await nextIndexIn(targetDirectory, collection, currentProjectPath),
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

  // The template's title is the placeholder, if it has one
  const template = await readTemplate(collection, currentProjectPath)
  const templateTitle =
    template && getNestedValue(template.frontmatter, mappings.title)
  const singularName = singularize(collectionName)
  const defaultTitle =
    typeof templateTitle === 'string' && templateTitle.trim()
      ? templateTitle
      : `New ${singularName.charAt(0).toUpperCase() + singularName.slice(1)}`

  await createFile({
    directory: targetDirectory,
    filename,
    frontmatter: newFileFrontmatter(
      fields,
      mappings,
      defaultTitle,
      today,
      template?.frontmatter
    ) as Record<string, JsonValue>,
    template,
    schema: frontmatterSchema(fields),
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
    openFile(newFile)
    if (hasTitleField) rememberNewFile(newFile.path, defaultTitle)

    // Show the frontmatter panel so its title field can be focused
    if (hasTitleField) {
      useUIStore.getState().showRightSidebarTab('frontmatter')
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
          // WebKit doesn't scroll a field it focuses into view, and the panel
          // may still be scrolled down from the last file
          titleField.scrollIntoView({ block: 'center' })
        }
      } else {
        focusEditor()
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

    // In the folder open in the sidebar
    const { selectedCollection, currentSubdirectory } =
      useProjectStore.getState()
    if (!selectedCollection) {
      toast.error('No collection selected')
      return
    }

    isCreatingRef.current = true
    await createFileIn(
      createFileMutation.mutateAsync,
      selectedCollection,
      currentSubdirectory
    ).catch(error =>
      toast.error('Failed to create new file', {
        description:
          error instanceof Error ? error.message : 'Unknown error occurred',
      })
    )
    isCreatingRef.current = false
  }

  return { createNewFile }
}
