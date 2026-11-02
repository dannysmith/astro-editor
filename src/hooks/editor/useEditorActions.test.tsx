import React from 'react'
import { describe, it, expect, beforeEach } from 'vitest'
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
