import React, { useState, useEffect, useRef } from 'react'
import { Badge } from '../ui/badge'
import { cn } from '@/lib/utils'
import { getPublishedDate, getTitle } from '../../lib/files/sorting'
import type { FileEntry } from '@/types'

type FrontmatterMappings = {
  publishedDate: string | string[]
  title: string
  description: string
  draft: string
}

export function formatDate(dateValue: unknown): string {
  if (!dateValue) return ''

  try {
    const date = new Date(dateValue as string | number | Date)
    if (isNaN(date.getTime())) return ''
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return ''
  }
}

interface FileItemProps {
  file: FileEntry
  isSelected: boolean
  frontmatterMappings: FrontmatterMappings
  onFileClick: (file: FileEntry) => void
  onContextMenu: (event: React.MouseEvent, file: FileEntry) => void
  onRenameSubmit: (file: FileEntry, newName: string) => Promise<void>
  isRenaming: boolean
  onCancelRename: () => void
}

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
  const inputRef = useRef<HTMLInputElement | null>(null)
  const renameInitializedRef = useRef(false)
  const previousIsRenamingRef = useRef(isRenaming)

  // Derived state (NO store subscriptions)
  // Draft detection uses only the user-configured field (or 'draft' default)
  const isFileDraft = file.frontmatter?.[frontmatterMappings.draft] === true
  const isMdx = file.extension === 'mdx'
  const title = getTitle(file, frontmatterMappings.title)
  const publishedDate = getPublishedDate(
    file.frontmatter || {},
    frontmatterMappings.publishedDate
  )

  // Compute the full name for rename
  const fullName = file.extension ? `${file.name}.${file.extension}` : file.name

  // Initialize rename value state
  const [renameValue, setRenameValue] = useState(fullName)

  // Reset rename value when entering rename mode (only on transition)
  useEffect(() => {
    if (isRenaming && !previousIsRenamingRef.current) {
      // Just transitioned into rename mode - reset the value
      // Safe to setState here: guarded condition ensures this only runs on the
      // false->true transition, preventing cascading renders. This is a standard
      // React pattern for synchronizing derived state on mode transitions.
      setRenameValue(fullName)
      renameInitializedRef.current = false
    }
    previousIsRenamingRef.current = isRenaming
  }, [isRenaming, fullName])

  // Focus and select filename without extension
  useEffect(() => {
    if (isRenaming && !renameInitializedRef.current) {
      renameInitializedRef.current = true
      const timeoutId = setTimeout(() => {
        const input = inputRef.current
        if (input && renameValue) {
          input.focus()
          const lastDotIndex = renameValue.lastIndexOf('.')
          if (lastDotIndex > 0) {
            input.setSelectionRange(0, lastDotIndex)
          } else {
            input.select()
          }
        }
      }, 10)
      return () => clearTimeout(timeoutId)
    }
  }, [isRenaming, renameValue])

  const handleRenameKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      void onRenameSubmit(file, renameValue)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onCancelRename()
    }
  }

  const handleRenameBlur = () => {
    void onRenameSubmit(file, renameValue)
  }

  return (
    <button
      onClick={() => onFileClick(file)}
      onContextMenu={e => void onContextMenu(e, file)}
      className={cn(
        'w-full text-left p-3 rounded-md transition-colors',
        isSelected && 'bg-primary/15 hover:bg-primary/20',
        !isSelected && 'hover:bg-accent'
      )}
    >
      <div className="flex w-full items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm leading-tight font-medium text-foreground">
            {title}
          </div>
          {publishedDate && (
            <div className="mt-1 text-xs text-muted-foreground">
              {formatDate(publishedDate)}
            </div>
          )}
          <div className="mt-1 font-mono text-xs text-muted-foreground">
            {isRenaming ? (
              <input
                ref={inputRef}
                type="text"
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onKeyDown={handleRenameKeyDown}
                onBlur={handleRenameBlur}
                className="w-full rounded border border-border bg-background px-1 py-0.5 font-mono text-xs text-foreground"
                autoFocus
                onClick={e => e.stopPropagation()}
              />
            ) : file.extension ? (
              `${file.name}.${file.extension}`
            ) : (
              file.name
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1">
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
      </div>
    </button>
  )
}
