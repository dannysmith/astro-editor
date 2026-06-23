/**
 * Client-side typing animation for AEDemo.
 *
 * Types the markdown out character-by-character, re-highlighting the growing
 * string on every tick (so formatting "snaps" into place as marks complete,
 * just like the real editor), holds the finished state, then loops.
 *
 * - Block demos write into the `.ae-anim` overlay; the sibling `.ae-sizer`
 *   holds the box at its final height so the page never reflows.
 * - Plays only while in view (IntersectionObserver pauses/resumes it).
 * - Respects `prefers-reduced-motion` (renders the final state, no animation).
 */
import { renderMarkdown } from './highlight'

const CARET = '<span class="ae-caret"></span>'
const prefersReduced = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

function frame(code: string, inline: boolean): string {
  const html = renderMarkdown(code, { inline })
  if (inline) return html + CARET
  // Put the caret inside the last line so it sits at the end of the text,
  // not on a new line below the block.
  const idx = html.lastIndexOf('</div>')
  return idx >= 0 ? html.slice(0, idx) + CARET + html.slice(idx) : html + CARET
}

interface Controller {
  resume(): void
  pause(): void
}

function createAnim(container: HTMLElement): Controller {
  const code = JSON.parse(container.dataset.aedemo || '""') as string
  const inline = container.dataset.inline === 'true'
  const target = inline
    ? container
    : (container.querySelector<HTMLElement>('.ae-anim') ?? container)

  if (prefersReduced()) {
    target.innerHTML = renderMarkdown(code, { inline })
    return { resume() {}, pause() {} }
  }

  const speed = Number(container.dataset.speed) || 48
  const HOLD_END = 2400
  const HOLD_START = 600

  let i = 0
  let mode: 'start' | 'typing' | 'end' = 'start'
  let timer: number | undefined

  const paint = () => {
    target.innerHTML = frame(code.slice(0, i), inline)
  }

  const advance = (): void => {
    timer = undefined
    if (mode === 'start') {
      i = 0
      mode = 'typing'
      paint()
      timer = window.setTimeout(advance, HOLD_START)
      return
    }
    if (mode === 'typing') {
      if (i < code.length) {
        i += 1
        paint()
        const justTyped = code[i - 1]
        const delay =
          justTyped === '\n' ? speed * 3 : speed * (0.6 + Math.random() * 0.9)
        timer = window.setTimeout(advance, delay)
      } else {
        mode = 'end'
        timer = window.setTimeout(advance, HOLD_END)
      }
      return
    }
    // mode === 'end' → loop back to the start
    mode = 'start'
    advance()
  }

  // Start with an empty pane (avoids a flash of the full SSR content when the
  // demo first scrolls into view); the sizer keeps the height reserved.
  paint()

  return {
    resume() {
      if (timer === undefined) advance()
    },
    pause() {
      if (timer !== undefined) {
        window.clearTimeout(timer)
        timer = undefined
      }
    },
  }
}

function init(): void {
  document
    .querySelectorAll<HTMLElement>('[data-aedemo]:not([data-aedemo-init])')
    .forEach((el) => {
      el.dataset.aedemoInit = '1'
      const anim = createAnim(el)
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) anim.resume()
            else anim.pause()
          })
        },
        { threshold: 0.2 }
      )
      io.observe(el)
    })
}

init()
// Re-init after client-side navigation (Astro view transitions).
document.addEventListener('astro:page-load', init)
