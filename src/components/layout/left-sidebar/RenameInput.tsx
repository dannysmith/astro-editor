import React, { useEffect, useRef, useState } from 'react'

interface RenameInputProps {
  /** The file's full name, which the input starts with */
  fileName: string
  onSubmit: (newName: string) => void
  onCancel: () => void
}

/**
 * The input for renaming a file in the list, mounted only while renaming. It
 * starts with the name selected, up to the extension.
 */
export const RenameInput: React.FC<RenameInputProps> = ({
  fileName,
  onSubmit,
  onCancel,
}) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState(fileName)

  // A moment later, since it's opened from a native menu that's still closing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const input = inputRef.current
      if (!input) return
      input.focus()
      const lastDotIndex = fileName.lastIndexOf('.')
      if (lastDotIndex > 0) {
        input.setSelectionRange(0, lastDotIndex)
      } else {
        input.select()
      }
    }, 10)
    return () => clearTimeout(timeoutId)
  }, [fileName])

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      onSubmit(value)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onCancel()
    }
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={e => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => onSubmit(value)}
      className="w-full min-w-0 rounded border border-border bg-background px-1 py-0.5 font-mono text-xs text-foreground"
      autoFocus
      onClick={e => e.stopPropagation()}
    />
  )
}
