import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ask } from '@tauri-apps/plugin-dialog'
import { commands } from '@/lib/bindings'
import { useEditorStore } from '../store/editorStore'
import { useProjectStore } from '../store/projectStore'
import { answerQuitRequest } from './quit'
import { flushLastEntry, rememberLastEntry } from './projects/last-entry'
import type { FileEntry } from '@/types'

vi.mock('@tauri-apps/plugin-dialog', () => ({ ask: vi.fn() }))
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ show: vi.fn(() => Promise.resolve()) }),
}))
vi.mock('@/lib/bindings', () => ({
  commands: {
    quitApp: vi.fn(() => Promise.resolve()),
    cancelQuit: vi.fn(() => Promise.resolve()),
    // The binding rethrows IPC failures rather than returning an error
    setLastEntry: vi.fn(() => Promise.reject(new Error('IPC failed'))),
  },
}))

const file = { id: 'posts/hello', name: 'hello' } as FileEntry

/** A save callback that leaves the file dirty, as a failed save does */
const failingSave = vi.fn(() => Promise.resolve())
const succeedingSave = vi.fn(() => {
  useEditorStore.setState({ isDirty: false })
  return Promise.resolve()
})

describe('answerQuitRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useEditorStore.setState({
      currentFile: file,
      isDirty: false,
      autoSaveCallback: succeedingSave,
    })
  })

  it('quits straight away when nothing is unsaved', async () => {
    await answerQuitRequest()

    expect(succeedingSave).not.toHaveBeenCalled()
    expect(commands.quitApp).toHaveBeenCalledOnce()
  })

  it('saves and quits even when remembering the open file fails', async () => {
    useProjectStore.setState({ currentProjectId: 'blog' })
    rememberLastEntry('/sites/blog/hello.md')
    useEditorStore.setState({ isDirty: true })

    await answerQuitRequest()

    expect(commands.setLastEntry).toHaveBeenCalled()
    expect(succeedingSave).toHaveBeenCalledWith(false)
    expect(commands.quitApp).toHaveBeenCalledOnce()
  })

  it('answers a failed save before remembering the open file', async () => {
    useProjectStore.setState({ currentProjectId: 'blog' })
    rememberLastEntry('/sites/blog/hello.md')
    useEditorStore.setState({ isDirty: true, autoSaveCallback: failingSave })

    await answerQuitRequest()

    // Rust quits by itself if it isn't answered in time, so nothing else waits
    expect(commands.cancelQuit).toHaveBeenCalledOnce()
    expect(commands.setLastEntry).not.toHaveBeenCalled()
    await flushLastEntry()
  })

  it('saves unsaved edits before quitting', async () => {
    useEditorStore.setState({ isDirty: true })

    await answerQuitRequest()

    expect(succeedingSave).toHaveBeenCalledWith(false)
    expect(commands.quitApp).toHaveBeenCalledOnce()
    expect(ask).not.toHaveBeenCalled()
  })

  it('cancels the quit and asks when the save fails', async () => {
    useEditorStore.setState({ isDirty: true, autoSaveCallback: failingSave })
    vi.mocked(ask).mockResolvedValue(false)

    await answerQuitRequest()

    expect(commands.cancelQuit).toHaveBeenCalledOnce()
    expect(ask).toHaveBeenCalledOnce()
    expect(commands.quitApp).not.toHaveBeenCalled()
  })

  it('quits after a failed save if the writer chooses to', async () => {
    useEditorStore.setState({ isDirty: true, autoSaveCallback: failingSave })
    vi.mocked(ask).mockResolvedValue(true)

    await answerQuitRequest()

    expect(commands.quitApp).toHaveBeenCalledOnce()
  })

  it('asks again after the dialog itself fails', async () => {
    useEditorStore.setState({ isDirty: true, autoSaveCallback: failingSave })
    vi.mocked(ask).mockRejectedValueOnce(new Error('dialog failed'))
    await expect(answerQuitRequest()).rejects.toThrow('dialog failed')

    vi.mocked(ask).mockResolvedValue(true)
    await answerQuitRequest()

    expect(ask).toHaveBeenCalledTimes(2)
    expect(commands.quitApp).toHaveBeenCalledOnce()
  })

  it('turns down a second request while the dialog is open', async () => {
    useEditorStore.setState({ isDirty: true, autoSaveCallback: failingSave })
    let answer: (quit: boolean) => void = () => {}
    vi.mocked(ask).mockReturnValue(
      new Promise(resolve => {
        answer = resolve
      })
    )

    const first = answerQuitRequest()
    await vi.waitFor(() => expect(ask).toHaveBeenCalled())
    await answerQuitRequest()

    expect(commands.cancelQuit).toHaveBeenCalledTimes(2)
    expect(ask).toHaveBeenCalledOnce()

    answer(false)
    await first
  })
})
