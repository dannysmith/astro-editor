import * as React from 'react'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge } from './badge'

export interface Tag {
  id: string
  text: string
}

export interface TagInputProps extends Omit<
  React.ComponentProps<'div'>,
  'onChange'
> {
  tags: Tag[]
  /** Id for the text input, for a label's htmlFor */
  inputId?: string
  onTagsChange: (tags: Tag[]) => void
  placeholder?: string
  maxTags?: number
  allowDuplicates?: boolean
  disabled?: boolean
}

const TagInput = React.forwardRef<HTMLDivElement, TagInputProps>(
  (
    {
      className,
      tags,
      inputId,
      onTagsChange,
      placeholder = 'Add a tag...',
      maxTags,
      allowDuplicates = false,
      disabled = false,
      ...props
    },
    ref
  ) => {
    const [inputValue, setInputValue] = React.useState('')
    const inputRef = React.useRef<HTMLInputElement>(null)

    const addTag = (value: string) => {
      const trimmedValue = value.trim()
      if (!trimmedValue) return

      // Check for duplicates if not allowed
      if (!allowDuplicates && tags.some(tag => tag.text === trimmedValue)) {
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
        text: trimmedValue,
      }

      onTagsChange([...tags, newTag])
      setInputValue('')
    }

    const removeTag = (tagId: string) => {
      onTagsChange(tags.filter(tag => tag.id !== tagId))
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return

      if (e.key === 'Enter' && inputValue.trim()) {
        e.preventDefault()
        addTag(inputValue)
      } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
        e.preventDefault()
        const lastTag = tags[tags.length - 1]
        if (lastTag) {
          removeTag(lastTag.id)
        }
      } else if (e.key === 'Escape') {
        setInputValue('')
        inputRef.current?.blur()
      }
    }

    const handleContainerClick = () => {
      if (!disabled && inputRef.current) {
        inputRef.current.focus()
      }
    }

    return (
      <div
        ref={ref}
        className={cn(
          'border-input placeholder:text-muted-foreground focus-within:border-ring focus-within:ring-ring/50 flex min-h-9 w-full rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] focus-within:ring-[3px] md:text-sm',
          disabled && 'cursor-not-allowed opacity-50',
          className
        )}
        onClick={handleContainerClick}
        {...props}
      >
        <div className="flex flex-1 flex-wrap items-center gap-1 py-1">
          {tags.map(tag => (
            <Badge
              key={tag.id}
              variant="secondary"
              className="px-2 py-0.5 text-xs has-focus-visible:border-ring has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50"
            >
              {tag.text}
              {!disabled && (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation()
                    removeTag(tag.id)
                  }}
                  className="ml-1 rounded-sm p-0.5 transition-colors outline-none hover:bg-destructive/20"
                  aria-label={`Remove ${tag.text} tag`}
                >
                  <X className="size-3" />
                </button>
              )}
            </Badge>
          ))}
          <input
            id={inputId}
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={tags.length === 0 ? placeholder : ''}
            disabled={disabled}
            className="min-w-[120px] flex-1 border-0 bg-transparent text-gray-900 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed dark:text-white"
          />
        </div>
      </div>
    )
  }
)

TagInput.displayName = 'TagInput'

export { TagInput }
