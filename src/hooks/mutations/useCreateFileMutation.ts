// src/hooks/mutations/useCreateFileMutation.ts

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { commands } from '@/lib/bindings'
import { isFileListing } from '@/lib/query-keys'
import { toast } from '@/lib/toast'
import type { FrontmatterSchema, JsonValue, MarkdownContent } from '@/types'

export interface CreateFilePayload {
  directory: string
  filename: string
  /** Written by Rust as YAML, in schema order unless there's a template */
  frontmatter: Record<string, JsonValue>
  /** The template the file starts from, split as `parseMarkdownContent` splits it */
  template: Pick<
    MarkdownContent,
    'raw_frontmatter' | 'imports' | 'content'
  > | null
  schema: FrontmatterSchema
  projectPath: string
}

const createFile = async (payload: CreateFilePayload) => {
  const { template } = payload
  const result = await commands.createFile(
    payload.directory,
    payload.filename,
    payload.frontmatter,
    template?.raw_frontmatter ?? '',
    template?.content ?? '',
    template?.imports ?? '',
    payload.schema,
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
