import React, { useCallback, useRef, useEffect } from 'react'
import { Search, ArrowUpDown, X, ArrowUp, ArrowDown } from 'lucide-react'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { cn } from '@/lib/utils'
import type { SortOption } from '@/lib/files'

interface FilterBarProps {
  searchQuery: string
  sortMode: string
  sortDirection: 'asc' | 'desc'
  sortOptions: SortOption[]
  onSearchChange: (query: string) => void
  onSortModeChange: (mode: string) => void
  onSortDirectionToggle: () => void
  onClearSearch: () => void
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchQuery,
  sortMode,
  sortDirection,
  sortOptions,
  onSearchChange,
  onSortModeChange,
  onSortDirectionToggle,
  onClearSearch,
}) => {
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus search input when component mounts
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onSearchChange(e.target.value)
    },
    [onSearchChange]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        onClearSearch()
      }
    },
    [onClearSearch]
  )

  const currentSortOption = sortOptions.find(opt => opt.id === sortMode)

  return (
    <div className="flex flex-col gap-2 p-2 border-b bg-muted/20">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search files..."
          value={searchQuery}
          onChange={handleSearchChange}
          onKeyDown={handleKeyDown}
          className="h-7 pl-7 pr-7 text-xs"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSearch}
            className="absolute right-0.5 top-1/2 -translate-y-1/2 size-6 p-0 hover:bg-transparent"
          >
            <X className="size-3 text-muted-foreground" />
          </Button>
        )}
      </div>

      {/* Sort Controls */}
      <div className="flex items-center gap-1.5">
        <ArrowUpDown className="size-3 text-muted-foreground flex-shrink-0" />
        <Select value={sortMode} onValueChange={onSortModeChange}>
          <SelectTrigger size="sm" className="h-6 text-xs flex-1 min-w-0 px-2">
            <SelectValue>{currentSortOption?.label || 'Default'}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map(option => (
              <SelectItem key={option.id} value={option.id} className="text-xs">
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Direction Toggle - only show when not on default sort */}
        {sortMode !== 'default' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSortDirectionToggle}
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
