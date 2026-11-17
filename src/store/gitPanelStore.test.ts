import { beforeEach, describe, expect, it } from 'vitest'
import { useGitPanelStore } from './gitPanelStore'

describe('rememberRename', () => {
  beforeEach(() => useGitPanelStore.setState({ renamedFrom: {} }))

  it('keeps the path a file had first, through several renames', () => {
    const { rememberRename } = useGitPanelStore.getState()
    rememberRename('/site/a.md', '/site/b.md')
    rememberRename('/site/b.md', '/site/c.md')
    expect(useGitPanelStore.getState().renamedFrom).toEqual({
      '/site/c.md': '/site/a.md',
    })
  })
})
