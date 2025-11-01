import React, { useState, useEffect, useRef } from 'react'
import { Badge } from '../ui/badge'
import { cn } from '@/lib/utils'
import type { FileEntry } from '@/types'

type FrontmatterMappings = {
  publishedDate: string | string[]
  title: string
  description: string
  draft: string
}

// Helper functions - exported for reuse
export function getTitle(file: FileEntry, titleField: string): string {
  if (
    file.frontmatter?.[titleField] &&
    typeof file.frontmatter[titleField] === 'string'
  ) {
    return file.frontmatter[titleField]
  }

  const filename = file.name || file.path.split('/').pop() || 'Untitled'
  return filename.replace(/\.(md|mdx)$/, '')
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

export function getPublishedDate(
  frontmatter: Record<string, unknown>,
  publishedDateField: string | string[]
): Date | null {
  const dateFields = Array.isArray(publishedDateField)
    ? publishedDateField
    : [publishedDateField]

  for (const field of dateFields) {
    const value = frontmatter[field]
    if (value) {
      const date = new Date(value as string)
      if (!isNaN(date.getTime())) {
        return date
      }
    }
  }
  return null
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
  const [renameValue, setRenameValue] = useState('')
  const renameInitializedRef = useRef(false)

  // Derived state (NO store subscriptions)
  const isFileDraft =
    file.isDraft || file.frontmatter?.[frontmatterMappings.draft] === true
  const isMdx = file.extension === 'mdx'
  const title = getTitle(file, frontmatterMappings.title)
  const publishedDate = getPublishedDate(
    file.frontmatter || {},
    frontmatterMappings.publishedDate
  )

  // Initialize rename value when entering rename mode
  useEffect(() => {
    if (isRenaming) {
      const fullName = file.extension
        ? `${file.name}.${file.extension}`
        : file.name
      setRenameValue(fullName || '')
      renameInitializedRef.current = false
    }
  }, [isRenaming, file.name, file.extension])

  // Focus and select filename without extension
  useEffect(() => {
    if (isRenaming && !renameInitializedRef.current) {
      renameInitializedRef.current = true
      const timeoutId = setTimeout(() => {
        const input = document.querySelector(
          'input[type="text"]'
        ) as HTMLInputElement
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
      <div className="flex items-start justify-between w-full gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm leading-tight truncate text-foreground">
            {title}
          </div>
          {publishedDate && (
            <div className="text-xs text-muted-foreground mt-1">
              {formatDate(publishedDate)}
            </div>
          )}
          <div className="text-xs font-mono text-muted-foreground mt-1">
            {isRenaming ? (
              <input
                type="text"
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onKeyDown={handleRenameKeyDown}
                onBlur={handleRenameBlur}
                className="bg-background border border-border rounded px-1 py-0.5 text-xs font-mono w-full text-foreground"
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
            <Badge variant="destructive" className="text-xs px-1 py-0">
              Draft
            </Badge>
          )}
          {isMdx && (
            <Badge variant="outline" className="text-xs px-1 py-0">
              MDX
            </Badge>
          )}
        </div>
      </div>
    </button>
  )
}
