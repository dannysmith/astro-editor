import { describe, it, expect, afterEach } from 'vitest'
import { isDropWithinElement } from './handlers'

/** An element at 0,0 to 100,100, and a child inside it */
function target() {
  const element = document.createElement('div')
  const child = document.createElement('span')
  element.append(child)
  element.getBoundingClientRect = () =>
    ({ left: 0, right: 100, top: 0, bottom: 100 }) as DOMRect
  return { element, child }
}

/** jsdom doesn't lay anything out, so say what's on top */
function onTop(element: Element | null) {
  document.elementFromPoint = () => element
}

describe('isDropWithinElement', () => {
  afterEach(() => {
    Reflect.deleteProperty(document, 'elementFromPoint')
  })

  it('takes a drop on the element or something in it', () => {
    const { element, child } = target()
    onTop(child)
    expect(isDropWithinElement({ x: 50, y: 50 }, element)).toBe(true)
  })

  it('ignores a drop on something covering it, like a dialog', () => {
    const { element } = target()
    onTop(document.createElement('div'))
    expect(isDropWithinElement({ x: 50, y: 50 }, element)).toBe(false)
  })

  it('ignores a drop outside it', () => {
    const { element } = target()
    onTop(element)
    expect(isDropWithinElement({ x: 150, y: 50 }, element)).toBe(false)
    expect(isDropWithinElement(undefined, element)).toBe(false)
  })
})
