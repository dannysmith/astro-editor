// src/hooks/queries/useDirectoryScanQuery.ts

import { useQuery } from '@tanstack/react-query'
import { commands, type Collection, type DirectoryScanResult } from '@/types'
import { queryKeys } from '@/lib/query-keys'
import { getCollection } from '@/lib/project-scan'

/**
 * Reads the collection from the latest scan, not the one it was given: a
 * settings change rescans and then refetches, which can happen before
 * components re-render with the new folder and pattern
 */
const fetchDirectoryContents = async (
  collection: Collection,
  subdirectory: string | null,
  projectPath: string
): Promise<DirectoryScanResult> => {
  const current = getCollection(collection.name) ?? collection
  const directoryPath = subdirectory
    ? `${current.path}/${subdirectory}`
    : current.path
  const result = await commands.scanDirectory(
    directoryPath,
    current,
    projectPath
  )
  if (result.status === 'error') {
    throw new Error(result.error)
  }
  return result.data
}

/**
 * One folder of a collection: its subfolders and files, as the collection's
 * pattern and skipped files setting decide
 */
export const useDirectoryScanQuery = (
  projectPath: string | null,
  collection: Collection | undefined,
  subdirectory: string | null // Relative path from the collection folder
) => {
  return useQuery({
    queryKey: queryKeys.directoryContents(
      projectPath || '',
      collection?.name || '',
      subdirectory || 'root'
    ),
    queryFn: () =>
      fetchDirectoryContents(collection!, subdirectory, projectPath!),
    enabled: !!projectPath && !!collection,
  })
}
