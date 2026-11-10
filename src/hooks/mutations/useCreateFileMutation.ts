// src/hooks/mutations/useCreateFileMutation.ts

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { commands } from '@/lib/bindings'
import { isFileListing } from '@/lib/query-keys'
import { toast } from '@/lib/toast'

export interface CreateFilePayload {
  directory: string
  filename: string
  content: string
  projectPath: string
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
      // Show the new file, and count it
      void queryClient.invalidateQueries({
        predicate: ({ queryKey }) =>
          isFileListing(queryKey, variables.projectPath),
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
