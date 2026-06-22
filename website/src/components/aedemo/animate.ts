/**
 * Client-side typing animation for AEDemo.
 *
 * Types the markdown out character-by-character, re-highlighting the growing
 * string on every tick (so formatting "snaps" into place as marks complete,
 * just like the real editor), holds the finished state, then loops.
 *
 * Respects `prefers-reduced-motion` (renders the final state, no animation)
 * and only starts once the element scrolls into view.
 */
import { renderMarkdown } from './highlight'

const CARET = '<span class="ae-caret"></span>'
const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

function frame(code: string, inline: boolean, caret: boolean): string {
  let html = renderMarkdown(code, { inline })
  if (!caret) return html
  if (inline) return html + CARET
  // Place the caret inside the last line so it sits at the end of the text,
  // not on a new line below the block.
  const idx = html.lastIndexOf('</div>')
  return idx >= 0 ? html.slice(0, idx) + CARET + html.slice(idx) : html + CARET
}

function animate(el: HTMLElement): void {
  const code = JSON.parse(el.dataset.aedemo || '""') as string
  const inline = el.dataset.inline === 'true'

  if (reducedMotion()) {
    el.innerHTML = renderMarkdown(code, { inline })
    return
  }

  const speed = Number(el.dataset.speed) || 48
  const holdAtEnd = 2400
  const holdAtStart = 600
  let timer: number | undefined

  const type = (i: number): void => {
    el.innerHTML = frame(code.slice(0, i), inline, true)
    if (i < code.length) {
      const justTyped = code[i - 1]
      const delay =
        justTyped === '\n' ? speed * 3 : speed * (0.6 + Math.random() * 0.9)
      timer = window.setTimeout(() => type(i + 1), delay)
    } else {
      timer = window.setTimeout(restart, holdAtEnd)
    }
  }

  const restart = (): void => {
    el.innerHTML = frame('', inline, true)
    timer = window.setTimeout(() => type(1), holdAtStart)
  }

  restart()

  // Pause/resume isn't needed for a first pass; just clean up if removed.
  el.addEventListener('aedemo:stop', () => window.clearTimeout(timer))
}

function init(): void {
  document
    .querySelectorAll<HTMLElement>('[data-aedemo]:not([data-aedemo-init])')
    .forEach(el => {
      el.dataset.aedemoInit = '1'
      const io = new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              io.disconnect()
              animate(el)
            }
          })
        },
        { threshold: 0.3 }
      )
      io.observe(el)
    })
}

init()
// Re-init after client-side navigation (Astro view transitions).
document.addEventListener('astro:page-load', init)
