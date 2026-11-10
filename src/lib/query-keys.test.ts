import { describe, expect, it } from 'vitest'
import { isFileListing, queryKeys } from './query-keys'

describe('isFileListing', () => {
  const site = '/site'

  it('matches every key that lists files, and nothing else', () => {
    const listings = [
      queryKeys.collectionFiles(site, 'blog'),
      queryKeys.directoryContents(site, 'blog', 'root'),
      queryKeys.directoryContents(site, 'blog', '2024/january'),
      queryKeys.collectionCounts(site),
    ]
    const others = [
      queryKeys.collections(site),
      queryKeys.fileContent(site, 'blog/post'),
      queryKeys.mdxComponents(site, ['src/components/mdx']),
      queryKeys.fileBasedCollection(site, 'authors'),
      queryKeys.projectDependencies(site),
      queryKeys.imageSrc(site, null, 'cover.jpg'),
      queryKeys.projectList,
      queryKeys.appVersion,
    ]

    for (const key of listings) expect(isFileListing(key, site)).toBe(true)
    for (const key of others) expect(isFileListing(key, site)).toBe(false)
  })

  it("doesn't match another project's listings", () => {
    expect(isFileListing(queryKeys.collectionCounts(site), '/other')).toBe(
      false
    )
  })
})
