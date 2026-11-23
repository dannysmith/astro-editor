import React from 'react'
import { cn } from '@/lib/utils'
import { useProjectStore } from '../../../store/projectStore'
import {
  useCollectionsQuery,
  useProjectScanQuery,
} from '../../../hooks/queries/useCollectionsQuery'
import { useCollectionCountsQuery } from '../../../hooks/queries/useCollectionCountsQuery'
import { showProjectSettings } from '../../../lib/project-settings/actions'
import {
  collectionProblems,
  isUnreadLoader,
  statusLevel,
} from '../../../lib/project-settings/status'
import { StatusIcon, WithCode } from '../../project-settings/Problems'
import { Badge } from '../../ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip'

/** The project's collections, each with its file count and any problems */
export const CollectionList: React.FC = () => {
  const projectPath = useProjectStore(state => state.projectPath)
  const { data: collections = [] } = useCollectionsQuery(projectPath)
  const { data: fileCounts = {} } = useCollectionCountsQuery(
    projectPath,
    collections
  )
  // Collections whose folder is missing or outside the project. They're
  // listed dimmed with their problem, rather than vanishing, and open Project
  // Settings, where the problem can be fixed
  const { data: scan } = useProjectScanQuery(projectPath)
  const unavailable = (scan?.collections ?? []).filter(
    c => c.kind !== 'data' && !isUnreadLoader(c) && c.folderStatus !== 'ok'
  )

  return (
    <div className="p-2">
      {[...collections, ...unavailable].map(collection => {
        const available = collection.folderStatus === 'ok'
        const folder = collection.path.split('/').pop()
        const fileCount = fileCounts[collection.name] ?? 0
        const problems = projectPath
          ? collectionProblems(collection, projectPath)
          : []

        return (
          <button
            key={collection.name}
            onClick={() =>
              available
                ? useProjectStore
                    .getState()
                    .setSelectedCollection(collection.name)
                : showProjectSettings(collection.name)
            }
            className={cn(
              'w-full rounded-md p-3 text-left transition-colors hover:bg-accent',
              !available && 'opacity-60'
            )}
          >
            <div className="flex w-full items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="truncate font-medium text-foreground">
                  {collection.name}
                </span>
                {problems[0] && (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <span className="inline-flex shrink-0">
                          <StatusIcon
                            level={statusLevel(problems)}
                            className="size-3.5"
                          />
                        </span>
                      }
                    />
                    <TooltipContent side="right" className="max-w-64">
                      <WithCode text={problems[0].message} /> See Project
                      Settings.
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              {available && (
                <Badge variant="secondary" className="text-xs">
                  {fileCount} item{fileCount !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            {/* The folder, where it isn't just the collection's name */}
            {folder !== collection.name && (
              <div className="mt-1 truncate font-mono text-xs text-muted-foreground">
                {folder}
              </div>
            )}
          </button>
        )
      })}
      {collections.length === 0 && unavailable.length === 0 && (
        <div className="p-4 text-center text-sm text-muted-foreground">
          {projectPath
            ? 'No collections found.'
            : 'Open an Astro project to get started.'}
        </div>
      )}
    </div>
  )
}
