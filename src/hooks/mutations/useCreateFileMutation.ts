// src/hooks/mutations/useCreateFileMutation.ts

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { commands } from '@/lib/bindings'
import { queryKeys } from '@/lib/query-keys'
import { toast } from '@/lib/toast'
import { useProjectStore } from '@/store/projectStore'

interface CreateFilePayload {
  directory: string
  filename: string
  content: string
  projectPath: string
  collectionName: string
}

const createFile = async (payload: CreateFilePayload) => {
  const result = await commands.createFile(
    payload.directory,
    payload.filename,
    payload.content,
    payload.projectPath
  )
  if (result.status === 'error') {
    throw new Error(result.error)
  }
  return result.data
}

export const useCreateFileMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createFile,
    onSuccess: (_, variables) => {
      const { currentSubdirectory } = useProjectStore.getState()

      // Invalidate current directory view to show the new file
      void queryClient.invalidateQueries({
        queryKey: queryKeys.directoryContents(
          variables.projectPath,
          variables.collectionName,
          currentSubdirectory || 'root'
        ),
      })

      // Also invalidate collections to refresh file counts
      void queryClient.invalidateQueries({
        queryKey: queryKeys.collections(variables.projectPath),
      })

      toast.success('New file created successfully')
    },
    onError: error => {
      toast.error('Failed to create new file', {
        description:
          error instanceof Error ? error.message : 'Unknown error occurred',
      })
    },
  })
}
