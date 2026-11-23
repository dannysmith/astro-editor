import React from 'react'
import { Badge } from '../../ui/badge'
import { cn } from '@/lib/utils'
import { getPublishedDate, getTitle } from '../../../lib/files/sorting'
import { formatDisplayDate } from '../../../lib/dates'
import type { FileEntry } from '@/types'
import type { FieldMappings } from '../../../lib/files/sorting'
import { RenameInput } from './RenameInput'

interface FileItemProps {
  file: FileEntry
  isSelected: boolean
  frontmatterMappings: FieldMappings
  onFileClick: (file: FileEntry) => void
  onContextMenu: (event: React.MouseEvent, file: FileEntry) => void
  onRenameSubmit: (file: FileEntry, newName: string) => void
  isRenaming: boolean
  onCancelRename: () => void
}

/**
 * A file in the sidebar's list. With room, its badges stand in a column beside
 * the text. In a narrow row they sit on the date's line, so the title and file
 * name get the full width.
 */
export const FileItem: React.FC<FileItemProps> = ({
  file,
  isSelected,
  frontmatterMappings,
  onFileClick,
  onContextMenu,
  onRenameSubmit,
  isRenaming,
  onCancelRename,
}) => {
  // Derived state (NO store subscriptions)
  // Draft detection uses the collection's draft field
  const isFileDraft = file.frontmatter?.[frontmatterMappings.draft] === true
  const isMdx = file.extension === 'mdx'
  const title = getTitle(file, frontmatterMappings.title)
  const publishedDate = getPublishedDate(
    file.frontmatter || {},
    frontmatterMappings.publishedDate
  )
  const fullName = file.extension ? `${file.name}.${file.extension}` : file.name

  return (
    <button
      onClick={() => onFileClick(file)}
      onContextMenu={e => void onContextMenu(e, file)}
      className={cn(
        '@container w-full text-left p-3 rounded-md transition-colors',
        isSelected && 'bg-primary/15 hover:bg-primary/20',
        !isSelected && 'hover:bg-accent',
        !file.is_entry && 'opacity-60'
      )}
      title={
        file.is_entry
          ? undefined
          : "Not in the collection: its loader's pattern leaves this file out"
      }
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-1 @[12rem]:grid-cols-[minmax(0,1fr)_auto] @[12rem]:gap-x-2">
        <div className="col-span-2 row-start-1 truncate text-sm leading-tight font-medium text-foreground @[12rem]:col-span-1">
          {title}
        </div>
        {publishedDate && (
          <div className="col-start-1 row-start-2 mt-1 text-xs whitespace-nowrap text-muted-foreground">
            {formatDisplayDate(publishedDate)}
          </div>
        )}
        <div className="col-span-2 row-start-3 mt-1 font-mono text-xs [overflow-wrap:anywhere] text-muted-foreground @[12rem]:col-span-1">
          {isRenaming ? (
            <RenameInput
              fileName={fullName}
              onSubmit={newName => onRenameSubmit(file, newName)}
              onCancel={onCancelRename}
            />
          ) : (
            fullName
          )}
        </div>
        {(isFileDraft || isMdx) && (
          <div
            className={cn(
              'row-start-2 mt-1 flex flex-wrap gap-1 @[12rem]:col-start-2 @[12rem]:row-span-3 @[12rem]:row-start-1 @[12rem]:mt-0 @[12rem]:flex-col @[12rem]:flex-nowrap @[12rem]:justify-start @[12rem]:justify-self-end',
              publishedDate
                ? 'col-start-2 justify-end justify-self-end'
                : 'col-start-1'
            )}
          >
            {isFileDraft && (
              <Badge className="border-transparent bg-draft px-1 py-0 text-xs text-background">
                Draft
              </Badge>
            )}
            {isMdx && (
              <Badge variant="outline" className="px-1 py-0 text-xs">
                MDX
              </Badge>
            )}
          </div>
        )}
      </div>
    </button>
  )
}
