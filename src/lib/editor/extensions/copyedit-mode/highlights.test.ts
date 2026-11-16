import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { GlobalSettings, Highlights } from '@/lib/bindings'
import { useProjectStore } from '@/store/projectStore'
import {
  readHighlights,
  toggleAllHighlights,
  toggleHighlight,
} from './highlights'

vi.mock('@/lib/bindings', () => ({
  commands: {
    saveGlobalSettings: vi.fn(() =>
      Promise.resolve({ status: 'ok', data: null })
    ),
  },
}))

const off: Highlights = {
  nouns: false,
  verbs: false,
  adjectives: false,
  adverbs: false,
  conjunctions: false,
}

function withHighlights(highlights: Partial<Highlights>) {
  useProjectStore.setState({
    globalSettings: {
      general: { highlights: { ...off, ...highlights } },
    } as unknown as GlobalSettings,
  })
}

// updateGlobalSettings sets the store before it saves, so these read it at once
const current = () => readHighlights(useProjectStore.getState().globalSettings)

describe('copyedit highlights', () => {
  beforeEach(() => withHighlights({}))

  it('treats every highlight as off until the settings have loaded', () => {
    expect(readHighlights(null)).toEqual(off)
  })

  it('toggles one highlight and leaves the others', () => {
    withHighlights({ verbs: true })
    toggleHighlight('nouns')
    expect(current()).toEqual({ ...off, nouns: true, verbs: true })
  })

  it('hides them all when any is on', () => {
    withHighlights({ adverbs: true })
    toggleAllHighlights()
    expect(current()).toEqual(off)
  })

  it('shows them all when none is on', () => {
    toggleAllHighlights()
    expect(Object.values(current()).every(Boolean)).toBe(true)
  })
})
