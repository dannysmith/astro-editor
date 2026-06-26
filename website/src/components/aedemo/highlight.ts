/**
 * Lightweight markdown → AE-editor-styled HTML.
 *
 * Mirrors how the Astro Editor *source* editor displays markdown: the syntax
 * marks (`#`, `*`, `` ` `` …) are dimmed and the text they affect is styled.
 * It deliberately only styles *complete* constructs, so partial input typed
 * mid-animation (e.g. `**bol`) stays plain until its closing mark arrives —
 * exactly like the real editor.
 *
 * Shared by AEDemo.astro (server render / no-JS fallback) and the client
 * animator, so the two never drift.
 */

export interface HighlightOptions {
  inline?: boolean
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const mark = (s: string) => `<span class="ae-mark">${esc(s)}</span>`

/** Render inline constructs (bold, italic, code, links) within a line. */
function renderInline(text: string): string {
  let out = ''
  let i = 0
  while (i < text.length) {
    const rest = text.slice(i)
    let m: RegExpExecArray | null

    if ((m = /^`([^`]+)`/.exec(rest))) {
      out += mark('`') + `<code class="ae-code">${esc(m[1])}</code>` + mark('`')
    } else if ((m = /^!\[([^\]]*)\]\(([^)]+)\)/.exec(rest))) {
      out +=
        mark('![') +
        `<span class="ae-link">${esc(m[1])}</span>` +
        mark(']') +
        mark(`(${m[2]})`)
    } else if ((m = /^\[([^\]]+)\]\(([^)]+)\)/.exec(rest))) {
      out +=
        mark('[') +
        `<span class="ae-link">${esc(m[1])}</span>` +
        mark(']') +
        mark(`(${m[2]})`)
    } else if ((m = /^\*\*([^*]+)\*\*/.exec(rest))) {
      out +=
        mark('**') +
        `<strong class="ae-strong">${esc(m[1])}</strong>` +
        mark('**')
    } else if ((m = /^\*([^*\s][^*]*)\*/.exec(rest))) {
      out += mark('*') + `<em class="ae-em">${esc(m[1])}</em>` + mark('*')
    } else {
      out += esc(text[i])
      i += 1
      continue
    }
    i += m[0].length
  }
  return out
}

/** Render a full markdown string (block mode) or a single fragment (inline). */
export function renderMarkdown(
  src: string,
  opts: HighlightOptions = {}
): string {
  if (opts.inline) return renderInline(src)

  const lines = src.split('\n')
  let html = ''
  let inFence = false

  for (const line of lines) {
    const fence = /^```(.*)$/.exec(line)
    if (fence) {
      html += `<div class="ae-line ae-codeline">${mark('```')}${esc(fence[1])}</div>`
      inFence = !inFence
      continue
    }
    if (inFence) {
      html += `<div class="ae-line ae-codeline">${line ? esc(line) : '&nbsp;'}</div>`
      continue
    }

    let m: RegExpExecArray | null
    if ((m = /^(#{1,6})\s+(.*)$/.exec(line))) {
      const level = m[1].length
      html += `<div class="ae-line ae-heading ae-h${level}"><span class="ae-mark ae-heading-mark">${esc(m[1])}</span> ${renderInline(m[2])}</div>`
    } else if ((m = /^>\s?(.*)$/.exec(line))) {
      html += `<div class="ae-line">${mark('>')} <span class="ae-quote">${renderInline(m[1])}</span></div>`
    } else if ((m = /^(\s*)([-*+])\s+(.*)$/.exec(line))) {
      html += `<div class="ae-line">${esc(m[1])}${mark(m[2])} ${renderInline(m[3])}</div>`
    } else if ((m = /^(\s*)(\d+\.)\s+(.*)$/.exec(line))) {
      html += `<div class="ae-line">${esc(m[1])}${mark(m[2])} ${renderInline(m[3])}</div>`
    } else if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      html += `<div class="ae-line ae-hr">${mark(line)}</div>`
    } else {
      html += `<div class="ae-line">${line.trim() === '' ? '&nbsp;' : renderInline(line)}</div>`
    }
  }
  return html
}
