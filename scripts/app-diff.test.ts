import { describe, it, expect } from 'vitest'
import { PNG } from 'pngjs'
import { diffPngs, latestShots, shotKey } from './app-diff'

/** A white PNG with the given pixels painted black. */
function png(width: number, height: number, black: [number, number][] = []) {
  const image = new PNG({ width, height })
  image.data.fill(255)
  for (const [x, y] of black) {
    const i = (y * width + x) * 4
    image.data[i] = image.data[i + 1] = image.data[i + 2] = 0
  }
  return PNG.sync.write(image)
}

describe('diffPngs', () => {
  it('reports identical images as the same', () => {
    expect(diffPngs(png(4, 4, [[1, 1]]), png(4, 4, [[1, 1]]))).toEqual({
      status: 'same',
    })
  })

  it('counts changed pixels and boxes them', () => {
    const diff = diffPngs(
      png(10, 10),
      png(10, 10, [
        [2, 3],
        [5, 7],
      ])
    )
    expect(diff).toMatchObject({
      status: 'differ',
      pixels: 2,
      total: 100,
      bounds: { x: 2, y: 3, width: 4, height: 5 },
    })
  })

  it("doesn't compare images of different sizes", () => {
    expect(diffPngs(png(4, 4), png(4, 5))).toEqual({
      status: 'size',
      a: '4x4',
      b: '4x5',
    })
  })
})

describe('shotKey', () => {
  it('drops the timestamp from shot names', () => {
    expect(
      shotKey('baseline/styleguide-menus-dark-1489x892-20261026-024156.png')
    ).toBe('styleguide-menus-dark-1489x892')
  })

  it('ignores files that are not shots', () => {
    expect(shotKey('styleguide-menus-dark-1489x892-diff.png')).toBeNull()
  })
})

describe('latestShots', () => {
  it('keeps the newest file for each key', () => {
    const latest = latestShots([
      'menus-dark-1489x892-20261026-041340.png',
      'menus-dark-1489x892-20261026-024156.png',
      'menus-light-1489x892-20261026-024156.png',
      'notes.md',
    ])
    expect([...latest]).toEqual([
      ['menus-dark-1489x892', 'menus-dark-1489x892-20261026-041340.png'],
      ['menus-light-1489x892', 'menus-light-1489x892-20261026-024156.png'],
    ])
  })
})
