/**
 * A compact text outline of the visible UI for agents: landmarks, dialogs,
 * headings, controls and short text, each control tagged with a numbered ref
 * that `click` accepts. Far cheaper to read than a screenshot.
 */

/** Elements shown as a group, with their contents indented beneath them. */
const CONTAINER_ROLES = new Set([
  'banner',
  'navigation',
  'main',
  'complementary',
  'contentinfo',
  'form',
  'dialog',
  'alertdialog',
  'menu',
  'menubar',
  'listbox',
  'tablist',
  'tabpanel',
  'tree',
  'group',
  'radiogroup',
  'toolbar',
  'list',
])

/** Elements shown on one line, labelled by their text. Their contents are skipped. */
const CONTROL_ROLES = new Set([
  'button',
  'link',
  'textbox',
  'searchbox',
  'checkbox',
  'radio',
  'switch',
  'combobox',
  'slider',
  'spinbutton',
  'tab',
  'option',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'treeitem',
  'heading',
  'alert',
  'status',
  'tooltip',
])

const INTERACTIVE_SELECTOR =
  'button, a[href], input, textarea, select, summary, [role], [tabindex]:not([tabindex="-1"])'

const MAX_LABEL = 80

/** The implicit or explicit ARIA role of an element, or null if it has none worth showing. */
export function roleOf(el: Element): string | null {
  const explicit = el.getAttribute('role')
  if (explicit) return explicit.split(' ')[0] ?? null

  const tag = el.tagName.toLowerCase()
  switch (tag) {
    case 'button':
    case 'summary':
      return 'button'
    case 'a':
      return el.hasAttribute('href') ? 'link' : null
    case 'textarea':
      return 'textbox'
    case 'select':
      return 'combobox'
    case 'nav':
      return 'navigation'
    case 'main':
      return 'main'
    case 'aside':
      return 'complementary'
    case 'form':
      return 'form'
    case 'dialog':
      return 'dialog'
    case 'ul':
    case 'ol':
      return 'list'
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return 'heading'
    case 'input': {
      const type = (el as HTMLInputElement).type
      if (type === 'hidden') return null
      if (type === 'checkbox' || type === 'radio') return type
      if (type === 'range') return 'slider'
      if (type === 'button' || type === 'submit' || type === 'reset')
        return 'button'
      return type === 'search' ? 'searchbox' : 'textbox'
    }
    default:
      return null
  }
}

function collapse(text: string | null | undefined): string {
  const collapsed = (text ?? '').replace(/\s+/g, ' ').trim()
  return collapsed.length > MAX_LABEL
    ? `${collapsed.slice(0, MAX_LABEL - 1)}…`
    : collapsed
}

/** The accessible name, falling back to text, placeholder or title. */
export function labelOf(el: Element): string {
  const ariaLabel = el.getAttribute('aria-label')
  if (ariaLabel) return collapse(ariaLabel)

  const labelledBy = el.getAttribute('aria-labelledby')
  if (labelledBy) {
    const text = labelledBy
      .split(' ')
      .map(id => el.ownerDocument.getElementById(id)?.textContent ?? '')
      .join(' ')
    if (text.trim()) return collapse(text)
  }

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const label = el.labels?.[0]?.textContent
    if (label?.trim()) return collapse(label)
    if (el.placeholder) return collapse(el.placeholder)
  }

  // innerText puts spaces between blocks; jsdom doesn't implement it
  const text = collapse((el as HTMLElement).innerText ?? el.textContent)
  if (text) return text
  return collapse(el.getAttribute('title') ?? '')
}

function statesOf(el: Element): string[] {
  const states: string[] = []
  const attr = (name: string) => el.getAttribute(name)

  if ((el as HTMLButtonElement).disabled || attr('aria-disabled') === 'true') {
    states.push('disabled')
  }
  if ((el as HTMLInputElement).checked || attr('aria-checked') === 'true') {
    states.push('checked')
  }
  if (attr('aria-checked') === 'mixed') states.push('mixed')
  if (attr('aria-selected') === 'true') states.push('selected')
  if (attr('aria-pressed') === 'true') states.push('pressed')
  if (attr('aria-current') && attr('aria-current') !== 'false')
    states.push('current')
  if (attr('aria-expanded') === 'true') states.push('expanded')
  if (attr('aria-expanded') === 'false') states.push('collapsed')
  if (/^H[1-6]$/.test(el.tagName)) states.push(`h${el.tagName[1]}`)

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    if (el.type !== 'checkbox' && el.type !== 'radio' && el.value) {
      states.push(`value="${collapse(el.value)}"`)
    }
  }
  return states
}

/** Own text (not from children), for plain text such as empty-state messages. */
function ownText(el: Element): string {
  let text = ''
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) text += node.textContent
  }
  return collapse(text)
}

export interface UiTreeOptions {
  /** Whether an element and its subtree are visible. Defaults to `checkVisibility()`. */
  isVisible?: (el: Element) => boolean
  /** Whether a line-level element takes up space. Filters out screen-reader-only text. */
  hasArea?: (el: Element) => boolean
}

function defaultIsVisible(el: Element): boolean {
  return typeof el.checkVisibility === 'function'
    ? el.checkVisibility({ visibilityProperty: true, opacityProperty: true })
    : true
}

function defaultHasArea(el: Element): boolean {
  const rect = el.getBoundingClientRect()
  return rect.width > 1 && rect.height > 1
}

/**
 * Builds the outline for `root`. `refs` is cleared and refilled so that
 * `refs.get(n)` returns the element shown as `[n]`.
 */
export function buildUiTree(
  root: Element,
  refs: Map<number, Element>,
  options: UiTreeOptions = {}
): string {
  const isVisible = options.isVisible ?? defaultIsVisible
  const hasArea = options.hasArea ?? defaultHasArea
  const lines: string[] = []
  refs.clear()

  const walk = (el: Element, depth: number) => {
    if (el.getAttribute('aria-hidden') === 'true' || el.hasAttribute('inert'))
      return
    if (!isVisible(el)) return

    const indent = '  '.repeat(depth)

    // CodeMirror is summarised rather than walked line by line
    if (el.classList.contains('cm-editor')) {
      const lineCount = el.querySelectorAll('.cm-line').length
      refs.set(refs.size + 1, el)
      lines.push(`${indent}editor (${lineCount} visible lines) [${refs.size}]`)
      return
    }

    const role = roleOf(el)
    if (role && CONTROL_ROLES.has(role)) {
      if (!hasArea(el)) return
      refs.set(refs.size + 1, el)
      const states = statesOf(el)
      const label = labelOf(el)
      lines.push(
        `${indent}${role}${label ? ` "${label}"` : ''} [${refs.size}]` +
          (states.length ? ` (${states.join(', ')})` : '')
      )
      return
    }

    if (role && CONTAINER_ROLES.has(role)) {
      const label = el.getAttribute('aria-label') ?? ''
      const heading = `${indent}${role}${label ? ` "${collapse(label)}"` : ''}`
      const start = lines.length
      for (const child of el.children) walk(child, depth + 1)
      // Containers with nothing visible inside are left out
      if (lines.length > start) lines.splice(start, 0, heading)
      return
    }

    const text = ownText(el)
    if (text && hasArea(el)) lines.push(`${indent}text "${text}"`)
    for (const child of el.children) walk(child, depth)
  }

  walk(root, 0)
  return lines.join('\n')
}

/**
 * Finds the visible interactive element whose label matches `text`, preferring
 * an exact (case-insensitive) match over a partial one.
 */
export function findByText(
  root: Element,
  text: string,
  options: UiTreeOptions = {}
): Element | null {
  const isVisible = options.isVisible ?? defaultIsVisible
  const wanted = text.toLowerCase()
  const candidates = [...root.querySelectorAll(INTERACTIVE_SELECTOR)].filter(
    el => {
      const role = roleOf(el)
      // Containers match on all their text, so only controls are considered
      if (role && !CONTROL_ROLES.has(role)) return false
      return isVisible(el) && !el.closest('[aria-hidden="true"], [inert]')
    }
  )
  const labelled = candidates.map(el => ({
    el,
    label: labelOf(el).toLowerCase(),
  }))
  return (
    labelled.find(c => c.label === wanted)?.el ??
    labelled.find(c => c.label.includes(wanted))?.el ??
    null
  )
}
