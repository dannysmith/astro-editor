import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  isImageFile,
  extractFilename,
  formatAsMarkdown,
  processDroppedFile,
  processDroppedFiles,
  IMAGE_EXTENSIONS,
} from './fileProcessing'

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

// Mock project store
vi.mock('../../../store/projectStore', () => ({
  useProjectStore: {
    getState: vi.fn(() => ({
      currentProjectSettings: null, // Use defaults (no overrides)
    })),
  },
}))

// Mock path resolution to return default assets directory
vi.mock('../../project-registry', () => ({
  getEffectiveAssetsDirectory: vi.fn(() => 'src/assets'),
}))

const mockInvoke = vi.mocked(await import('@tauri-apps/api/core')).invoke

describe('File Processing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('IMAGE_EXTENSIONS', () => {
    it('should include common image extensions', () => {
      expect(IMAGE_EXTENSIONS).toContain('.png')
      expect(IMAGE_EXTENSIONS).toContain('.jpg')
      expect(IMAGE_EXTENSIONS).toContain('.jpeg')
      expect(IMAGE_EXTENSIONS).toContain('.gif')
      expect(IMAGE_EXTENSIONS).toContain('.webp')
      expect(IMAGE_EXTENSIONS).toContain('.svg')
      expect(IMAGE_EXTENSIONS).toContain('.bmp')
      expect(IMAGE_EXTENSIONS).toContain('.ico')
    })
  })

  describe('isImageFile', () => {
    it('should return true for image files', () => {
      expect(isImageFile('image.png')).toBe(true)
      expect(isImageFile('photo.jpg')).toBe(true)
      expect(isImageFile('avatar.jpeg')).toBe(true)
      expect(isImageFile('icon.gif')).toBe(true)
      expect(isImageFile('logo.webp')).toBe(true)
      expect(isImageFile('graphic.svg')).toBe(true)
      expect(isImageFile('bitmap.bmp')).toBe(true)
      expect(isImageFile('favicon.ico')).toBe(true)
    })

    it('should return false for non-image files', () => {
      expect(isImageFile('document.txt')).toBe(false)
      expect(isImageFile('script.js')).toBe(false)
      expect(isImageFile('style.css')).toBe(false)
      expect(isImageFile('data.json')).toBe(false)
      expect(isImageFile('readme.md')).toBe(false)
      expect(isImageFile('archive.zip')).toBe(false)
    })

    it('should be case insensitive', () => {
      expect(isImageFile('IMAGE.PNG')).toBe(true)
      expect(isImageFile('Photo.JPG')).toBe(true)
      expect(isImageFile('Icon.GIF')).toBe(true)
      expect(isImageFile('Logo.WEBP')).toBe(true)
    })

    it('should handle files without extensions', () => {
      expect(isImageFile('filename')).toBe(false)
      expect(isImageFile('readme')).toBe(false)
    })

    it('should handle empty filenames', () => {
      expect(isImageFile('')).toBe(false)
    })

    it('should handle complex filenames', () => {
      expect(isImageFile('my-image.final.v2.png')).toBe(true)
      expect(isImageFile('document.backup.txt')).toBe(false)
    })
  })

  describe('extractFilename', () => {
    it('should extract filename from Unix path', () => {
      expect(extractFilename('/home/user/documents/file.txt')).toBe('file.txt')
      expect(extractFilename('/path/to/image.png')).toBe('image.png')
    })

    it('should extract filename from Windows path', () => {
      expect(extractFilename('C:\\Users\\User\\Documents\\file.txt')).toBe(
        'file.txt'
      )
      expect(extractFilename('D:\\Images\\photo.jpg')).toBe('photo.jpg')
    })

    it('should handle mixed path separators', () => {
      expect(extractFilename('/home/user\\documents/file.txt')).toBe('file.txt')
      expect(extractFilename('C:\\path/to\\file.png')).toBe('file.png')
    })

    it('should handle filename without path', () => {
      expect(extractFilename('file.txt')).toBe('file.txt')
      expect(extractFilename('image.png')).toBe('image.png')
    })

    it('should handle empty string', () => {
      expect(extractFilename('')).toBe('')
    })

    it('should handle path ending with separator', () => {
      expect(extractFilename('/path/to/directory/')).toBe('')
      expect(extractFilename('C:\\path\\to\\directory\\')).toBe('')
    })

    it('should handle complex filenames', () => {
      expect(extractFilename('/path/to/my-file.final.v2.txt')).toBe(
        'my-file.final.v2.txt'
      )
      expect(extractFilename('C:\\Users\\User\\my file (1).png')).toBe(
        'my file (1).png'
      )
    })
  })

  describe('formatAsMarkdown', () => {
    it('should format image as markdown image', () => {
      const result = formatAsMarkdown('image.png', '/assets/image.png', true)
      expect(result).toBe('![image.png](/assets/image.png)')
    })

    it('should format non-image as markdown link', () => {
      const result = formatAsMarkdown(
        'document.pdf',
        '/assets/document.pdf',
        false
      )
      expect(result).toBe('[document.pdf](/assets/document.pdf)')
    })

    it('should handle special characters in filename', () => {
      const result = formatAsMarkdown(
        'my file (1).png',
        '/assets/my file (1).png',
        true
      )
      expect(result).toBe('![my file (1).png](/assets/my file (1).png)')
    })

    it('should handle empty filename', () => {
      const result = formatAsMarkdown('', '/assets/file', true)
      expect(result).toBe('![](/assets/file)')
    })

    it('should handle complex paths', () => {
      const result = formatAsMarkdown(
        'file.txt',
        '/assets/docs/2023/file.txt',
        false
      )
      expect(result).toBe('[file.txt](/assets/docs/2023/file.txt)')
    })
  })

  describe('processDroppedFile', () => {
    it('should process image file successfully', async () => {
      const mockNewPath = 'assets/collection/image.png'
      mockInvoke.mockResolvedValue(mockNewPath)

      const result = await processDroppedFile(
        '/path/to/image.png',
        '/project/path',
        'collection'
      )

      expect(result).toEqual({
        originalPath: '/path/to/image.png',
        filename: 'image.png',
        isImage: true,
        markdownText: '![image.png](/assets/collection/image.png)',
      })

      expect(mockInvoke).toHaveBeenCalledWith('copy_file_to_assets', {
        sourcePath: '/path/to/image.png',
        projectPath: '/project/path',
        collection: 'collection',
      })
    })

    it('should process non-image file successfully', async () => {
      const mockNewPath = 'assets/collection/document.pdf'
      mockInvoke.mockResolvedValue(mockNewPath)

      const result = await processDroppedFile(
        '/path/to/document.pdf',
        '/project/path',
        'collection'
      )

      expect(result).toEqual({
        originalPath: '/path/to/document.pdf',
        filename: 'document.pdf',
        isImage: false,
        markdownText: '[document.pdf](/assets/collection/document.pdf)',
      })
    })

    it('should handle copy failure gracefully', async () => {
      mockInvoke.mockRejectedValue(new Error('Copy failed'))

      const result = await processDroppedFile(
        '/path/to/image.png',
        '/project/path',
        'collection'
      )

      expect(result).toEqual({
        originalPath: '/path/to/image.png',
        filename: 'image.png',
        isImage: true,
        markdownText: '![image.png](/path/to/image.png)',
      })
    })

    it('should handle Windows paths', async () => {
      const mockNewPath = 'assets/collection/file.txt'
      mockInvoke.mockResolvedValue(mockNewPath)

      const result = await processDroppedFile(
        'C:\\Users\\User\\file.txt',
        'C:\\Projects\\Blog',
        'collection'
      )

      expect(result).toEqual({
        originalPath: 'C:\\Users\\User\\file.txt',
        filename: 'file.txt',
        isImage: false,
        markdownText: '[file.txt](/assets/collection/file.txt)',
      })
    })

    it('should handle complex filenames', async () => {
      const mockNewPath = 'assets/collection/my-file.final.v2.png'
      mockInvoke.mockResolvedValue(mockNewPath)

      const result = await processDroppedFile(
        '/path/to/my-file.final.v2.png',
        '/project/path',
        'collection'
      )

      expect(result).toEqual({
        originalPath: '/path/to/my-file.final.v2.png',
        filename: 'my-file.final.v2.png',
        isImage: true,
        markdownText:
          '![my-file.final.v2.png](/assets/collection/my-file.final.v2.png)',
      })
    })
  })

  describe('processDroppedFiles', () => {
    it('should process multiple files successfully', async () => {
      mockInvoke
        .mockResolvedValueOnce('assets/collection/image.png')
        .mockResolvedValueOnce('assets/collection/document.pdf')

      const result = await processDroppedFiles(
        ['/path/to/image.png', '/path/to/document.pdf'],
        '/project/path',
        'collection'
      )

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        originalPath: '/path/to/image.png',
        filename: 'image.png',
        isImage: true,
        markdownText: '![image.png](/assets/collection/image.png)',
      })
      expect(result[1]).toEqual({
        originalPath: '/path/to/document.pdf',
        filename: 'document.pdf',
        isImage: false,
        markdownText: '[document.pdf](/assets/collection/document.pdf)',
      })
    })

    it('should handle empty array', async () => {
      const result = await processDroppedFiles(
        [],
        '/project/path',
        'collection'
      )
      expect(result).toHaveLength(0)
    })

    it('should handle mix of successes and failures', async () => {
      mockInvoke
        .mockResolvedValueOnce('assets/collection/image.png')
        .mockRejectedValueOnce(new Error('Copy failed'))

      const result = await processDroppedFiles(
        ['/path/to/image.png', '/path/to/document.pdf'],
        '/project/path',
        'collection'
      )

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        originalPath: '/path/to/image.png',
        filename: 'image.png',
        isImage: true,
        markdownText: '![image.png](/assets/collection/image.png)',
      })
      expect(result[1]).toEqual({
        originalPath: '/path/to/document.pdf',
        filename: 'document.pdf',
        isImage: false,
        markdownText: '[document.pdf](/path/to/document.pdf)',
      })
    })

    it('should process many files concurrently', async () => {
      const filePaths = Array.from(
        { length: 10 },
        (_, i) => `/path/to/file${i}.txt`
      )
      mockInvoke.mockImplementation((_, args) => {
        const { sourcePath } = args as { sourcePath: string }
        const filename = sourcePath.split('/').pop()
        return Promise.resolve(`assets/collection/${filename}`)
      })

      const result = await processDroppedFiles(
        filePaths,
        '/project/path',
        'collection'
      )

      expect(result).toHaveLength(10)
      expect(mockInvoke).toHaveBeenCalledTimes(10)

      // Verify all files were processed
      filePaths.forEach((path, index) => {
        expect(result[index]?.originalPath).toBe(path)
        expect(result[index]?.filename).toBe(`file${index}.txt`)
      })
    })
  })
})
