// src/hooks/queries/useCollectionsQuery.ts

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { fetchProjectScan, isBrowsable } from '@/lib/project-scan'
import type { ProjectScan } from '@/lib/bindings'

/**
 * Everything Rust found in the project: the content config, every collection
 * (including data collections and ones whose folder is missing) and the
 * resolved settings
 */
export const useProjectScanQuery = (projectPath: string | null) =>
  useQuery({
    queryKey: queryKeys.collections(projectPath || ''),
    queryFn: () => fetchProjectScan(projectPath!),
    enabled: !!projectPath,
  })

const browsableCollections = (scan: ProjectScan) =>
  scan.collections.filter(isBrowsable)

/** The collections the sidebar shows: editable content in folders AE can use */
export const useCollectionsQuery = (projectPath: string | null) =>
  useQuery({
    queryKey: queryKeys.collections(projectPath || ''),
    queryFn: () => fetchProjectScan(projectPath!),
    enabled: !!projectPath,
    select: browsableCollections,
  })
