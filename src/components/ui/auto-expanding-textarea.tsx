import * as React from 'react'
import { cn } from '@/lib/utils'
import TextareaAutosize from 'react-textarea-autosize'

export interface AutoExpandingTextareaProps extends Omit<
  React.ComponentProps<'textarea'>,
  'style'
> {
  minRows?: number
  maxRows?: number
}

const AutoExpandingTextarea = React.forwardRef<
  HTMLTextAreaElement,
  AutoExpandingTextareaProps
>(({ className, minRows = 2, maxRows, ...props }, ref) => {
  return (
    <TextareaAutosize
      ref={ref}
      minRows={minRows}
      maxRows={maxRows}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck="false"
      className={cn(
        // Base styles from shadcn textarea
        'border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex w-full rounded-md border bg-transparent px-3 py-2 text-gray-900 dark:text-white shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
        // Remove resize handle since it's auto-sizing
        'resize-none',
        // Default text size, allow className to override
        'text-base md:text-sm',
        // Custom className comes last to override defaults
        className
      )}
      {...props}
    />
  )
})

AutoExpandingTextarea.displayName = 'AutoExpandingTextarea'

export { AutoExpandingTextarea }
