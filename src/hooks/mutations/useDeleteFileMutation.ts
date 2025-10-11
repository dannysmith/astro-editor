// src/hooks/mutations/useDeleteFileMutation.ts

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { remove } from '@tauri-apps/plugin-fs'
import { queryKeys } from '@/lib/query-keys'
import { toast } from '@/lib/toast'
import { useProjectStore } from '@/store/projectStore'

interface DeleteFilePayload {
  filePath: string
  projectPath: string
  collectionName: string
}

const deleteFile = async (payload: DeleteFilePayload) => {
  // Using the Tauri fs plugin's remove function
  await remove(payload.filePath)
}

export const useDeleteFileMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteFile,
    onSuccess: (_, variables) => {
      const { currentSubdirectory } = useProjectStore.getState()

      // Invalidate current directory view to remove the deleted file
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

      // Remove the file content from cache
      queryClient.removeQueries({
        queryKey: queryKeys.fileContent(
          variables.projectPath,
          variables.filePath
        ),
      })

      toast.success('File deleted successfully')
    },
    onError: error => {
      toast.error('Failed to delete file', {
        description:
          error instanceof Error ? error.message : 'Unknown error occurred',
      })
    },
  })
}
