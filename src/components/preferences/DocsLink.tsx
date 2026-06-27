import React from 'react'
import { openPath } from '@tauri-apps/plugin-opener'
import { cn } from '@/lib/utils'

interface DocsLinkProps {
  href: string
  children: React.ReactNode
  className?: string
}

/**
 * Subtle inline link to the documentation site. Opens in the user's default
 * browser via the opener plugin rather than navigating the webview.
 *
 * Designed to sit inside explainer text (e.g. `FieldDescription`) in the
 * preferences panes.
 */
export const DocsLink: React.FC<DocsLinkProps> = ({
  href,
  children,
  className,
}) => {
  return (
    <a
      href={href}
      onClick={e => {
        e.preventDefault()
        void openPath(href)
      }}
      className={cn(
        'text-muted-foreground underline underline-offset-4 hover:text-primary cursor-pointer',
        className
      )}
    >
      {children}
    </a>
  )
}
