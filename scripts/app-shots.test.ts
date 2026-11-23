import { PNG } from 'pngjs'
import { describe, expect, it } from 'vitest'
import { frameWindow, selectShots, SHOTS } from './app-shots'

function solidPng(width: number, height: number) {
  const png = new PNG({ width, height })
  png.data.fill(200)
  for (let i = 3; i < png.data.length; i += 4) png.data[i] = 255
  return PNG.sync.write(png)
}

describe('frameWindow', () => {
  const framed = PNG.sync.read(frameWindow(solidPng(200, 120)))
  const alpha = (x: number, y: number) =>
    framed.data[(y * framed.width + x) * 4 + 3]

  it('adds the native capture margins', () => {
    expect(framed.width).toBe(292)
    expect(framed.height).toBe(212)
  })

  it('keeps the window opaque and rounds its corners', () => {
    expect(alpha(146, 100)).toBe(255)
    expect(alpha(46, 38)).toBeLessThan(40)
  })

  it('casts the shadow downwards', () => {
    expect(alpha(146, 160)).toBeGreaterThan(alpha(146, 35)!)
    expect(alpha(0, 0)).toBe(0)
  })
})

describe('selectShots', () => {
  it('returns every shot without names', () => {
    expect(selectShots([])).toBe(SHOTS)
  })

  it('rejects an unknown name', () => {
    expect(() => selectShots(['nope'])).toThrow('no shot called "nope"')
  })
})
