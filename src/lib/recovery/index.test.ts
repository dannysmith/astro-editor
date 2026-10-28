import { describe, it, expect, beforeEach, vi } from 'vitest'
import { saveRecoveryData } from '.'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn().mockResolvedValue(undefined),
  error: vi.fn().mockResolvedValue(undefined),
}))

const data = {
  currentFile: {
    path: '/p/src/content/blog/a.md',
    name: 'a.md',
    collection: 'blog',
  },
  projectPath: '/p',
  editorContent: 'Body',
  frontmatter: { title: 'A' },
}

describe('saveRecoveryData', () => {
  beforeEach(() => {
    globalThis.mockTauri.reset()
  })

  it('resolves true when the recovery files are written', async () => {
    globalThis.mockTauri.invoke.mockResolvedValueOnce(null)
    await expect(saveRecoveryData(data)).resolves.toBe(true)
  })

  it('resolves false when the write fails', async () => {
    globalThis.mockTauri.invoke.mockRejectedValueOnce('disk full')
    await expect(saveRecoveryData(data)).resolves.toBe(false)
  })

  it('resolves false without writing when no file is open', async () => {
    await expect(
      saveRecoveryData({ ...data, currentFile: null })
    ).resolves.toBe(false)
    expect(globalThis.mockTauri.invoke).not.toHaveBeenCalled()
  })
})
