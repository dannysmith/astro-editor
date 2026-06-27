import { describe, it, expect, afterEach } from 'vitest'
import { classifyLinkClick } from './external-links'

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

describe('classifyLinkClick', () => {
  it('opens external https links', () => {
    const a = makeAnchor('https://example.com/page')
    expect(classifyLinkClick(clickEvent(a))).toEqual({
      type: 'open',
      url: 'https://example.com/page',
    })
  })

  it('opens external http links', () => {
    const a = makeAnchor('http://example.com/')
    expect(classifyLinkClick(clickEvent(a))).toEqual({
      type: 'open',
      url: 'http://example.com/',
    })
  })

  it('opens mailto and tel links', () => {
    const mail = makeAnchor('mailto:hi@danny.is')
    expect(classifyLinkClick(clickEvent(mail))).toEqual({
      type: 'open',
      url: 'mailto:hi@danny.is',
    })

    const tel = makeAnchor('tel:+15551234567')
    expect(classifyLinkClick(clickEvent(tel))).toEqual({
      type: 'open',
      url: 'tel:+15551234567',
    })
  })

  it('resolves clicks on elements nested inside the anchor', () => {
    const a = makeAnchor('https://example.com/nested')
    const span = document.createElement('span')
    a.appendChild(span)
    expect(classifyLinkClick(clickEvent(span))).toEqual({
      type: 'open',
      url: 'https://example.com/nested',
    })
  })

  it('blocks unsafe / webview-navigating schemes', () => {
    expect(
      classifyLinkClick(clickEvent(makeAnchor('javascript:alert(1)')))
    ).toEqual({ type: 'block' })
    expect(
      classifyLinkClick(clickEvent(makeAnchor('file:///etc/passwd')))
    ).toEqual({ type: 'block' })
    expect(
      classifyLinkClick(clickEvent(makeAnchor('data:text/html,<h1>hi</h1>')))
    ).toEqual({ type: 'block' })
  })

  it('ignores same-origin (in-app) links', () => {
    const a = makeAnchor(`${window.location.origin}/internal`)
    expect(classifyLinkClick(clickEvent(a))).toEqual({ type: 'ignore' })
  })

  it('ignores same-origin hash links', () => {
    const a = makeAnchor(`${window.location.origin}/#section`)
    expect(classifyLinkClick(clickEvent(a))).toEqual({ type: 'ignore' })
  })

  it('ignores clicks that are not on an anchor', () => {
    const div = document.createElement('div')
    document.body.appendChild(div)
    expect(classifyLinkClick(clickEvent(div))).toEqual({ type: 'ignore' })
  })

  it('ignores anchors without an href', () => {
    const a = document.createElement('a')
    document.body.appendChild(a)
    expect(classifyLinkClick(clickEvent(a))).toEqual({ type: 'ignore' })
  })

  it('ignores non-primary-button clicks', () => {
    const a = makeAnchor('https://example.com/')
    expect(classifyLinkClick(clickEvent(a, { button: 1 }))).toEqual({
      type: 'ignore',
    })
  })

  it('ignores modified clicks (cmd/ctrl/alt/shift)', () => {
    const a = makeAnchor('https://example.com/')
    expect(classifyLinkClick(clickEvent(a, { metaKey: true }))).toEqual({
      type: 'ignore',
    })
    expect(classifyLinkClick(clickEvent(a, { ctrlKey: true }))).toEqual({
      type: 'ignore',
    })
    expect(classifyLinkClick(clickEvent(a, { altKey: true }))).toEqual({
      type: 'ignore',
    })
    expect(classifyLinkClick(clickEvent(a, { shiftKey: true }))).toEqual({
      type: 'ignore',
    })
  })

  it('ignores clicks that have already been handled', () => {
    const a = makeAnchor('https://example.com/')
    expect(
      classifyLinkClick(clickEvent(a, { defaultPrevented: true }))
    ).toEqual({ type: 'ignore' })
  })
})
