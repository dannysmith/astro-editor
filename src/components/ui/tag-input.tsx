import * as React from 'react'
import { Autocomplete } from '@base-ui/react'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  existingSpelling,
  matchSuggestions,
  type TagSuggestion,
} from '@/lib/tag-suggestions'
import { Badge } from './badge'
import { ComboboxContent, ComboboxList } from './combobox'

export interface Tag {
  id: string
  text: string
}

export interface TagInputProps extends Omit<
  React.ComponentProps<'div'>,
  'onChange' | 'ref'
> {
  tags: Tag[]
  /** Id for the text input, for a label's htmlFor */
  inputId?: string
  onTagsChange: (tags: Tag[]) => void
  placeholder?: string
  maxTags?: number
  allowDuplicates?: boolean
  disabled?: boolean
  /**
   * Values to suggest, most used first. When given, the input lists the ones
   * matching what's typed (↓ lists them on an empty input), and a value typed
   * in another case is added in its suggested spelling.
   */
  suggestions?: TagSuggestion[]
}

function TagInput({
  className,
  tags,
  inputId,
  onTagsChange,
  placeholder = 'Add a tag...',
  maxTags,
  allowDuplicates = false,
  disabled = false,
  suggestions,
  ...props
}: TagInputProps) {
  const [inputValue, setInputValue] = React.useState('')
  const [suggestionsOpen, setSuggestionsOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  // The suggestion the arrow keys or pointer are on, which Enter adds instead
  // of what's typed
  const highlighted = React.useRef<TagSuggestion | undefined>(undefined)

  const matches = suggestions
    ? matchSuggestions(
        suggestions,
        inputValue,
        tags.map(tag => tag.text)
      )
    : []
  // Open but empty would show an empty popup, and Escape would only close it
  const showSuggestions = suggestionsOpen && matches.length > 0

  const addTag = (value: string) => {
    const trimmedValue = value.trim()
    if (!trimmedValue) return
    const text = suggestions
      ? existingSpelling(suggestions, trimmedValue)
      : trimmedValue

    // Check for duplicates if not allowed
    if (!allowDuplicates && tags.some(tag => tag.text === text)) {
      setInputValue('')
      return
    }

    // Check max tags limit
    if (maxTags && tags.length >= maxTags) {
      setInputValue('')
      return
    }

    const newTag: Tag = {
      id: crypto.randomUUID(),
      text,
    }

    onTagsChange([...tags, newTag])
    setInputValue('')
  }

  const removeTag = (tagId: string) => {
    onTagsChange(tags.filter(tag => tag.id !== tagId))
  }

  // Runs before the suggestions' own key handling, which adds a highlighted
  // suggestion on Enter and closes the list on Escape
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return

    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault()
      if (showSuggestions && highlighted.current) return
      addTag(inputValue)
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      e.preventDefault()
      const lastTag = tags[tags.length - 1]
      if (lastTag) {
        removeTag(lastTag.id)
      }
    } else if (e.key === 'Escape' && !showSuggestions) {
      setInputValue('')
      inputRef.current?.blur()
    }
  }

  const handleContainerClick = () => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus()
    }
  }

  const inputProps = {
    id: inputId,
    ref: inputRef,
    onKeyDown: handleKeyDown,
    placeholder: tags.length === 0 ? placeholder : '',
    disabled,
    className: cn(
      'w-0 flex-1 border-0 bg-transparent text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed',
      // Room for the placeholder, or to start typing beside the tags
      tags.length === 0 ? 'min-w-[min(120px,100%)]' : 'min-w-12'
    ),
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'border-input placeholder:text-muted-foreground focus-within:border-ring focus-within:ring-ring/50 flex min-h-9 w-full rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] focus-within:ring-[3px] md:text-sm',
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
      onClick={handleContainerClick}
      {...props}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1 py-1">
        {tags.map(tag => (
          <Badge
            key={tag.id}
            variant="secondary"
            title={tag.text}
            className="max-w-full px-2 py-0.5 text-xs has-focus-visible:border-ring has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50"
          >
            <span className="truncate">{tag.text}</span>
            {!disabled && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  removeTag(tag.id)
                }}
                className="ml-1 shrink-0 rounded-sm p-0.5 transition-colors outline-none hover:bg-destructive/20"
                aria-label={`Remove ${tag.text} tag`}
              >
                <X className="size-3" />
              </button>
            )}
          </Badge>
        ))}
        {suggestions ? (
          // The list is filtered here (`mode="none"`), so it can leave out
          // the tags already added
          <Autocomplete.Root
            items={matches}
            mode="none"
            value={inputValue}
            onValueChange={(value, { reason }) => {
              if (reason === 'item-press') addTag(value)
              else setInputValue(value)
            }}
            open={showSuggestions}
            onOpenChange={setSuggestionsOpen}
            onItemHighlighted={suggestion => {
              highlighted.current = suggestion
            }}
            itemToStringValue={suggestion => suggestion.value}
          >
            <Autocomplete.Input {...inputProps} />
            <ComboboxContent
              anchor={containerRef}
              collisionBoundary={document.documentElement}
            >
              <ComboboxList>
                {(suggestion: TagSuggestion) => (
                  <Autocomplete.Item
                    key={suggestion.value}
                    value={suggestion}
                    className="flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                  >
                    <span className="truncate">{suggestion.value}</span>
                    <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                      {suggestion.count}
                    </span>
                  </Autocomplete.Item>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Autocomplete.Root>
        ) : (
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            {...inputProps}
          />
        )}
      </div>
    </div>
  )
}

export { TagInput }
