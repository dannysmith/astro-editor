// src/hooks/queries/useCollectionFilesQuery.ts

import { useQuery } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import { queryKeys } from '@/lib/query-keys'
import type { FileEntry } from '@/types'

const fetchCollectionFiles = async (
  collectionPath: string
): Promise<FileEntry[]> => {
  if (!collectionPath) {
    throw new Error('Collection path is required to fetch files.')
  }
  return invoke('scan_collection_files', {
    collectionPath,
  })
}

export const useCollectionFilesQuery = (
  projectPath: string | null,
  collectionName: string | null,
  collectionPath: string | null
) => {
  return useQuery({
    queryKey: queryKeys.collectionFiles(
      projectPath || '',
      collectionName || ''
    ),
    queryFn: () => fetchCollectionFiles(collectionPath!),
    enabled: !!projectPath && !!collectionName && !!collectionPath,
  })
}
