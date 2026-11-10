import { beforeEach, describe, expect, it } from 'vitest'
import { queryClient } from '@/lib/query-client'
import { queryKeys } from '@/lib/query-keys'
import { useProjectStore } from '../../store/projectStore'
import { makeCollection, makeScan } from '../../test/fixtures'
import { fetchCollectionFiles } from './useCollectionFilesQuery'

describe('fetchCollectionFiles', () => {
  beforeEach(() => {
    globalThis.mockTauri.reset()
    globalThis.mockTauri.invoke.mockResolvedValue([])
    useProjectStore.setState({ projectPath: '/site' })
  })

  it('lists the collection as the latest scan has it', async () => {
    const before = makeCollection({ name: 'blog' })
    const after = { ...before, path: '/site/writing/blog' }
    queryClient.setQueryData(queryKeys.collections('/site'), makeScan([after]))

    await fetchCollectionFiles(before)
    expect(globalThis.mockTauri.invoke).toHaveBeenCalledWith(
      'scan_collection_files_recursive',
      { collection: after }
    )
  })
})
