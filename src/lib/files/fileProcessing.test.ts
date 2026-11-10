import { describe, it, expect, vi, beforeEach } from 'vitest'
import { processFileToAssets } from './fileProcessing'
import type { ProcessFileToAssetsOptions } from './types'

// Mock typed commands from bindings
vi.mock('@/lib/bindings', () => ({
  commands: {
    isPathInProject: vi.fn(),
    copyFileToAssets: vi.fn(),
    getRelativePath: vi.fn(),
  },
}))

import { commands } from '@/lib/bindings'

describe('processFileToAssets', () => {
  const baseOptions: ProcessFileToAssetsOptions = {
    sourcePath: '/Users/test/Downloads/image.png',
    projectPath: '/Users/test/project',
    collection: 'blog',
    assetsDirectory: 'src/assets',
    copyStrategy: 'always',
    currentFilePath: '/Users/test/project/src/content/blog/post.md',
    useRelativePaths: true,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('always copy strategy', () => {
    it('should copy file to default assets directory', async () => {
      vi.mocked(commands.copyFileToAssets).mockResolvedValue({
        status: 'ok',
        data: 'src/assets/2024-01-15-image.png',
      })

      const result = await processFileToAssets({
        ...baseOptions,
        copyStrategy: 'always',
      })

      expect(commands.copyFileToAssets).toHaveBeenCalledWith(
        '/Users/test/Downloads/image.png',
        '/Users/test/project',
        'blog',
        'src/assets',
        '/Users/test/project/src/content/blog/post.md',
        true
      )
      expect(result).toEqual({
        relativePath: 'src/assets/2024-01-15-image.png',
        wasCopied: true,
        filename: 'image.png',
      })
    })

    it('should copy file to override assets directory', async () => {
      vi.mocked(commands.copyFileToAssets).mockResolvedValue({
        status: 'ok',
        data: 'custom/assets/2024-01-15-image.png',
      })

      const result = await processFileToAssets({
        ...baseOptions,
        assetsDirectory: 'custom/assets',
        copyStrategy: 'always',
      })

      expect(commands.copyFileToAssets).toHaveBeenCalledWith(
        '/Users/test/Downloads/image.png',
        '/Users/test/project',
        'blog',
        'custom/assets',
        '/Users/test/project/src/content/blog/post.md',
        true
      )
      expect(result).toEqual({
        relativePath: 'custom/assets/2024-01-15-image.png',
        wasCopied: true,
        filename: 'image.png',
      })
    })

    it('should copy file even if already in project', async () => {
      // With 'always' strategy, we never check if file is in project
      vi.mocked(commands.copyFileToAssets).mockResolvedValue({
        status: 'ok',
        data: 'src/assets/2024-01-15-existing.png',
      })

      const result = await processFileToAssets({
        ...baseOptions,
        sourcePath: '/Users/test/project/images/existing.png',
        copyStrategy: 'always',
      })

      // Should call copyFileToAssets, not isPathInProject
      expect(commands.copyFileToAssets).toHaveBeenCalledWith(
        '/Users/test/project/images/existing.png',
        '/Users/test/project',
        'blog',
        'src/assets',
        '/Users/test/project/src/content/blog/post.md',
        true
      )
      expect(commands.isPathInProject).not.toHaveBeenCalled()
      expect(result.wasCopied).toBe(true)
    })
  })

  describe('only-if-outside-project strategy', () => {
    it('should copy file when outside project', async () => {
      vi.mocked(commands.isPathInProject).mockResolvedValue(false)
      vi.mocked(commands.copyFileToAssets).mockResolvedValue({
        status: 'ok',
        data: 'src/assets/2024-01-15-image.png',
      })

      const result = await processFileToAssets({
        ...baseOptions,
        copyStrategy: 'only-if-outside-project',
      })

      expect(commands.isPathInProject).toHaveBeenCalledWith(
        '/Users/test/Downloads/image.png',
        '/Users/test/project'
      )
      expect(commands.copyFileToAssets).toHaveBeenCalledWith(
        '/Users/test/Downloads/image.png',
        '/Users/test/project',
        'blog',
        'src/assets',
        '/Users/test/project/src/content/blog/post.md',
        true
      )
      expect(result).toEqual({
        relativePath: 'src/assets/2024-01-15-image.png',
        wasCopied: true,
        filename: 'image.png',
      })
    })

    it('should reuse existing path when file is in project', async () => {
      vi.mocked(commands.isPathInProject).mockResolvedValue(true)
      vi.mocked(commands.getRelativePath).mockResolvedValue({
        status: 'ok',
        data: 'images/existing.png',
      })

      const result = await processFileToAssets({
        ...baseOptions,
        sourcePath: '/Users/test/project/images/existing.png',
        copyStrategy: 'only-if-outside-project',
      })

      expect(commands.isPathInProject).toHaveBeenCalledWith(
        '/Users/test/project/images/existing.png',
        '/Users/test/project'
      )
      expect(commands.getRelativePath).toHaveBeenCalledWith(
        '/Users/test/project/images/existing.png',
        '/Users/test/project',
        '/Users/test/project/src/content/blog/post.md',
        true
      )
      expect(commands.copyFileToAssets).not.toHaveBeenCalled()
      expect(result).toEqual({
        relativePath: 'images/existing.png',
        wasCopied: false,
        filename: 'existing.png',
      })
    })

    it('should use override assets directory when copying from outside project', async () => {
      vi.mocked(commands.isPathInProject).mockResolvedValue(false)
      vi.mocked(commands.copyFileToAssets).mockResolvedValue({
        status: 'ok',
        data: 'custom/assets/2024-01-15-image.png',
      })

      const result = await processFileToAssets({
        ...baseOptions,
        assetsDirectory: 'custom/assets',
        copyStrategy: 'only-if-outside-project',
      })

      expect(commands.copyFileToAssets).toHaveBeenCalledWith(
        '/Users/test/Downloads/image.png',
        '/Users/test/project',
        'blog',
        'custom/assets',
        '/Users/test/project/src/content/blog/post.md',
        true
      )
      expect(result.wasCopied).toBe(true)
    })
  })

  describe('path formatting', () => {
    it('should return path in format provided by Rust (relative)', async () => {
      vi.mocked(commands.copyFileToAssets).mockResolvedValue({
        status: 'ok',
        data: '../../assets/2024-01-15-image.png',
      })

      const result = await processFileToAssets({
        ...baseOptions,
        useRelativePaths: true,
        copyStrategy: 'always',
      })

      expect(result.relativePath).toBe('../../assets/2024-01-15-image.png')
    })

    it('should return path in format provided by Rust (absolute)', async () => {
      vi.mocked(commands.copyFileToAssets).mockResolvedValue({
        status: 'ok',
        data: '/src/assets/2024-01-15-image.png',
      })

      const result = await processFileToAssets({
        ...baseOptions,
        useRelativePaths: false,
        copyStrategy: 'always',
      })

      expect(result.relativePath).toBe('/src/assets/2024-01-15-image.png')
    })
  })

  describe('filename extraction', () => {
    it('should extract filename from Unix path', async () => {
      vi.mocked(commands.copyFileToAssets).mockResolvedValue({
        status: 'ok',
        data: 'src/assets/2024-01-15-image.png',
      })

      const result = await processFileToAssets({
        ...baseOptions,
        sourcePath: '/Users/test/Downloads/image.png',
        copyStrategy: 'always',
      })

      expect(result.filename).toBe('image.png')
    })

    it('should extract filename from Windows path', async () => {
      vi.mocked(commands.copyFileToAssets).mockResolvedValue({
        status: 'ok',
        data: 'src/assets/2024-01-15-document.pdf',
      })

      const result = await processFileToAssets({
        ...baseOptions,
        sourcePath: 'C:\\Users\\test\\Downloads\\document.pdf',
        copyStrategy: 'always',
      })

      expect(result.filename).toBe('document.pdf')
    })

    it('should handle path with no directory separators', async () => {
      vi.mocked(commands.copyFileToAssets).mockResolvedValue({
        status: 'ok',
        data: 'src/assets/2024-01-15-file.txt',
      })

      const result = await processFileToAssets({
        ...baseOptions,
        sourcePath: 'file.txt',
        copyStrategy: 'always',
      })

      expect(result.filename).toBe('file.txt')
    })
  })

  describe('error handling', () => {
    it('should throw error when isPathInProject fails', async () => {
      vi.mocked(commands.isPathInProject).mockRejectedValue(
        new Error('Failed to check path')
      )

      await expect(
        processFileToAssets({
          ...baseOptions,
          copyStrategy: 'only-if-outside-project',
        })
      ).rejects.toThrow('Failed to check path')
    })

    it('should throw error when copyFileToAssets returns error', async () => {
      vi.mocked(commands.copyFileToAssets).mockResolvedValue({
        status: 'error',
        error: 'Failed to copy file',
      })

      await expect(
        processFileToAssets({
          ...baseOptions,
          copyStrategy: 'always',
        })
      ).rejects.toThrow('Failed to copy file')
    })

    it('should throw error when getRelativePath returns error', async () => {
      vi.mocked(commands.isPathInProject).mockResolvedValue(true)
      vi.mocked(commands.getRelativePath).mockResolvedValue({
        status: 'error',
        error: 'Failed to get relative path',
      })

      await expect(
        processFileToAssets({
          ...baseOptions,
          copyStrategy: 'only-if-outside-project',
        })
      ).rejects.toThrow('Failed to get relative path')
    })
  })
})
