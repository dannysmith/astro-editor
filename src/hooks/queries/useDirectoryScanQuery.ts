// src/hooks/queries/useDirectoryScanQuery.ts

import { useQuery } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import { queryKeys } from '@/lib/query-keys'
import { DirectoryScanResult } from '@/store'

const fetchDirectoryContents = async (
  directoryPath: string,
  collectionName: string,
  collectionRoot: string
): Promise<DirectoryScanResult> => {
  if (!directoryPath || !collectionName || !collectionRoot) {
    throw new Error(
      'Directory path, collection name, and collection root are required.'
    )
  }
  return invoke('scan_directory', {
    directoryPath,
    collectionName,
    collectionRoot,
  })
}

export const useDirectoryScanQuery = (
  projectPath: string | null,
  collectionName: string | null,
  collectionPath: string | null,
  subdirectory: string | null // Relative path from collection root
) => {
  return useQuery({
    queryKey: queryKeys.directoryContents(
      projectPath || '',
      collectionName || '',
      subdirectory || 'root'
    ),
    queryFn: () => {
      const fullPath = subdirectory
        ? `${collectionPath}/${subdirectory}`
        : collectionPath

      return fetchDirectoryContents(fullPath!, collectionName!, collectionPath!)
    },
    enabled: !!projectPath && !!collectionName && !!collectionPath,
  })
}
