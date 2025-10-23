// src/hooks/mutations/useSaveFileMutation.ts

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import { queryKeys } from '@/lib/query-keys'
import { toast } from '@/lib/toast'

// The payload for our Tauri command
interface SaveFilePayload {
  filePath: string
  frontmatter: Record<string, unknown>
  content: string
  imports: string
  schemaFieldOrder: string[] | null
  projectPath: string // Need this for invalidating queries
  collectionName: string // Need this to invalidate collection files query
}

const saveFile = (payload: SaveFilePayload) => {
  return invoke('save_markdown_content', {
    filePath: payload.filePath,
    frontmatter: payload.frontmatter,
    content: payload.content,
    imports: payload.imports,
    schemaFieldOrder: payload.schemaFieldOrder,
    projectRoot: payload.projectPath,
  })
}

export const useSaveFileMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: saveFile,
    onSuccess: (_, variables) => {
      // This is the magic part!
      // After a successful save, we tell TanStack Query that the data
      // for this file is now stale. It will automatically refetch it
      // the next time it's needed, or immediately if it's on screen.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.fileContent(
          variables.projectPath,
          variables.filePath
        ),
      })

      // Also invalidate directory contents to update any metadata changes (title, draft, pubDate, etc.)
      // This invalidates all directory scans for this collection (root + all subdirectories)
      void queryClient.invalidateQueries({
        queryKey: [
          ...queryKeys.all,
          variables.projectPath,
          variables.collectionName,
          'directory',
        ],
      })

      toast.success('File saved successfully')
    },
    onError: error => {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred'
      toast.error('Save failed', {
        description: `Could not save file: ${errorMessage}. Recovery data has been saved.`,
      })
    },
  })
}
