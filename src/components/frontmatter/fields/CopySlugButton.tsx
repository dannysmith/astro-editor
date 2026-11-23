import React from 'react'
import { error as logError } from '@tauri-apps/plugin-log'
import { Check, Copy } from 'lucide-react'
import { commands } from '@/lib/bindings'
import { shortSlugFromTitle } from '@/lib/slug'
import { Button } from '../../ui/button'

const COPIED_MS = 1500

/**
 * An icon button floating in the title field that copies its contents to the
 * clipboard as a URL slug. Renders nothing when the slug would be empty.
 */
export const CopySlugButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), COPIED_MS)
    return () => clearTimeout(timer)
  }, [copied])

  const slug = shortSlugFromTitle(text)
  if (!slug) return null

  const handleClick = () => {
    void commands.copyTextToClipboard(slug).then(result => {
      if (result.status === 'error') {
        void logError(`Failed to copy slug: ${result.error}`)
      } else {
        setCopied(true)
      }
    })
  }

  const Icon = copied ? Check : Copy
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleClick}
      title={copied ? 'Copied' : `Copy as slug: ${slug}`}
      aria-label="Copy as slug"
      className="absolute top-1.5 right-1.5 size-6 p-0 text-icon [&_svg]:scale-100 [&_svg]:transform-gpu"
    >
      <Icon className="size-3.5" />
    </Button>
  )
}
