import { useState } from 'react'

/** Every colour token in App.css, grouped. Add new tokens here too. */
const GROUPS: { title: string; tokens: string[] }[] = [
  {
    title: 'Chrome',
    tokens: [
      'background',
      'foreground',
      'heading',
      'card',
      'card-foreground',
      'popover',
      'popover-foreground',
      'primary',
      'primary-foreground',
      'secondary',
      'secondary-foreground',
      'muted',
      'muted-foreground',
      'accent',
      'accent-foreground',
      'destructive',
      'destructive-foreground',
      'border',
      'input',
      'input-foreground',
      'ring',
      'titlebar',
      'icon',
      'active',
      'overlay',
      'image-preview',
      'image-preview-border',
      'image-preview-shadow',
      'image-preview-spinner',
      'framework-astro',
      'framework-react',
      'framework-vue',
      'framework-svelte',
    ],
  },
  {
    title: 'Preferences sidebar',
    tokens: [
      'sidebar',
      'sidebar-foreground',
      'sidebar-primary',
      'sidebar-primary-foreground',
      'sidebar-accent',
      'sidebar-accent-foreground',
      'sidebar-border',
      'sidebar-ring',
    ],
  },
  {
    title: 'Status',
    tokens: [
      'draft',
      'draft-bg',
      'filter',
      'filter-bg',
      'required',
      'warning',
      'warning-bg',
    ],
  },
  {
    title: 'Window controls',
    tokens: [
      'window-control-hover',
      'window-close',
      'window-close-foreground',
      'traffic-light-close',
      'traffic-light-close-border',
      'traffic-light-close-hover',
      'traffic-light-minimize',
      'traffic-light-minimize-border',
      'traffic-light-minimize-hover',
      'traffic-light-maximize',
      'traffic-light-maximize-border',
      'traffic-light-maximize-hover',
      'traffic-light-unfocused',
      'traffic-light-unfocused-border',
      'traffic-light-unfocused-hover',
      'traffic-light-shadow',
      'traffic-light-symbol',
    ],
  },
  {
    title: 'Editor',
    tokens: [
      'editor-color-background',
      'editor-color-text',
      'editor-color-heading',
      'editor-color-mdtag',
      'editor-color-underline',
      'editor-color-carat',
      'editor-color-selectedtext-background',
      'editor-color-codeblock-background',
      'editor-color-snippet-border',
      'editor-color-snippet-border-active',
      'editor-color-brown',
      'editor-color-red',
      'editor-color-pink',
      'editor-color-blue',
      'editor-color-green',
      'editor-color-highlight-background',
      'editor-color-highlight-underline',
      'editor-color-highlight-text',
    ],
  },
]

/** Colour tokens declared on :root that aren't in GROUPS. */
function findUnlisted(): string[] {
  const listed = new Set(GROUPS.flatMap(group => group.tokens))
  const found = new Set<string>()
  for (const sheet of document.styleSheets) {
    for (const rule of sheet.cssRules) {
      if (!(rule instanceof CSSStyleRule) || rule.selectorText !== ':root') {
        continue
      }
      for (const property of rule.style) {
        const value = rule.style.getPropertyValue(property)
        if (property.startsWith('--') && /light-dark\(|oklch\(/.test(value)) {
          found.add(property.slice(2))
        }
      }
    }
  }
  return [...found].filter(token => !listed.has(token))
}

function Swatch({ token }: { token: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div
        className="size-6 shrink-0 rounded border border-border"
        style={{ background: `var(--${token})` }}
      />
      <span
        className="truncate font-mono text-[11px] text-muted-foreground"
        title={token}
      >
        {token}
      </span>
    </div>
  )
}

/** Every colour token as a swatch, so both themes can be compared at a glance. */
export function ColoursSection() {
  const [unlisted] = useState(findUnlisted)
  return (
    <div className="space-y-4">
      {unlisted.length > 0 && (
        <p className="text-sm text-destructive">
          Missing from this page: {unlisted.join(', ')}
        </p>
      )}
      {GROUPS.map(group => (
        <div key={group.title} className="space-y-2">
          <h2 className="text-xs font-medium text-foreground">{group.title}</h2>
          <div className="grid grid-cols-5 gap-x-4 gap-y-1.5">
            {group.tokens.map(token => (
              <Swatch key={token} token={token} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
