import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePreferences } from './usePreferences'
import { useProjectStore } from '../store/projectStore'
import type { ProjectSettingsData } from '@/lib/bindings'

describe('usePreferences', () => {
  const updateProjectSettings =
    vi.fn<(settings: ProjectSettingsData) => Promise<void>>()

  beforeEach(() => {
    updateProjectSettings.mockReset().mockResolvedValue(undefined)
    useProjectStore.setState({
      currentProjectId: 'site-1234',
      projectSettings: {
        project: { assetsDirectory: 'src/images' },
        collections: {
          blog: { draftField: 'unpublished', urlPattern: '/blog/{slug}' },
          notes: { titleField: 'name' },
        },
      },
      updateProjectSettings,
    })
  })

  it('stores only the collection settings that are set', async () => {
    const { result } = renderHook(() => usePreferences())
    await result.current.updateCollectionSettings('blog', {
      urlPattern: '',
      folder: 'content/posts',
    })
    expect(updateProjectSettings).toHaveBeenCalledWith({
      project: { assetsDirectory: 'src/images' },
      collections: {
        blog: { draftField: 'unpublished', folder: 'content/posts' },
        notes: { titleField: 'name' },
      },
    })
  })

  it('drops a collection once nothing is set for it', async () => {
    const { result } = renderHook(() => usePreferences())
    await result.current.updateCollectionSettings('notes', {
      titleField: undefined,
    })
    expect(updateProjectSettings.mock.calls[0]?.[0].collections).toEqual({
      blog: { draftField: 'unpublished', urlPattern: '/blog/{slug}' },
    })
  })

  it('unsets a project setting', async () => {
    const { result } = renderHook(() => usePreferences())
    await result.current.updateProject({ assetsDirectory: undefined })
    expect(updateProjectSettings.mock.calls[0]?.[0].project).toEqual({})
  })
})
