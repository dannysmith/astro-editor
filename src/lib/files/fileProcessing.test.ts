import { describe, it, expect, vi, beforeEach } from 'vitest'
import { processFileToAssets } from './fileProcessing'
import type { ProcessFileToAssetsOptions } from './types'
import type { ProjectSettings } from '../project-registry/types'

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
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

import { invoke } from '@tauri-apps/api/core'
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
      vi.mocked(invoke).mockResolvedValue('src/assets/2024-01-15-image.png')
      vi.mocked(getEffectiveAssetsDirectory).mockReturnValue('src/assets')

      const result = await processFileToAssets({
        ...baseOptions,
        copyStrategy: 'always',
      })

      expect(invoke).toHaveBeenCalledWith('copy_file_to_assets', {
        sourcePath: '/Users/test/Downloads/image.png',
        projectPath: '/Users/test/project',
        collection: 'blog',
        currentFilePath: '/Users/test/project/src/content/blog/post.md',
        useRelativePaths: true,
      })
      expect(result).toEqual({
        relativePath: 'src/assets/2024-01-15-image.png',
        wasCopied: true,
        filename: 'image.png',
      })
    })

    it('should copy file to override assets directory', async () => {
      vi.mocked(invoke).mockResolvedValue('custom/assets/2024-01-15-image.png')
      vi.mocked(getEffectiveAssetsDirectory).mockReturnValue('custom/assets')

      const result = await processFileToAssets({
        ...baseOptions,
        copyStrategy: 'always',
      })

      expect(invoke).toHaveBeenCalledWith('copy_file_to_assets_with_override', {
        sourcePath: '/Users/test/Downloads/image.png',
        projectPath: '/Users/test/project',
        collection: 'blog',
        assetsDirectory: 'custom/assets',
        currentFilePath: '/Users/test/project/src/content/blog/post.md',
        useRelativePaths: true,
      })
      expect(result).toEqual({
        relativePath: 'custom/assets/2024-01-15-image.png',
        wasCopied: true,
        filename: 'image.png',
      })
    })

    it('should copy file even if already in project', async () => {
      // With 'always' strategy, we never check if file is in project
      vi.mocked(invoke).mockResolvedValue('src/assets/2024-01-15-existing.png')
      vi.mocked(getEffectiveAssetsDirectory).mockReturnValue('src/assets')

      const result = await processFileToAssets({
        ...baseOptions,
        sourcePath: '/Users/test/project/images/existing.png',
        copyStrategy: 'always',
      })

      // Should call copy_file_to_assets, not is_path_in_project
      expect(invoke).toHaveBeenCalledWith('copy_file_to_assets', {
        sourcePath: '/Users/test/project/images/existing.png',
        projectPath: '/Users/test/project',
        collection: 'blog',
        currentFilePath: '/Users/test/project/src/content/blog/post.md',
        useRelativePaths: true,
      })
      expect(invoke).not.toHaveBeenCalledWith(
        'is_path_in_project',
        expect.anything()
      )
      expect(result.wasCopied).toBe(true)
    })
  })

  describe('only-if-outside-project strategy', () => {
    it('should copy file when outside project', async () => {
      vi.mocked(invoke)
        .mockResolvedValueOnce(false) // is_path_in_project returns false
        .mockResolvedValueOnce('src/assets/2024-01-15-image.png') // copy_file_to_assets returns path
      vi.mocked(getEffectiveAssetsDirectory).mockReturnValue('src/assets')

      const result = await processFileToAssets({
        ...baseOptions,
        copyStrategy: 'only-if-outside-project',
      })

      expect(invoke).toHaveBeenNthCalledWith(1, 'is_path_in_project', {
        filePath: '/Users/test/Downloads/image.png',
        projectPath: '/Users/test/project',
      })
      expect(invoke).toHaveBeenNthCalledWith(2, 'copy_file_to_assets', {
        sourcePath: '/Users/test/Downloads/image.png',
        projectPath: '/Users/test/project',
        collection: 'blog',
        currentFilePath: '/Users/test/project/src/content/blog/post.md',
        useRelativePaths: true,
      })
      expect(result).toEqual({
        relativePath: 'src/assets/2024-01-15-image.png',
        wasCopied: true,
        filename: 'image.png',
      })
    })

    it('should reuse existing path when file is in project', async () => {
      vi.mocked(invoke)
        .mockResolvedValueOnce(true) // is_path_in_project returns true
        .mockResolvedValueOnce('images/existing.png') // get_relative_path returns path
      vi.mocked(getEffectiveAssetsDirectory).mockReturnValue('src/assets')

      const result = await processFileToAssets({
        ...baseOptions,
        sourcePath: '/Users/test/project/images/existing.png',
        copyStrategy: 'only-if-outside-project',
      })

      expect(invoke).toHaveBeenNthCalledWith(1, 'is_path_in_project', {
        filePath: '/Users/test/project/images/existing.png',
        projectPath: '/Users/test/project',
      })
      expect(invoke).toHaveBeenNthCalledWith(2, 'get_relative_path', {
        filePath: '/Users/test/project/images/existing.png',
        projectPath: '/Users/test/project',
        currentFilePath: '/Users/test/project/src/content/blog/post.md',
        useRelativePaths: true,
      })
      expect(invoke).not.toHaveBeenCalledWith(
        'copy_file_to_assets',
        expect.anything()
      )
      expect(result).toEqual({
        relativePath: 'images/existing.png',
        wasCopied: false,
        filename: 'existing.png',
      })
    })

    it('should use override assets directory when copying from outside project', async () => {
      vi.mocked(invoke)
        .mockResolvedValueOnce(false) // is_path_in_project returns false
        .mockResolvedValueOnce('custom/assets/2024-01-15-image.png') // copy returns path
      vi.mocked(getEffectiveAssetsDirectory).mockReturnValue('custom/assets')

      const result = await processFileToAssets({
        ...baseOptions,
        copyStrategy: 'only-if-outside-project',
      })

      expect(invoke).toHaveBeenCalledWith('copy_file_to_assets_with_override', {
        sourcePath: '/Users/test/Downloads/image.png',
        projectPath: '/Users/test/project',
        collection: 'blog',
        assetsDirectory: 'custom/assets',
        currentFilePath: '/Users/test/project/src/content/blog/post.md',
        useRelativePaths: true,
      })
      expect(result.wasCopied).toBe(true)
    })
  })

  describe('path formatting', () => {
    it('should return path in format provided by Rust (relative)', async () => {
      vi.mocked(invoke).mockResolvedValue('../../assets/2024-01-15-image.png')
      vi.mocked(getEffectiveAssetsDirectory).mockReturnValue('src/assets')

      const result = await processFileToAssets({
        ...baseOptions,
        useRelativePaths: true,
        copyStrategy: 'always',
      })

      expect(result.relativePath).toBe('../../assets/2024-01-15-image.png')
    })

    it('should return path in format provided by Rust (absolute)', async () => {
      vi.mocked(invoke).mockResolvedValue('/src/assets/2024-01-15-image.png')
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
      vi.mocked(invoke).mockResolvedValue('src/assets/2024-01-15-image.png')
      vi.mocked(getEffectiveAssetsDirectory).mockReturnValue('src/assets')

      const result = await processFileToAssets({
        ...baseOptions,
        sourcePath: '/Users/test/Downloads/image.png',
        copyStrategy: 'always',
      })

      expect(result.filename).toBe('image.png')
    })

    it('should extract filename from Windows path', async () => {
      vi.mocked(invoke).mockResolvedValue('src/assets/2024-01-15-document.pdf')
      vi.mocked(getEffectiveAssetsDirectory).mockReturnValue('src/assets')

      const result = await processFileToAssets({
        ...baseOptions,
        sourcePath: 'C:\\Users\\test\\Downloads\\document.pdf',
        copyStrategy: 'always',
      })

      expect(result.filename).toBe('document.pdf')
    })

    it('should handle path with no directory separators', async () => {
      vi.mocked(invoke).mockResolvedValue('src/assets/2024-01-15-file.txt')
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
    it('should throw error when is_path_in_project fails', async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error('Failed to check path'))

      await expect(
        processFileToAssets({
          ...baseOptions,
          copyStrategy: 'only-if-outside-project',
        })
      ).rejects.toThrow('Failed to check path')
    })

    it('should throw error when copy_file_to_assets fails', async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error('Failed to copy file'))
      vi.mocked(getEffectiveAssetsDirectory).mockReturnValue('src/assets')

      await expect(
        processFileToAssets({
          ...baseOptions,
          copyStrategy: 'always',
        })
      ).rejects.toThrow('Failed to copy file')
    })

    it('should throw error when get_relative_path fails', async () => {
      vi.mocked(invoke)
        .mockResolvedValueOnce(true) // is_path_in_project succeeds
        .mockRejectedValueOnce(new Error('Failed to get relative path')) // get_relative_path fails

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
      vi.mocked(invoke).mockResolvedValue('src/assets/2024-01-15-image.png')
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
      vi.mocked(invoke).mockResolvedValue('src/assets/2024-01-15-image.png')
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
      vi.mocked(invoke).mockResolvedValue('src/assets/2024-01-15-image.png')
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
