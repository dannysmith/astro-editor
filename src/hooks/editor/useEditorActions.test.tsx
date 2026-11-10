import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEditorActions } from './useEditorActions'
import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'
import type { FileEntry } from '@/types'

const fileEntry = (id: string): FileEntry => ({
  id,
  name: `${id}.md`,
  path: `/test/content/blog/${id}.md`,
  extension: 'md',
  collection: 'blog',
  last_modified: null,
  frontmatter: null,
  is_entry: true,
})

function renderActions() {
  const queryClient = new QueryClient()
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return renderHook(() => useEditorActions(), { wrapper }).result.current
}

/** Makes save_markdown_content wait until the returned function is called. */
function holdSave(outcome: 'resolve' | 'reject') {
  let release = () => {}
  globalThis.mockTauri.invoke.mockImplementation((cmd: string) => {
    if (cmd !== 'save_markdown_content') return Promise.resolve(null)
    return new Promise((resolve, reject) => {
      release = () =>
        outcome === 'resolve' ? resolve(null) : reject(new Error('disk full'))
    })
  })
  return () => release()
}

/** Opens another file the way openFile leaves the store, without saving. */
function switchToSecondFile() {
  useEditorStore.setState({
    currentFile: fileEntry('second'),
    editorContent: 'Second file',
    frontmatter: {},
    isDirty: false,
  })
}

describe('useEditorActions.saveFile when the file changes mid-save', () => {
  beforeEach(() => {
    globalThis.mockTauri.reset()
    useProjectStore.setState({ projectPath: '/test' })
    useEditorStore.setState({
      currentFile: fileEntry('first'),
      editorContent: 'First file edit',
      frontmatter: { title: 'First' },
      rawFrontmatter: 'title: First',
      imports: '',
      isDirty: true,
      isFrontmatterDirty: false,
      autoSaveTimeoutId: null,
    })
  })

  it("leaves the newly opened file's state alone", async () => {
    const release = holdSave('resolve')
    const { saveFile } = renderActions()

    const saving = saveFile(false)
    switchToSecondFile()
    release()
    await saving

    expect(useEditorStore.getState().currentFile?.id).toBe('second')
    expect(useEditorStore.getState().isDirty).toBe(false)
  })

  it('keeps recovery data for the file that failed, not the open one', async () => {
    const release = holdSave('reject')
    const { saveFile } = renderActions()

    const saving = saveFile(false)
    switchToSecondFile()
    release()
    await saving

    const recoveryCall = globalThis.mockTauri.invoke.mock.calls.find(
      ([cmd]) => cmd === 'save_recovery_data'
    )
    expect(recoveryCall).toBeDefined()
    const { data: recovery } = recoveryCall![1] as {
      data: { originalFilePath: string; editorContent: string }
    }
    expect(recovery.originalFilePath).toBe('/test/content/blog/first.md')
    expect(recovery.editorContent).toBe('First file edit')
    expect(useEditorStore.getState().isDirty).toBe(false)
  })
})

describe('useEditorActions.saveFile when the same file changes mid-save', () => {
  beforeEach(() => {
    globalThis.mockTauri.reset()
    useProjectStore.setState({ projectPath: '/test' })
    useEditorStore.setState({
      currentFile: fileEntry('first'),
      editorContent: 'Body',
      frontmatter: {},
      rawFrontmatter: '',
      imports: '',
      isDirty: true,
      isFrontmatterDirty: false,
      autoSaveTimeoutId: null,
    })
  })

  it('stays dirty when an import is added during the save', async () => {
    const release = holdSave('resolve')
    const { saveFile } = renderActions()

    const saving = saveFile(false)
    useEditorStore.getState().setImports("import A from './a'")
    release()
    await saving

    // Marked clean, the reload from disk would put back the old imports
    expect(useEditorStore.getState().isDirty).toBe(true)
  })
})

describe('useEditorActions.saveFile with edited frontmatter', () => {
  // The file as first loaded, and as our earlier save rewrote it
  const original = 'title: "Hello"\npubDate: 2024-06-15T14:30:00Z'
  const rewritten = 'title: Hello!\npubDate: 2024-06-15T14:30:00Z\n'
  const loaded = { title: 'Hello', pubDate: '2024-06-15T14:30:00Z' }

  beforeEach(() => {
    globalThis.mockTauri.reset()
    useProjectStore.setState({ projectPath: '/test' })
    useEditorStore.setState({
      currentFile: fileEntry('first'),
      editorContent: 'Body',
      rawFrontmatter: rewritten,
      frontmatterBaseline: { values: loaded, raw: original },
      imports: '',
      isDirty: true,
      isFrontmatterDirty: true,
      autoSaveTimeoutId: null,
    })
  })

  async function save() {
    const { saveFile } = renderActions()
    await saveFile(false)
    const call = globalThis.mockTauri.invoke.mock.calls.find(
      ([cmd]) => cmd === 'save_markdown_content'
    )
    return call![1] as {
      frontmatter: Record<string, unknown> | null
      rawFrontmatter: string | null
    }
  }

  it('writes the original text when the values are back to what was loaded', async () => {
    useEditorStore.setState({ frontmatter: { ...loaded } })

    const args = await save()

    expect(args.frontmatter).toBeNull()
    expect(args.rawFrontmatter).toBe(original)
  })

  it('writes the values when they differ from what was loaded', async () => {
    const edited = { ...loaded, title: 'Hello!' }
    useEditorStore.setState({ frontmatter: edited })

    const args = await save()

    expect(args.frontmatter).toEqual(edited)
    expect(args.rawFrontmatter).toBeNull()
  })
})

describe('useEditorActions.saveFile when saves overlap', () => {
  beforeEach(() => {
    globalThis.mockTauri.reset()
    useProjectStore.setState({ projectPath: '/test' })
    useEditorStore.setState({
      currentFile: fileEntry('first'),
      editorContent: 'Older',
      frontmatter: {},
      rawFrontmatter: '',
      imports: '',
      isDirty: true,
      isFrontmatterDirty: false,
      autoSaveTimeoutId: null,
    })
  })

  it('writes them in the order they were asked for', async () => {
    const written: string[] = []
    let finishFirst = () => {}
    globalThis.mockTauri.invoke.mockImplementation(
      (cmd: string, args?: unknown) => {
        if (cmd !== 'save_markdown_content') return Promise.resolve(null)
        written.push((args as { content: string }).content)
        if (written.length > 1) return Promise.resolve(null)
        return new Promise(resolve => (finishFirst = () => resolve(null)))
      }
    )
    const { saveFile } = renderActions()

    const first = saveFile(false)
    await vi.waitFor(() => expect(written).toEqual(['Older']))
    useEditorStore.setState({ editorContent: 'Newer' })
    const second = saveFile(false)
    await new Promise(resolve => setTimeout(resolve, 0))
    // The newer write waits for the older one to land
    expect(written).toEqual(['Older'])

    finishFirst()
    await Promise.all([first, second])
    expect(written).toEqual(['Older', 'Newer'])
    expect(useEditorStore.getState().isDirty).toBe(false)
  })
})
