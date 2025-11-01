import { useCallback, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useEditorStore } from '../store/editorStore'
import type { FileEntry } from '@/types'
import { useProjectStore } from '../store/projectStore'
import { useUIStore } from '../store/uiStore'
import { useCollectionsQuery } from './queries/useCollectionsQuery'
import { useCreateFileMutation } from './mutations/useCreateFileMutation'
import { deserializeCompleteSchema, FieldType } from '../lib/schema'
import { toast } from '../lib/toast'
import { todayIsoDate } from '../lib/dates'

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

// Helper function to get default value based on field type
const getDefaultValueForFieldType = (type: FieldType): unknown => {
  switch (type) {
    case FieldType.String:
    case FieldType.Email:
    case FieldType.URL:
      return ''
    case FieldType.Number:
    case FieldType.Integer:
      return 0
    case FieldType.Boolean:
      return false
    case FieldType.Date:
      return todayIsoDate() // YYYY-MM-DD format
    case FieldType.Array:
      return []
    default:
      return ''
  }
}

export const useCreateFile = () => {
  // PERFORMANCE FIX: Only subscribe to data needed for TanStack Query
  // Get other values via getState() to avoid frequent re-renders
  const { projectPath, currentProjectSettings } = useProjectStore()

  const { data: collections = [] } = useCollectionsQuery(
    projectPath,
    currentProjectSettings
  )

  const createFileMutation = useCreateFileMutation()

  // React ref for concurrency guard (doesn't trigger re-renders)
  const isCreatingRef = useRef(false)

  const createNewFile = useCallback(async () => {
    if (isCreatingRef.current) {
      return // Silently ignore concurrent calls
    }

    isCreatingRef.current = true

    try {
      // Get current values from store state
      const { selectedCollection, currentSubdirectory } =
        useProjectStore.getState()
      const currentProjectPath = useProjectStore.getState().projectPath

      if (!selectedCollection || !currentProjectPath) {
        toast.error('No collection selected')
        return
      }

      const collection = collections.find(c => c.name === selectedCollection)
      if (!collection) {
        toast.error('Collection not found')
        return
      }

      // Calculate target directory (collection root or subdirectory)
      const targetDirectory = currentSubdirectory
        ? `${collection.path}/${currentSubdirectory}`
        : collection.path

      // Generate filename based on today's date
      const today = todayIsoDate()
      let filename = `${today}.md`
      let counter = 1

      // Check if file exists in target directory and increment counter if needed
      const existingDirContents = await invoke<{
        files: FileEntry[]
        subdirectories: unknown[]
      }>('scan_directory', {
        directoryPath: targetDirectory,
        collectionName: selectedCollection,
        collectionRoot: collection.path,
      })

      const existingNames = new Set(
        existingDirContents.files.map(f =>
          f.extension ? `${f.name}.${f.extension}` : f.name
        )
      )

      while (existingNames.has(filename)) {
        filename = `${today}-${counter}.md`
        counter++
      }

      // Generate default frontmatter from schema
      const schema = collection.complete_schema
        ? deserializeCompleteSchema(collection.complete_schema)
        : null
      const defaultFrontmatter: Record<string, unknown> = {}

      // Track if we have a title field in the schema
      let hasTitleField = false

      // Generate default title
      const singularName = singularize(selectedCollection)
      const defaultTitle = `New ${singularName.charAt(0).toUpperCase() + singularName.slice(1)}`

      if (schema?.fields) {
        for (const field of schema.fields) {
          // Check if this is a title field
          if (field.name.toLowerCase() === 'title') {
            hasTitleField = true
            // Always include title field with default value
            defaultFrontmatter[field.name] = defaultTitle
          }
          // Check for date fields (pubDate, date, publishedDate)
          else if (
            field.type === FieldType.Date &&
            (field.name.toLowerCase() === 'pubdate' ||
              field.name.toLowerCase() === 'date' ||
              field.name.toLowerCase() === 'publisheddate')
          ) {
            // Only add date fields if they exist in the schema
            defaultFrontmatter[field.name] = today
          }
          // Include other required fields
          else if (field.required) {
            // Use field default if available, otherwise use type-based defaults
            defaultFrontmatter[field.name] =
              field.default !== undefined
                ? field.default
                : getDefaultValueForFieldType(field.type)
          }
        }
      }

      // Create YAML frontmatter with proper type formatting
      const frontmatterYaml =
        Object.keys(defaultFrontmatter).length > 0
          ? `---\n${Object.entries(defaultFrontmatter)
              .map(([key, value]) => {
                if (typeof value === 'string') {
                  return `${key}: "${value}"`
                } else if (typeof value === 'boolean') {
                  return `${key}: ${value}` // Don't quote booleans
                } else if (Array.isArray(value)) {
                  return `${key}: []` // Empty array
                } else if (typeof value === 'number') {
                  return `${key}: ${value}` // Don't quote numbers
                }
                return `${key}: ${String(value)}`
              })
              .join('\n')}\n---\n\n`
          : ''

      // Create the file in target directory (respects current subdirectory)
      await createFileMutation.mutateAsync({
        directory: targetDirectory,
        filename,
        content: frontmatterYaml,
        projectPath: currentProjectPath,
        collectionName: selectedCollection,
      })

      // Find and open the newly created file
      const updatedDirContents = await invoke<{
        files: FileEntry[]
        subdirectories: unknown[]
      }>('scan_directory', {
        directoryPath: targetDirectory,
        collectionName: selectedCollection,
        collectionRoot: collection.path,
      })

      const newFile = updatedDirContents.files.find(
        f => (f.extension ? `${f.name}.${f.extension}` : f.name) === filename
      )

      if (newFile) {
        // Get current functions from store state
        const { openFile } = useEditorStore.getState()
        const { frontmatterPanelVisible, toggleFrontmatterPanel } =
          useUIStore.getState()

        openFile(newFile)

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
    } catch (error) {
      toast.error('Failed to create new file', {
        description:
          error instanceof Error ? error.message : 'Unknown error occurred',
      })
    } finally {
      isCreatingRef.current = false
    }
  }, [collections, createFileMutation]) // PERFORMANCE FIX: Only include stable dependencies, get other values via getState()

  return { createNewFile }
}
