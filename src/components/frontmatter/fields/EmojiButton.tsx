import React from 'react'
import { SmilePlus } from 'lucide-react'
import { commands } from '@/lib/bindings'
import { Button } from '../../ui/button'

/**
 * An icon button floating in a text field that opens the system emoji
 * palette. It selects the field's text first, so the chosen emoji replaces
 * it. Shown in fields named `emoji` on macOS (see `showsEmojiButton`).
 */
export const EmojiButton: React.FC<{ inputId: string }> = ({ inputId }) => {
  const handleClick = () => {
    const input = document.getElementById(inputId)
    if (
      input instanceof HTMLInputElement ||
      input instanceof HTMLTextAreaElement
    ) {
      input.focus()
      input.select()
    }
    void commands.openEmojiPalette()
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleClick}
      title="Choose an emoji"
      aria-label="Choose an emoji"
      className="absolute top-1.5 right-1.5 size-6 p-0 text-icon"
    >
      <SmilePlus className="size-3.5" />
    </Button>
  )
}
