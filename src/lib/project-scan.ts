/**
 * The open project's collections and resolved settings, as Rust works them out
 * (`scan_project`). Hooks read them through `useProjectScanQuery`; code outside
 * React reads the same query cache here.
 *
 * See `docs/developer/app-data.md`.
 */

import { commands, type Collection, type ProjectScan } from '@/lib/bindings'
import { queryClient } from './query-client'
import { queryKeys } from './query-keys'
import { useProjectStore } from '../store/projectStore'
import type { FieldMappings } from './files/sorting'

export async function fetchProjectScan(
  projectPath: string
): Promise<ProjectScan> {
  const result = await commands.scanProject(projectPath)
  if (result.status === 'error') {
    throw new Error(result.error)
  }
  return result.data
}

/** Whether a collection belongs in the sidebar: editable content in a folder AE can use */
export function isBrowsable(collection: Collection): boolean {
  return collection.kind !== 'data' && collection.folderStatus === 'ok'
}

/** The open project's scan, if it has loaded */
export function getProjectScan(): ProjectScan | undefined {
  const { projectPath } = useProjectStore.getState()
  if (!projectPath) return undefined
  return queryClient.getQueryData<ProjectScan>(
    queryKeys.collections(projectPath)
  )
}

/** One of the open project's collections, if the scan has loaded */
export function getCollection(
  name: string | undefined
): Collection | undefined {
  if (!name) return undefined
  return getProjectScan()?.collections.find(c => c.name === name)
}

/**
 * Where a collection's images are copied to, and whether paths to them are
 * written relative to the file (Astro's convention) or from the project root
 */
export function assetSettings(collectionName: string | undefined): {
  assetsDirectory: string
  useRelativePaths: boolean
} {
  const settings = getCollection(collectionName)?.settings
  return {
    assetsDirectory: settings?.assetsDirectory.value ?? 'src/assets',
    useRelativePaths: !(settings?.useAbsoluteAssetPaths.value ?? false),
  }
}

/**
 * Whether the component builder imports images picked for a collection's
 * image props: when the project adds imports, and the collection's images
 * don't go in `public/`, whose files Vite serves as they are rather than
 * importing them. Otherwise image props take the name of an image the writer
 * imports.
 */
export function canImportImages(
  addComponentImports: boolean,
  collection: Collection | undefined
): boolean {
  if (!addComponentImports || !collection) return false
  return !/^(\.?\/)?public(\/|$)/.test(
    collection.settings.assetsDirectory.value
  )
}

/** Field names used where no collection applies, or before the scan loads */
export const CONVENTIONAL_FIELD_MAPPINGS: FieldMappings = {
  publishedDate: ['pubDate', 'date', 'publishedDate'],
  title: 'title',
  description: 'description',
  draft: 'draft',
}

/**
 * Which frontmatter fields a collection uses for its title, description,
 * published date and draft status. A field the collection doesn't have is an
 * empty name, which no frontmatter key matches.
 */
export function fieldMappings(
  collection: Collection | undefined
): FieldMappings {
  if (!collection) return CONVENTIONAL_FIELD_MAPPINGS
  const { settings } = collection
  return {
    publishedDate: settings.publishedDateField.value,
    title: settings.titleField.value ?? '',
    description: settings.descriptionField.value ?? '',
    draft: settings.draftField.value ?? '',
  }
}
