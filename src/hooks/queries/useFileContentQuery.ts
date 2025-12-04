// src/hooks/queries/useFileContentQuery.ts

import { useQuery } from '@tanstack/react-query'
import { commands, type MarkdownContent } from '@/lib/bindings'
import { queryKeys } from '@/lib/query-keys'

const fetchFileContent = async (
  filePath: string,
  projectPath: string
): Promise<MarkdownContent> => {
  if (!filePath) {
    throw new Error('File path is required to fetch content.')
  }
  if (!projectPath) {
    throw new Error('Project path is required to fetch content.')
  }
  // Note: filePath must be absolute path for Rust command
  const result = await commands.parseMarkdownContent(filePath, projectPath)
  if (result.status === 'error') {
    throw new Error(result.error)
  }
  return result.data
}

export const useFileContentQuery = (
  projectPath: string | null,
  fileId: string | null,
  filePath: string | null
) => {
  return useQuery({
    queryKey: queryKeys.fileContent(projectPath || '', fileId || ''),
    queryFn: () => fetchFileContent(filePath!, projectPath!),
    enabled: !!projectPath && !!fileId && !!filePath,
    // Stale time: consider data fresh for 30 seconds
    staleTime: 30 * 1000,
    // Cache time: keep data in cache for 5 minutes after component unmounts
    gcTime: 5 * 60 * 1000,
  })
}
