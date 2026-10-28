import React from 'react'
import { error as logError } from '@tauri-apps/plugin-log'
import { commands } from '@/lib/bindings'
import { slugFromTitle } from '@/lib/slug'

interface CopyAsSlugLinkProps {
  text: string
}

/**
 * A tiny link rendered below the title field that copies the field's current
 * contents to the clipboard as a URL slug. Renders nothing when the resulting
 * slug would be empty.
 */
export const CopyAsSlugLink: React.FC<CopyAsSlugLinkProps> = ({ text }) => {
  const slug = slugFromTitle(text)
  if (!slug) return null

  const handleClick = () => {
    void (async () => {
      try {
        const result = await commands.copyTextToClipboard(slug)
        if (result.status === 'error') {
          throw new Error(result.error)
        }
      } catch (error) {
        void logError(`Failed to copy slug: ${String(error)}`)
      }
    })()
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-fit text-xs text-muted-foreground hover:text-foreground"
    >
      Copy as slug
    </button>
  )
}
