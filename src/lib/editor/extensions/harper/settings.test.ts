import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { CopyeditSettings, GlobalSettings } from '@/lib/bindings'
import { useProjectStore } from '@/store/projectStore'
import { addWord, readCopyedit, setCheck } from './settings'

vi.mock('@/lib/bindings', () => ({
  commands: {
    saveGlobalSettings: vi.fn(() =>
      Promise.resolve({ status: 'ok', data: null })
    ),
  },
}))

function withCopyedit(copyedit: Partial<CopyeditSettings>) {
  useProjectStore.setState({
    globalSettings: {
      copyedit: {
        dialect: 'british',
        checks: { spelling: false, grammar: false, style: false },
        dictionary: [],
        ...copyedit,
      },
    } as unknown as GlobalSettings,
  })
}

// updateGlobalSettings sets the store before it saves, so these read it at once
const current = () => readCopyedit(useProjectStore.getState().globalSettings)

describe('Harper settings', () => {
  beforeEach(() => withCopyedit({}))

  it('has every check off until the settings have loaded', () => {
    expect(readCopyedit(null)).toEqual({
      dialect: 'american',
      checks: { spelling: false, grammar: false, style: false },
      dictionary: [],
    })
  })

  it('switches one check and leaves the others', () => {
    withCopyedit({ checks: { spelling: true, grammar: false, style: false } })
    setCheck('style', true)
    expect(current().checks).toEqual({
      spelling: true,
      grammar: false,
      style: true,
    })
  })

  it('adds words to the dictionary once', () => {
    withCopyedit({ dictionary: ['MDX'] })
    addWord('MDX')
    addWord('frontmatter')
    expect(current().dictionary).toEqual(['MDX', 'frontmatter'])
  })
})
