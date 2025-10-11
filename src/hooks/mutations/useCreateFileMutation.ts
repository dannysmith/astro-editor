// src/hooks/mutations/useCreateFileMutation.ts

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
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

const createFile = (payload: CreateFilePayload) => {
  return invoke('create_file', {
    directory: payload.directory,
    filename: payload.filename,
    content: payload.content,
    projectRoot: payload.projectPath,
  })
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
