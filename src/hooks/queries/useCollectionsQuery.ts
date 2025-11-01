// src/hooks/queries/useCollectionsQuery.ts

import { useQuery } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import { queryKeys } from '@/lib/query-keys'
import type { Collection } from '@/types'
import { getEffectiveContentDirectory } from '@/lib/project-registry'
import { ASTRO_PATHS } from '@/lib/constants'
import { ProjectSettings } from '@/lib/project-registry/types'

// This is our actual data-fetching function. It's just a wrapper around invoke.
const fetchCollections = async (
  projectPath: string,
  contentDirectory: string
): Promise<Collection[]> => {
  if (!projectPath) {
    // TanStack Query handles errors, so we can throw
    throw new Error('Project path is required to fetch collections.')
  }

  if (contentDirectory !== ASTRO_PATHS.CONTENT_DIR) {
    return invoke('scan_project_with_content_dir', {
      projectPath,
      contentDirectory,
    })
  } else {
    return invoke('scan_project', { projectPath })
  }
}

export const useCollectionsQuery = (
  projectPath: string | null,
  projectSettings?: ProjectSettings | null
) => {
  // Get effective content directory using centralized path resolution
  const contentDirectory = getEffectiveContentDirectory(projectSettings)

  return useQuery({
    // The queryKey uniquely identifies this query.
    // If projectPath changes, TanStack Query will automatically refetch.
    queryKey: queryKeys.collections(projectPath || ''),

    // The queryFn is the function that fetches the data.
    // TanStack Query automatically provides the context, including the queryKey.
    queryFn: () => fetchCollections(projectPath!, contentDirectory),

    // We only want to run this query if a projectPath is available.
    enabled: !!projectPath,
  })
}
