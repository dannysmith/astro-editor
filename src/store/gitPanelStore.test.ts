import { beforeEach, describe, expect, it } from 'vitest'
import { useGitPanelStore } from './gitPanelStore'

beforeEach(() => useGitPanelStore.setState({ added: {}, renamedFrom: {} }))

describe('rememberAdded', () => {
  it('keeps each file once', () => {
    const { rememberAdded } = useGitPanelStore.getState()
    rememberAdded('/site/a.md', '/site/assets/x.png')
    rememberAdded('/site/a.md', '/site/assets/x.png')
    rememberAdded('/site/a.md', '/site/assets/y.png')
    expect(useGitPanelStore.getState().added).toEqual({
      '/site/a.md': ['/site/assets/x.png', '/site/assets/y.png'],
    })
  })
})

describe('rememberRename', () => {
  it('keeps the path a file had first, through several renames', () => {
    const { rememberRename } = useGitPanelStore.getState()
    rememberRename('/site/a.md', '/site/b.md')
    rememberRename('/site/b.md', '/site/c.md')
    expect(useGitPanelStore.getState().renamedFrom).toEqual({
      '/site/c.md': '/site/a.md',
    })
  })

  it('moves the files added for an entry with it', () => {
    const { rememberAdded, rememberRename } = useGitPanelStore.getState()
    rememberAdded('/site/untitled.md', '/site/assets/x.png')
    rememberRename('/site/untitled.md', '/site/trip.md')
    expect(useGitPanelStore.getState().added).toEqual({
      '/site/trip.md': ['/site/assets/x.png'],
    })
  })
})
