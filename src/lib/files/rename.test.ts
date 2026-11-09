import { beforeEach, describe, expect, it } from 'vitest'
import type { FileEntry } from '@/lib/bindings'
import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'
import { makeCollection, makeScan } from '../../test/fixtures'
import { mockToast, resetToastMocks } from '../../test/mocks/toast'
import { queryClient } from '../query-client'
import { queryKeys } from '../query-keys'
import { entryStem, renameOpenFile, renameUnderWay } from './rename'

const blog = makeCollection({ name: 'blog' })

const entry = (name: string): FileEntry => ({
  id: `blog/${name}`,
  name,
  path: `${blog.path}/${name}.md`,
  extension: 'md',
  collection: 'blog',
  last_modified: null,
  frontmatter: null,
  is_entry: true,
})

describe('renameOpenFile', () => {
  beforeEach(() => {
    globalThis.mockTauri.reset()
    resetToastMocks()
    useProjectStore.setState({ projectPath: '/site' })
    queryClient.setQueryData(queryKeys.collections('/site'), makeScan([blog]))
    useEditorStore.setState({
      currentFile: entry('2026-01-05'),
      isDirty: false,
    })
  })

  it('points saves of the old path at the new one until the store follows', async () => {
    let finishRename = () => {}
    globalThis.mockTauri.invoke.mockImplementation((cmd: string) => {
      if (cmd === 'rename_entry') {
        return new Promise(resolve => {
          finishRename = () => resolve(entry('trip-lake').path)
        })
      }
      if (cmd === 'resolve_file_entry')
        return Promise.resolve(entry('trip-lake'))
      return Promise.resolve(null)
    })

    const renaming = renameOpenFile('trip-lake')
    const saveTo = renameUnderWay(entry('2026-01-05').path)
    expect(renameUnderWay(entry('other').path)).toBeNull()
    finishRename()

    await expect(saveTo).resolves.toBe(entry('trip-lake').path)
    await renaming
    expect(useEditorStore.getState().currentFile).toEqual(entry('trip-lake'))
    expect(renameUnderWay(entry('2026-01-05').path)).toBeNull()
  })

  it('names a file in its own folder by the folder', async () => {
    const page = (folder: string): FileEntry => ({
      ...entry(`${folder}/index`),
      path: `${blog.path}/${folder}/index.md`,
    })
    useEditorStore.setState({ currentFile: page('2026-01-05') })
    globalThis.mockTauri.invoke.mockImplementation((cmd: string) => {
      if (cmd === 'rename_entry') return Promise.resolve(page('trip-lake').path)
      if (cmd === 'resolve_file_entry')
        return Promise.resolve(page('trip-lake'))
      return Promise.resolve(null)
    })

    await renameOpenFile('trip-lake')
    expect(mockToast.success).toHaveBeenCalledWith(
      'Renamed to trip-lake/index.md'
    )
  })
})

describe('entryStem', () => {
  it('is the folder name for a folder-per-entry file', () => {
    expect(entryStem(`${blog.path}/trip/index.md`, blog)).toBe('trip')
    expect(entryStem(`${blog.path}/index.md`, blog)).toBe('index')
    expect(entryStem(`${blog.path}/2024/post.mdx`, blog)).toBe('post')
  })
})
