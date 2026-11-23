// src/hooks/mutations/useRenameFileMutation.ts

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { commands } from '@/lib/bindings'
import { queryKeys } from '@/lib/query-keys'
import { toast } from '@/lib/toast'
import { useProjectStore } from '@/store/projectStore'
import { useGitPanelStore } from '@/store/gitPanelStore'

interface RenameFilePayload {
  oldPath: string
  newPath: string
  projectPath: string
  collectionName: string
}

const renameFile = async (payload: RenameFilePayload) => {
  const result = await commands.renameFile(
    payload.oldPath,
    payload.newPath,
    payload.projectPath
  )
  if (result.status === 'error') {
    throw new Error(result.error)
  }
  return result.data
}

export const useRenameFileMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: renameFile,
    onSuccess: (_, variables) => {
      const { currentSubdirectory } = useProjectStore.getState()
      useGitPanelStore
        .getState()
        .rememberRename(variables.oldPath, variables.newPath)

      // Invalidate current directory view to show the renamed file
      void queryClient.invalidateQueries({
        queryKey: queryKeys.directoryContents(
          variables.projectPath,
          variables.collectionName,
          currentSubdirectory || 'root'
        ),
      })

      // Nothing is at the old path now, so its cached content can't be used
      queryClient.removeQueries({
        queryKey: queryKeys.fileContent(
          variables.projectPath,
          variables.oldPath
        ),
        exact: true,
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
