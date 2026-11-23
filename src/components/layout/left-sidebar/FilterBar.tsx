import React, { useRef, useEffect } from 'react'
import { Search, ArrowUpDown, X, ArrowUp, ArrowDown } from 'lucide-react'
import { Input } from '../../ui/input'
import { Button } from '../../ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select'
import { cn } from '@/lib/utils'
import { getSortOptionsForCollection, type SortOption } from '@/lib/files'
import { deserializeCompleteSchema } from '../../../lib/schema'
import { useCollection } from '../../../hooks/settings'
import { useCollectionView } from '../../../hooks/useCollectionView'
import { useUIStore } from '../../../store/uiStore'

/**
 * Get a subtle type label for sort options
 */
function getSortTypeLabel(option: SortOption): string | null {
  // Special case for last modified (filesystem metadata)
  if (option.id === 'modified') return 'file data'
  // Map type to display label
  switch (option.type) {
    case 'alpha':
      return 'alpha'
    case 'date':
      return 'date'
    case 'numeric':
      return 'num'
    default:
      return null
  }
}

/** Search and sort for a collection's file list */
export const FilterBar: React.FC<{ collectionName: string }> = ({
  collectionName,
}) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const { searchQuery, sortMode, sortDirection } =
    useCollectionView(collectionName)
  const completeSchema = useCollection(collectionName)?.completeSchema

  // Sort options come from the collection's schema
  const sortOptions = getSortOptionsForCollection(
    completeSchema ? deserializeCompleteSchema(completeSchema) : null
  )

  // Auto-focus search input when component mounts
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const setSearchQuery = (query: string) => {
    useUIStore.getState().setSearchQuery(collectionName, query)
  }

  // Each mode starts the natural way round: dates newest first, everything
  // else A to Z or lowest first
  const handleSortModeChange = (mode: string) => {
    const type = sortOptions.find(option => option.id === mode)?.type
    const direction = type === 'date' || type === 'default' ? 'desc' : 'asc'
    useUIStore.getState().setSortMode(collectionName, mode, direction)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setSearchQuery('')
    }
  }

  const currentSortOption = sortOptions.find(opt => opt.id === sortMode)

  return (
    <div className="flex flex-col gap-2 border-b bg-muted/20 p-2">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search files..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-7 pr-7 pl-7 text-xs"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearchQuery('')}
            className="absolute top-1/2 right-0.5 size-6 -translate-y-1/2 p-0 hover:bg-transparent"
          >
            <X className="size-3 text-muted-foreground" />
          </Button>
        )}
      </div>

      {/* Sort Controls */}
      <div className="flex items-center gap-1.5">
        <ArrowUpDown className="size-3 flex-shrink-0 text-muted-foreground" />
        <Select
          value={sortMode}
          onValueChange={mode => mode && handleSortModeChange(mode)}
        >
          <SelectTrigger size="sm" className="h-6 min-w-0 flex-1 px-2 text-xs">
            <SelectValue>
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate">
                  {currentSortOption?.label || 'Default'}
                </span>
                {currentSortOption && getSortTypeLabel(currentSortOption) && (
                  <span className="shrink-0 text-[10px] font-normal text-muted-foreground/60">
                    {getSortTypeLabel(currentSortOption)}
                  </span>
                )}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map(option => {
              const typeLabel = getSortTypeLabel(option)
              return (
                <SelectItem
                  key={option.id}
                  value={option.id}
                  className="text-xs"
                >
                  <span className="flex w-full items-center justify-between gap-3">
                    <span>{option.label}</span>
                    {typeLabel && (
                      <span className="text-[10px] font-normal text-muted-foreground/60">
                        {typeLabel}
                      </span>
                    )}
                  </span>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>

        {/* Direction Toggle - only show when not on default sort */}
        {sortMode !== 'default' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              useUIStore.getState().toggleSortDirection(collectionName)
            }
            className={cn(
              'size-6 p-0 flex-shrink-0',
              'text-muted-foreground hover:text-foreground'
            )}
            title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
          >
            {sortDirection === 'asc' ? (
              <ArrowUp className="size-3.5" />
            ) : (
              <ArrowDown className="size-3.5" />
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
