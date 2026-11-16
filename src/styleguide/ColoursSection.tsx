import { useState } from 'react'
import { COLOUR_TOKEN_GROUPS } from '@/lib/colour-tokens'

/** Colour tokens declared on :root that aren't in COLOUR_TOKEN_GROUPS. */
function findUnlisted(): string[] {
  const listed = new Set(COLOUR_TOKEN_GROUPS.flatMap(group => group.tokens))
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
      {COLOUR_TOKEN_GROUPS.map(group => (
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
