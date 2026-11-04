import { describe, it, expect } from 'vitest'
import { identityFor, lowestFreeSlot, parseSlot } from './dev-slot'

const base = {
  identifier: 'is.danny.astroeditor.dev',
  productName: 'Astro Editor Dev',
}

describe('identityFor', () => {
  it('keeps the plain dev identity for the main checkout', () => {
    expect(identityFor(0, base, 'main')).toEqual({
      slot: 0,
      identifier: 'is.danny.astroeditor.dev',
      productName: 'Astro Editor Dev',
      port: 1420,
      title: 'Astro Editor (Dev · main)',
    })
  })

  it('gives each worktree slot its own identifier, name and port', () => {
    expect(identityFor(2, base, 'new-naming')).toEqual({
      slot: 2,
      identifier: 'is.danny.astroeditor.dev2',
      productName: 'Astro Editor Dev 2',
      port: 1440,
      title: 'Astro Editor (Dev 2 · new-naming)',
    })
  })
})

describe('parseSlot', () => {
  it('reads a worktree slot', () => {
    expect(parseSlot('3\n')).toBe(3)
  })

  it('treats anything else as no slot, never the main checkout', () => {
    for (const contents of ['', '0', '5', '1.5', 'abc']) {
      expect(parseSlot(contents)).toBeNull()
    }
  })
})

describe('lowestFreeSlot', () => {
  it('fills gaps left by removed worktrees first', () => {
    expect(lowestFreeSlot([])).toBe(1)
    expect(lowestFreeSlot([1, 3])).toBe(2)
  })

  it('returns null when every slot is taken', () => {
    expect(lowestFreeSlot([1, 2, 3, 4])).toBeNull()
  })
})
