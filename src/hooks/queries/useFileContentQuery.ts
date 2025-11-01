// src/hooks/queries/useFileContentQuery.ts

import { useQuery } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import { queryKeys } from '@/lib/query-keys'
import type { MarkdownContent } from '@/types'

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
  return invoke('parse_markdown_content', {
    filePath,
    projectRoot: projectPath,
  })
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
