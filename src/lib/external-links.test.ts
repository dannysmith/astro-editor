import { describe, it, expect, afterEach } from 'vitest'
import { getExternalUrlFromClick } from './external-links'

/**
 * Build a minimal MouseEvent-like object whose `target` is a real DOM element,
 * so the production code's `closest('a')`/`protocol`/`origin` logic runs for
 * real. Defaults represent an unmodified primary-button click.
 */
function clickEvent(
  target: EventTarget | null,
  overrides: Partial<MouseEvent> = {}
): MouseEvent {
  return {
    defaultPrevented: false,
    button: 0,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    target,
    ...overrides,
  } as unknown as MouseEvent
}

function makeAnchor(href: string): HTMLAnchorElement {
  const a = document.createElement('a')
  a.href = href
  document.body.appendChild(a)
  return a
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('getExternalUrlFromClick', () => {
  it('returns the URL for an external https link', () => {
    const a = makeAnchor('https://example.com/page')
    expect(getExternalUrlFromClick(clickEvent(a))).toBe(
      'https://example.com/page'
    )
  })

  it('returns the URL for an external http link', () => {
    const a = makeAnchor('http://example.com/')
    expect(getExternalUrlFromClick(clickEvent(a))).toBe('http://example.com/')
  })

  it('returns the URL for mailto and tel links', () => {
    const mail = makeAnchor('mailto:hi@danny.is')
    expect(getExternalUrlFromClick(clickEvent(mail))).toBe('mailto:hi@danny.is')

    const tel = makeAnchor('tel:+15551234567')
    expect(getExternalUrlFromClick(clickEvent(tel))).toBe('tel:+15551234567')
  })

  it('resolves clicks on elements nested inside the anchor', () => {
    const a = makeAnchor('https://example.com/nested')
    const span = document.createElement('span')
    a.appendChild(span)
    expect(getExternalUrlFromClick(clickEvent(span))).toBe(
      'https://example.com/nested'
    )
  })

  it('ignores same-origin (in-app) links', () => {
    const a = makeAnchor(`${window.location.origin}/internal`)
    expect(getExternalUrlFromClick(clickEvent(a))).toBeNull()
  })

  it('ignores clicks that are not on an anchor', () => {
    const div = document.createElement('div')
    document.body.appendChild(div)
    expect(getExternalUrlFromClick(clickEvent(div))).toBeNull()
  })

  it('ignores anchors without an href', () => {
    const a = document.createElement('a')
    document.body.appendChild(a)
    expect(getExternalUrlFromClick(clickEvent(a))).toBeNull()
  })

  it('ignores non-primary-button clicks', () => {
    const a = makeAnchor('https://example.com/')
    expect(getExternalUrlFromClick(clickEvent(a, { button: 1 }))).toBeNull()
  })

  it('ignores modified clicks (cmd/ctrl/alt/shift)', () => {
    const a = makeAnchor('https://example.com/')
    expect(getExternalUrlFromClick(clickEvent(a, { metaKey: true }))).toBeNull()
    expect(getExternalUrlFromClick(clickEvent(a, { ctrlKey: true }))).toBeNull()
    expect(getExternalUrlFromClick(clickEvent(a, { altKey: true }))).toBeNull()
    expect(
      getExternalUrlFromClick(clickEvent(a, { shiftKey: true }))
    ).toBeNull()
  })

  it('ignores clicks that have already been handled', () => {
    const a = makeAnchor('https://example.com/')
    expect(
      getExternalUrlFromClick(clickEvent(a, { defaultPrevented: true }))
    ).toBeNull()
  })
})
