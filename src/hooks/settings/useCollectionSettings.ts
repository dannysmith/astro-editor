import { useProjectStore } from '../../store/projectStore'
import { useProjectScanQuery } from '../queries/useCollectionsQuery'
import { fieldMappings } from '../../lib/project-scan'

/** One of the open project's collections, with its resolved settings */
export function useCollection(collectionName: string | undefined) {
  const projectPath = useProjectStore(state => state.projectPath)
  const { data: scan } = useProjectScanQuery(projectPath)
  return collectionName
    ? scan?.collections.find(c => c.name === collectionName)
    : undefined
}

/** The open project's resolved project settings */
export function useResolvedProjectSettings() {
  const projectPath = useProjectStore(state => state.projectPath)
  const { data: scan } = useProjectScanQuery(projectPath)
  return scan?.projectSettings
}

/**
 * Which frontmatter fields a collection uses for its title, description,
 * published date and draft status. Conventional names without a collection.
 */
export function useFieldMappings(collectionName: string | undefined) {
  return fieldMappings(useCollection(collectionName))
}
