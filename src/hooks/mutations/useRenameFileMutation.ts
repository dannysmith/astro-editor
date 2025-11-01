// src/hooks/mutations/useRenameFileMutation.ts

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import { queryKeys } from '@/lib/query-keys'
import { toast } from '@/lib/toast'
import { useProjectStore } from '@/store/projectStore'

interface RenameFilePayload {
  oldPath: string
  oldFileId: string // File ID for cache invalidation
  newPath: string
  projectPath: string
  collectionName: string
}

const renameFile = (payload: RenameFilePayload) => {
  return invoke('rename_file', {
    oldPath: payload.oldPath,
    newPath: payload.newPath,
    projectRoot: payload.projectPath,
  })
}

export const useRenameFileMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: renameFile,
    onSuccess: (_, variables) => {
      const { currentSubdirectory } = useProjectStore.getState()

      // Invalidate current directory view to show the renamed file
      void queryClient.invalidateQueries({
        queryKey: queryKeys.directoryContents(
          variables.projectPath,
          variables.collectionName,
          currentSubdirectory || 'root'
        ),
      })

      // Invalidate the old file content cache
      void queryClient.invalidateQueries({
        queryKey: queryKeys.fileContent(
          variables.projectPath,
          variables.oldFileId
        ),
      })

      toast.success('File renamed successfully')
    },
    onError: error => {
      toast.error('Failed to rename file', {
        description:
          error instanceof Error ? error.message : 'Unknown error occurred',
      })
    },
  })
}
