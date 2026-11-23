import React from 'react'
import {
  ArrowLeft,
  ChevronRight,
  FileText,
  Filter,
  FolderOpen,
  SlidersHorizontal,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProjectStore } from '../../../store/projectStore'
import { useUIStore } from '../../../store/uiStore'
import { useProjectScanQuery } from '../../../hooks/queries/useCollectionsQuery'
import { useCollectionView } from '../../../hooks/useCollectionView'
import { showProjectList } from '../../../lib/projects/actions'
import { showProjectSettings } from '../../../lib/project-settings/actions'
import { ProjectIcon } from '../../project-list'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'

/** The sidebar's header bar, with a background for what it's filtering */
const HeaderBar: React.FC<{
  className: string
  children: React.ReactNode
}> = ({ className, children }) => (
  <div className={cn('border-b p-3', className)}>
    <div className="flex items-center gap-2">{children}</div>
  </div>
)

/** The header over the collections list */
export const ProjectHeader: React.FC = () => {
  const projectPath = useProjectStore(state => state.projectPath)

  return (
    <HeaderBar className="bg-muted/30">
      <Button
        onClick={() => showProjectList()}
        variant="ghost"
        size="sm"
        className="size-7 flex-shrink-0 p-0 text-muted-foreground"
        title="Open Project"
      >
        <FolderOpen className="size-4" />
      </Button>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
        Content
      </span>
      {projectPath && <ProjectSettingsButton projectPath={projectPath} />}
    </HeaderBar>
  )
}

/**
 * The header over a collection's files: the way back, where you are, and its
 * filters. The status badges wrap under the name when there's no room beside it.
 */
export const CollectionHeader: React.FC<{ collectionName: string }> = ({
  collectionName,
}) => {
  const currentSubdirectory = useProjectStore(
    state => state.currentSubdirectory
  )
  const { showDraftsOnly, searchActive, sortActive, filterBarExpanded } =
    useCollectionView(collectionName)

  const title = collectionName.charAt(0).toUpperCase() + collectionName.slice(1)
  const breadcrumbSegments = currentSubdirectory
    ? currentSubdirectory.split('/')
    : []
  const showSearchBadge = searchActive && !filterBarExpanded
  const showSortBadge = sortActive && !filterBarExpanded

  // Determine header background class based on composable states
  // Priority: drafts (intentional filter) > search (hides files) > default
  const headerBackground = showDraftsOnly
    ? 'bg-draft-bg'
    : searchActive
      ? 'bg-filter-bg'
      : 'bg-muted/30'

  const goToSubdirectory = (subdirectory: string | null) => {
    useProjectStore.getState().setCurrentSubdirectory(subdirectory)
  }

  return (
    <HeaderBar className={headerBackground}>
      <Button
        onClick={() => useProjectStore.getState().navigateUp()}
        variant="ghost"
        size="sm"
        className={cn(
          'size-7 p-0 flex-shrink-0',
          // Match header background color for hover state
          showDraftsOnly
            ? 'text-draft hover:bg-draft-bg/50'
            : searchActive
              ? 'text-filter hover:bg-filter-bg/50'
              : 'text-muted-foreground hover:bg-muted'
        )}
        title="Back"
      >
        <ArrowLeft className="size-4" />
      </Button>

      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <div className="flex min-w-0 flex-[1_1_4rem] items-center gap-1 text-sm font-medium text-foreground">
          {/* Collection name (always clickable to go to root) */}
          {currentSubdirectory ? (
            <button
              onClick={() => goToSubdirectory(null)}
              className="cursor-pointer truncate hover:underline"
            >
              {title}
            </button>
          ) : (
            <span className="truncate">{title}</span>
          )}

          {/* Breadcrumb segments */}
          {breadcrumbSegments.map((segment, index) => {
            const isLast = index === breadcrumbSegments.length - 1
            const pathUpToSegment = breadcrumbSegments
              .slice(0, index + 1)
              .join('/')

            return (
              <React.Fragment key={pathUpToSegment}>
                <ChevronRight className="size-3 flex-shrink-0 text-muted-foreground" />
                {isLast ? (
                  <span className="truncate text-muted-foreground">
                    {segment}
                  </span>
                ) : (
                  <button
                    onClick={() => goToSubdirectory(pathUpToSegment)}
                    className="cursor-pointer truncate hover:underline"
                  >
                    {segment}
                  </button>
                )}
              </React.Fragment>
            )
          })}
        </div>

        {/* Status indicators - composable badges, at the right beside the
            name and from the left on a line of their own */}
        {(showDraftsOnly || showSearchBadge || showSortBadge) && (
          <div className="flex max-w-full flex-wrap gap-1">
            {showDraftsOnly && (
              <Badge
                variant="outline"
                className="h-4 border-draft px-1.5 py-0 text-[10px] font-normal text-draft opacity-80"
              >
                DRAFTS
              </Badge>
            )}
            {showSearchBadge && (
              <Badge
                variant="outline"
                className="h-4 border-filter px-1.5 py-0 text-[10px] font-normal text-filter opacity-80"
              >
                FILTERED
              </Badge>
            )}
            {showSortBadge && (
              <Badge
                variant="outline"
                className="h-4 px-1.5 py-0 text-[10px] font-normal opacity-60"
              >
                SORTED
              </Badge>
            )}
          </div>
        )}
      </div>

      <Button
        onClick={() => useUIStore.getState().toggleFilterBar(collectionName)}
        variant="ghost"
        size="sm"
        className={cn(
          'size-7 p-0 [&_svg]:transform-gpu [&_svg]:scale-100 flex-shrink-0',
          // Color priority: own active state > header color > expanded/sorted > default
          searchActive
            ? 'text-filter bg-filter-bg hover:bg-filter-bg/80'
            : showDraftsOnly
              ? 'text-draft hover:bg-draft-bg/50'
              : filterBarExpanded || sortActive
                ? 'text-foreground bg-accent hover:bg-accent/80'
                : 'text-muted-foreground hover:bg-muted'
        )}
        title={filterBarExpanded ? 'Hide Filters' : 'Show Filters'}
      >
        <SlidersHorizontal className="size-4" />
      </Button>
      <Button
        onClick={() => useUIStore.getState().toggleDraftFilter(collectionName)}
        variant="ghost"
        size="sm"
        className={cn(
          'size-7 p-0 [&_svg]:transform-gpu [&_svg]:scale-100 flex-shrink-0',
          // Color priority: own active state > header color > default
          showDraftsOnly
            ? 'text-draft bg-draft-bg hover:bg-draft-bg/80'
            : searchActive
              ? 'text-filter hover:bg-filter-bg/50'
              : 'text-muted-foreground hover:bg-muted'
        )}
        title={showDraftsOnly ? 'Show All Files' : 'Show Drafts Only'}
      >
        {showDraftsOnly ? (
          <Filter className="size-4" />
        ) : (
          <FileText className="size-4" />
        )}
      </Button>
    </HeaderBar>
  )
}

/** Opens Project Settings, shown as the project's icon */
function ProjectSettingsButton({ projectPath }: { projectPath: string }) {
  const { data: scan } = useProjectScanQuery(projectPath)
  return (
    <Button
      onClick={() => showProjectSettings()}
      variant="ghost"
      size="sm"
      className="size-7 flex-shrink-0 p-0 [&_svg]:scale-100 [&_svg]:transform-gpu"
      title="Project Settings"
    >
      <ProjectIcon
        path={projectPath}
        favicon={scan?.favicon ?? null}
        className="size-5"
      />
    </Button>
  )
}
