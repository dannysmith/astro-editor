import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { flushLastEntry, rememberLastEntry } from './last-entry'
import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'

const writes = () =>
  globalThis.mockTauri.invoke.mock.calls
    .filter(([cmd]) => cmd === 'set_last_entry')
    .map(([, args]) => args as { projectId: string; filePath: string | null })

describe('remembering the last entry', () => {
  beforeEach(async () => {
    globalThis.mockTauri.reset()
    globalThis.mockTauri.invoke.mockResolvedValue(null)
    await flushLastEntry()
    globalThis.mockTauri.invoke.mockClear()
    useProjectStore.setState({ currentProjectId: 'blog', projectPath: null })
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('writes only the last of several quick changes', async () => {
    rememberLastEntry('/sites/blog/a.md')
    rememberLastEntry('/sites/blog/b.md')
    expect(writes()).toEqual([])

    await vi.advanceTimersByTimeAsync(1000)
    expect(writes()).toEqual([
      { projectId: 'blog', filePath: '/sites/blog/b.md' },
    ])
  })

  it('writes straight away when flushed, as before quitting', async () => {
    rememberLastEntry('/sites/blog/a.md')
    await flushLastEntry()
    expect(writes()).toEqual([
      { projectId: 'blog', filePath: '/sites/blog/a.md' },
    ])
    await vi.advanceTimersByTimeAsync(1000)
    expect(writes()).toHaveLength(1)
  })

  it('waits for a write already under way when flushed', async () => {
    let finishWrite = () => {}
    globalThis.mockTauri.invoke.mockImplementation(
      () => new Promise(resolve => (finishWrite = () => resolve(null)))
    )
    rememberLastEntry('/sites/blog/a.md')
    await vi.advanceTimersByTimeAsync(1000)
    expect(writes()).toHaveLength(1)

    let flushed = false
    const flushing = flushLastEntry().then(() => (flushed = true))
    await vi.advanceTimersByTimeAsync(100)
    expect(flushed).toBe(false)

    finishWrite()
    await flushing
    expect(flushed).toBe(true)
  })

  it("keeps the previous project's entry when the project changes", async () => {
    rememberLastEntry('/sites/blog/a.md')
    useProjectStore.setState({ currentProjectId: 'docs' })
    rememberLastEntry('/sites/docs/intro.md')
    await vi.advanceTimersByTimeAsync(1000)

    expect(writes()).toEqual([
      { projectId: 'blog', filePath: '/sites/blog/a.md' },
      { projectId: 'docs', filePath: '/sites/docs/intro.md' },
    ])
  })

  it('forgets the entry when the writer closes the file, not on a switch', async () => {
    useEditorStore.getState().closeCurrentFile({ keepLastEntry: true })
    await vi.advanceTimersByTimeAsync(1000)
    expect(writes()).toEqual([])

    useEditorStore.getState().closeCurrentFile()
    await vi.advanceTimersByTimeAsync(1000)
    expect(writes()).toEqual([{ projectId: 'blog', filePath: null }])
  })
})
