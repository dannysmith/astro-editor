/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { processFileToAssets } from './fileProcessing'
import type { ProcessFileToAssetsOptions } from './types'
import type { ProjectSettings } from '../project-registry/types'

// Mock typed commands from bindings
vi.mock('@/lib/bindings', () => ({
  commands: {
    isPathInProject: vi.fn(),
    copyFileToAssets: vi.fn(),
    copyFileToAssetsWithOverride: vi.fn(),
    getRelativePath: vi.fn(),
  },
}))

// Mock path resolution utilities
vi.mock('../project-registry', () => ({
  getEffectiveAssetsDirectory: vi.fn(),
}))

// Mock constants
vi.mock('../constants', () => ({
  ASTRO_PATHS: {
    ASSETS_DIR: 'src/assets',
  },
}))

import { commands } from '@/lib/bindings'
import { getEffectiveAssetsDirectory } from '../project-registry'

describe('processFileToAssets', () => {
  const mockProjectSettings: ProjectSettings = {
    pathOverrides: {},
    frontmatterMappings: {},
  }

  const baseOptions: ProcessFileToAssetsOptions = {
    sourcePath: '/Users/test/Downloads/image.png',
    projectPath: '/Users/test/project',
    collection: 'blog',
    projectSettings: mockProjectSettings,
    copyStrategy: 'always',
    currentFilePath: '/Users/test/project/src/content/blog/post.md',
    useRelativePaths: true,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getEffectiveAssetsDirectory).mockReturnValue('src/assets')
  })

  describe('always copy strategy', () => {
    it('should copy file to default assets directory', async () => {
      vi.mocked(commands.copyFileToAssets).mockResolvedValue({
        status: 'ok',
        data: 'src/assets/2024-01-15-image.png',
      })
      vi.mocked(getEffectiveAssetsDirectory).mockReturnValue('src/assets')

      const result = await processFileToAssets({
        ...baseOptions,
        copyStrategy: 'always',
      })

      expect(commands.copyFileToAssets).toHaveBeenCalledWith(
        '/Users/test/Downloads/image.png',
        '/Users/test/project',
        'blog',
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
      vi.mocked(commands.copyFileToAssetsWithOverride).mockResolvedValue({
        status: 'ok',
        data: 'custom/assets/2024-01-15-image.png',
      })
      vi.mocked(getEffectiveAssetsDirectory).mockReturnValue('custom/assets')

      const result = await processFileToAssets({
        ...baseOptions,
        copyStrategy: 'always',
      })

      expect(commands.copyFileToAssetsWithOverride).toHaveBeenCalledWith(
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
      vi.mocked(getEffectiveAssetsDirectory).mockReturnValue('src/assets')

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
      vi.mocked(getEffectiveAssetsDirectory).mockReturnValue('src/assets')

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
      vi.mocked(getEffectiveAssetsDirectory).mockReturnValue('src/assets')

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
      vi.mocked(commands.copyFileToAssetsWithOverride).mockResolvedValue({
        status: 'ok',
        data: 'custom/assets/2024-01-15-image.png',
      })
      vi.mocked(getEffectiveAssetsDirectory).mockReturnValue('custom/assets')

      const result = await processFileToAssets({
        ...baseOptions,
        copyStrategy: 'only-if-outside-project',
      })

      expect(commands.copyFileToAssetsWithOverride).toHaveBeenCalledWith(
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
      vi.mocked(getEffectiveAssetsDirectory).mockReturnValue('src/assets')

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
      vi.mocked(getEffectiveAssetsDirectory).mockReturnValue('src/assets')

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
      vi.mocked(getEffectiveAssetsDirectory).mockReturnValue('src/assets')

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
      vi.mocked(getEffectiveAssetsDirectory).mockReturnValue('src/assets')

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
      vi.mocked(getEffectiveAssetsDirectory).mockReturnValue('src/assets')

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
      vi.mocked(getEffectiveAssetsDirectory).mockReturnValue('src/assets')

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

  describe('project settings handling', () => {
    it('should work with null project settings', async () => {
      vi.mocked(commands.copyFileToAssets).mockResolvedValue({
        status: 'ok',
        data: 'src/assets/2024-01-15-image.png',
      })
      vi.mocked(getEffectiveAssetsDirectory).mockReturnValue('src/assets')

      const result = await processFileToAssets({
        ...baseOptions,
        projectSettings: null,
        copyStrategy: 'always',
      })

      expect(getEffectiveAssetsDirectory).toHaveBeenCalledWith(null, 'blog')
      expect(result.wasCopied).toBe(true)
    })

    it('should work with undefined project settings', async () => {
      vi.mocked(commands.copyFileToAssets).mockResolvedValue({
        status: 'ok',
        data: 'src/assets/2024-01-15-image.png',
      })
      vi.mocked(getEffectiveAssetsDirectory).mockReturnValue('src/assets')

      const result = await processFileToAssets({
        ...baseOptions,
        projectSettings: undefined,
        copyStrategy: 'always',
      })

      expect(getEffectiveAssetsDirectory).toHaveBeenCalledWith(
        undefined,
        'blog'
      )
      expect(result.wasCopied).toBe(true)
    })

    it('should pass collection to getEffectiveAssetsDirectory', async () => {
      vi.mocked(commands.copyFileToAssets).mockResolvedValue({
        status: 'ok',
        data: 'src/assets/2024-01-15-image.png',
      })
      vi.mocked(getEffectiveAssetsDirectory).mockReturnValue('src/assets')

      await processFileToAssets({
        ...baseOptions,
        collection: 'posts',
        copyStrategy: 'always',
      })

      expect(getEffectiveAssetsDirectory).toHaveBeenCalledWith(
        mockProjectSettings,
        'posts'
      )
    })
  })
})
