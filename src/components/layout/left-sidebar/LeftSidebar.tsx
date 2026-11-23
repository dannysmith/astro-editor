import React from 'react'
import { useProjectStore } from '../../../store/projectStore'
import { useUIStore } from '../../../store/uiStore'
import { useProjectScanQuery } from '../../../hooks/queries/useCollectionsQuery'
import { showProjectSettings } from '../../../lib/project-settings/actions'
import { ProjectIcon } from '../../project-list'
import { Button } from '../../ui/button'
import { CollectionFiles } from './CollectionFiles'
import { CollectionList } from './CollectionList'
import { FilterBar } from './FilterBar'
import { CollectionHeader, ProjectHeader } from './SidebarHeader'

/**
 * The left sidebar: the project's collections, or the files in the selected
 * one. Its parts read the stores themselves, and each fits any width the panel
 * can be dragged to.
 */
export const LeftSidebar: React.FC = () => {
  const selectedCollection = useProjectStore(state => state.selectedCollection)
  const projectPath = useProjectStore(state => state.projectPath)
  const filterBarExpanded = useUIStore(state =>
    selectedCollection
      ? state.getCollectionViewState(selectedCollection).filterBarExpanded
      : false
  )

  return (
    <div className="flex h-full min-w-0 flex-col border-r bg-background">
      {selectedCollection ? (
        <CollectionHeader collectionName={selectedCollection} />
      ) : (
        <ProjectHeader />
      )}

      {selectedCollection && filterBarExpanded && (
        <FilterBar collectionName={selectedCollection} />
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {selectedCollection ? (
          <CollectionFiles collectionName={selectedCollection} />
        ) : (
          <CollectionList />
        )}
      </div>

      {!selectedCollection && projectPath && (
        <ProjectSettingsFooter projectPath={projectPath} />
      )}
    </div>
  )
}

/** A plainer way into Project Settings than the header icon */
function ProjectSettingsFooter({ projectPath }: { projectPath: string }) {
  const { data: scan } = useProjectScanQuery(projectPath)
  return (
    <div className="border-t p-2">
      <Button
        onClick={() => showProjectSettings()}
        variant="ghost"
        size="sm"
        className="w-full justify-start gap-2 text-muted-foreground"
      >
        <ProjectIcon
          path={projectPath}
          favicon={scan?.favicon ?? null}
          className="size-4 shrink-0"
        />
        <span className="truncate">Project Settings</span>
      </Button>
    </div>
  )
}
