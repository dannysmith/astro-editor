import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FileEntry } from '@/lib/bindings'
import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'
import { makeCollection, makeScan } from '../../test/fixtures'
import { mockToast, resetToastMocks } from '../../test/mocks/toast'
import { queryClient } from '../query-client'
import { queryKeys } from '../query-keys'
import {
  rememberNewFile,
  renamableStem,
  renameNewFileFromTitle,
  renameFile,
  renameOpenFile,
  renameUnderWay,
} from './rename'

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

  it("doesn't rename index files, which Astro names by their folder", async () => {
    useEditorStore.setState({
      currentFile: { ...entry('trip'), path: `${blog.path}/trip/index.md` },
    })

    await renameOpenFile('trip-lake')
    const commands = globalThis.mockTauri.invoke.mock.calls.map(([cmd]) => cmd)
    expect(commands).not.toContain('rename_entry')
    expect(mockToast.info).toHaveBeenCalled()
  })
})

describe('renameNewFileFromTitle', () => {
  const titled = (pattern: string) =>
    makeCollection({
      name: 'blog',
      settings: {
        ...blog.settings,
        fileNamePattern: { value: pattern, source: 'set' },
      },
    })
  const renames = () =>
    globalThis.mockTauri.invoke.mock.calls.filter(
      ([cmd]) => cmd === 'rename_entry'
    ).length

  const start = (pattern: string, title: string) => {
    queryClient.setQueryData(
      queryKeys.collections('/site'),
      makeScan([titled(pattern)])
    )
    useEditorStore.setState({
      currentFile: entry('2026-01-05'),
      frontmatter: { title },
      isDirty: false,
    })
    rememberNewFile(entry('2026-01-05').path, 'Untitled')
  }

  beforeEach(() => {
    globalThis.mockTauri.reset()
    useProjectStore.setState({ projectPath: '/site' })
    globalThis.mockTauri.invoke.mockImplementation((cmd: string) => {
      if (cmd === 'rename_entry')
        return Promise.resolve(entry('trip-lake').path)
      if (cmd === 'resolve_file_entry')
        return Promise.resolve(entry('trip-lake'))
      return Promise.resolve(null)
    })
  })

  it('renames a new file once its title is written, and only once', async () => {
    start('{title}', 'My Trip to the Lake')
    await renameNewFileFromTitle()
    expect(renames()).toBe(1)

    useEditorStore.setState({
      currentFile: entry('2026-01-05'),
      frontmatter: { title: 'Another title' },
    })
    await renameNewFileFromTitle()
    expect(renames()).toBe(1)
  })

  it('waits while the title is still the placeholder', async () => {
    start('{title}', 'Untitled')
    await renameNewFileFromTitle()
    expect(renames()).toBe(0)

    useEditorStore.setState({ frontmatter: { title: 'My Trip' } })
    await renameNewFileFromTitle()
    expect(renames()).toBe(1)
  })

  it('forgets the file when its pattern has no title', async () => {
    start('{YYYY-MM-DD}', 'My Trip to the Lake')
    await renameNewFileFromTitle()
    expect(renames()).toBe(0)

    // Even if the pattern changes afterwards
    queryClient.setQueryData(
      queryKeys.collections('/site'),
      makeScan([titled('{title}')])
    )
    await renameNewFileFromTitle()
    expect(renames()).toBe(0)
  })
})

describe('renamableStem', () => {
  it("is the file's name without its extension, or null for an index file", () => {
    expect(renamableStem(`${blog.path}/2024/post.mdx`)).toBe('post')
    expect(renamableStem(`${blog.path}/trip/index.md`)).toBeNull()
    expect(renamableStem(`${blog.path}/index.md`)).toBeNull()
  })
})

describe('renameFile', () => {
  const from = entry('old-name').path
  const to = entry('new-name').path

  beforeEach(() => {
    globalThis.mockTauri.reset()
    globalThis.mockTauri.invoke.mockResolvedValue(entry('new-name'))
    useEditorStore.setState({
      currentFile: entry('old-name'),
      isDirty: true,
      lastSaveTimestamp: 1,
    })
  })

  it('saves the open file first, then points saves at the new path', async () => {
    const order: string[] = []
    useEditorStore.setState({
      autoSaveCallback: () => {
        order.push('save')
        useEditorStore.setState({ isDirty: false, lastSaveTimestamp: 2 })
        return Promise.resolve()
      },
    })
    let finishRename = () => {}
    const renameOnDisk = () => {
      order.push('rename')
      return new Promise<void>(resolve => (finishRename = resolve))
    }

    const renaming = renameFile(from, to, '/site', renameOnDisk)
    await vi.waitFor(() => expect(order).toEqual(['save', 'rename']))
    const saveTo = renameUnderWay(from)
    finishRename()

    await expect(renaming).resolves.toBe(true)
    await expect(saveTo).resolves.toBe(to)
    expect(useEditorStore.getState().currentFile?.path).toBe(to)
    expect(renameUnderWay(from)).toBeNull()
  })

  it("doesn't rename the open file if its save fails", async () => {
    // A failed save leaves the file dirty and its save time unchanged
    useEditorStore.setState({ autoSaveCallback: () => Promise.resolve() })
    const renameOnDisk = vi.fn(() => Promise.resolve())

    await expect(renameFile(from, to, '/site', renameOnDisk)).resolves.toBe(
      false
    )
    expect(renameOnDisk).not.toHaveBeenCalled()
    expect(useEditorStore.getState().currentFile?.path).toBe(from)
  })

  it('renames other files without saving the open one', async () => {
    const save = vi.fn(() => Promise.resolve())
    useEditorStore.setState({ autoSaveCallback: save })
    const renameOnDisk = vi.fn(() => Promise.resolve())

    await renameFile(entry('other').path, to, '/site', renameOnDisk)

    expect(renameOnDisk).toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
    expect(useEditorStore.getState().currentFile?.path).toBe(from)
  })
})
