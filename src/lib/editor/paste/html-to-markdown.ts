/**
 * Turns copied HTML into Markdown, keeping only what's clearly meant:
 * headings, paragraphs, bold and italic, links, lists, quotes, code and
 * images with a web address. Everything else becomes its text. It reads the
 * HTML's structure only, so a source that fakes structure with styling
 * (Word's lists and headings, say) pastes as plain paragraphs.
 */

const HEADINGS = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6']

/** Elements that start a new block. Anything else is read as inline */
const BLOCKS = new Set([
  ...HEADINGS,
  'ADDRESS',
  'ARTICLE',
  'ASIDE',
  'BLOCKQUOTE',
  'DD',
  'DIV',
  'DL',
  'DT',
  'FIGCAPTION',
  'FIGURE',
  'FOOTER',
  'HEADER',
  'HR',
  'LI',
  'MAIN',
  'NAV',
  'OL',
  'P',
  'PRE',
  'SECTION',
  'TABLE',
  'TBODY',
  'TD',
  'TFOOT',
  'TH',
  'THEAD',
  'TR',
  'UL',
])

const SKIPPED = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'HEAD'])

interface Marks {
  bold: boolean
  italic: boolean
}

/** The Markdown for some copied HTML */
export const htmlToMarkdown = (html: string): string => {
  const body = new DOMParser().parseFromString(html, 'text/html').body
  return blocks(body).join('\n\n')
}

/** An element's content as Markdown blocks */
const blocks = (parent: Node): string[] => {
  const result: string[] = []
  let inline = ''
  const endParagraph = () => {
    // Whitespace from separate text nodes can meet as runs of spaces
    const text = inline
      .replace(/ {2,}/g, ' ')
      .replace(/[ \t]*\n[ \t]*/g, '\n')
      .trim()
    if (text) result.push(escapeLineStarts(text))
    inline = ''
  }

  for (const node of parent.childNodes) {
    if (node instanceof Element && SKIPPED.has(node.tagName)) continue
    if (node instanceof Element && BLOCKS.has(node.tagName)) {
      endParagraph()
      const block = blockOf(node)
      if (block) result.push(block)
    } else {
      inline += inlineOf(node, { bold: false, italic: false })
    }
  }
  endParagraph()
  return result
}

const blockOf = (element: Element): string => {
  const tag = element.tagName
  if (HEADINGS.includes(tag)) {
    const text = inlineOf(element, { bold: false, italic: false })
    const heading = text.replace(/\s+/g, ' ').trim()
    return heading ? `${'#'.repeat(Number(tag[1]))} ${heading}` : ''
  }
  if (tag === 'UL' || tag === 'OL') return list(element)
  if (tag === 'PRE') {
    const code = element.textContent?.replace(/\n$/, '') ?? ''
    const fence = backticks(code, 3)
    return `${fence}\n${code}\n${fence}`
  }
  if (tag === 'HR') return '---'
  if (tag === 'BLOCKQUOTE') {
    return blocks(element)
      .join('\n\n')
      .split('\n')
      .map(line => (line ? `> ${line}` : '>'))
      .join('\n')
  }
  return blocks(element).join('\n\n')
}

/**
 * A list, one line per item, with nested lists indented under their item.
 * A list directly inside another (as WebKit makes RTF's lists) belongs to
 * the item before it.
 */
const list = (element: Element): string => {
  const ordered = element.tagName === 'OL'
  let number = Number(element.getAttribute('start') ?? 1)
  const items: string[] = []
  let indent = 2

  for (const child of element.children) {
    if (child.tagName === 'UL' || child.tagName === 'OL') {
      const nested = indented(list(child), indent)
      if (items.length) items[items.length - 1] += `\n${nested}`
      else items.push(nested)
    } else if (child.tagName === 'LI') {
      const marker = ordered ? `${number++}. ` : '- '
      indent = marker.length
      const [first = '', ...rest] = blocks(child).join('\n').split('\n')
      items.push(
        marker +
          first +
          (rest.length ? `\n${indented(rest.join('\n'), indent)}` : '')
      )
    }
  }
  return items.join('\n')
}

const indented = (text: string, spaces: number): string =>
  text
    .split('\n')
    .map(line => (line ? ' '.repeat(spaces) + line : line))
    .join('\n')

/** An inline node as Markdown, inside the bold and italic around it */
const inlineOf = (node: Node, marks: Marks): string => {
  if (node.nodeType === Node.TEXT_NODE) {
    return escape((node.textContent ?? '').replace(/\s+/g, ' '))
  }
  if (!(node instanceof HTMLElement) || SKIPPED.has(node.tagName)) return ''

  const tag = node.tagName
  if (tag === 'BR') return '\n'
  if (tag === 'IMG') {
    const src = node.getAttribute('src') ?? ''
    const alt = (node.getAttribute('alt') ?? '').replace(/\s+/g, ' ').trim()
    return isWebAddress(src) ? `![${escape(alt)}](${src})` : ''
  }
  if (tag === 'CODE') {
    const code = (node.textContent ?? '').replace(/\s+/g, ' ')
    if (!code.trim()) return code
    // A space keeps backticks at the ends from joining the delimiters
    const padded = /^`|`$/.test(code) ? ` ${code} ` : code
    const ticks = backticks(code, 1)
    return `${ticks}${padded}${ticks}`
  }
  // A block inside inline content (a list in a span, say) is read as text
  if (BLOCKS.has(tag)) return ` ${blocks(node).join(' ')} `

  const bold = !marks.bold && isBold(node)
  const italic = !marks.italic && isItalic(node)
  let text = ''
  for (const child of node.childNodes) {
    text += inlineOf(child, {
      bold: marks.bold || bold,
      italic: marks.italic || italic,
    })
  }

  if (italic) text = wrap(text, '*')
  if (bold) text = wrap(text, '**')
  const href = tag === 'A' ? (node.getAttribute('href') ?? '') : ''
  if (text.trim() && (isWebAddress(href) || href.startsWith('mailto:'))) {
    return wrap(text, '[', `](${href})`)
  }
  return text
}

/** Bold by its tag or its style. Google Docs wraps everything in a `<b>`
 * styled not to be bold */
const isBold = (element: HTMLElement): boolean => {
  const weight = element.style.fontWeight
  if (weight)
    return weight === 'bold' || weight === 'bolder' || Number(weight) >= 600
  return element.tagName === 'B' || element.tagName === 'STRONG'
}

const isItalic = (element: HTMLElement): boolean => {
  const style = element.style.fontStyle
  if (style) return style === 'italic' || style === 'oblique'
  return element.tagName === 'I' || element.tagName === 'EM'
}

const isWebAddress = (url: string): boolean => /^https?:\/\//i.test(url)

/** Puts marks around text, outside any spaces at its ends, which Markdown
 * doesn't allow inside them */
const wrap = (text: string, open: string, close = open): string => {
  const [, before = '', core = '', after = ''] =
    /^(\s*)([\s\S]*?)(\s*)$/.exec(text) ?? []
  return core ? `${before}${open}${core}${close}${after}` : text
}

/** Escapes characters that would otherwise make Markdown of copied text */
const escape = (text: string): string =>
  text
    .replace(/[\\`*[\]<]/g, '\\$&')
    .replace(/(?<!\w)_|_(?!\w)/g, '\\_')
    // Text that reads as an entity (`&lt;`) would be decoded a second time
    .replace(/&(?=#?\w+;)/g, '\\&')

/** Backticks for a code span or block: longer than any run in the code */
const backticks = (code: string, least: number): string => {
  const longest = Math.max(
    0,
    ...(code.match(/`+/g) ?? []).map(run => run.length)
  )
  return '`'.repeat(Math.max(least, longest + 1))
}

/** Escapes what would start a heading, quote or list at the start of a line */
const escapeLineStarts = (text: string): string =>
  text
    .replace(/^(#{1,6}(?=\s)|>|[-+](?=\s))/gm, '\\$1')
    .replace(/^(\d+)([.)])(?=\s)/gm, '$1\\$2')
