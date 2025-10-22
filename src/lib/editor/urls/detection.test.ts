import { describe, it, expect } from 'vitest'
import {
  findUrlsInText,
  isValidUrl,
  urlRegex,
  isImageUrl,
  findImageUrlsInText,
} from './detection'

describe('URL Detection', () => {
  describe('urlRegex', () => {
    it('should match valid HTTP URLs', () => {
      expect(urlRegex.test('http://example.com')).toBe(true)
      expect(urlRegex.test('http://example.com/path')).toBe(true)
      expect(urlRegex.test('http://example.com/path?query=1')).toBe(true)
      expect(urlRegex.test('http://example.com/path#anchor')).toBe(true)
    })

    it('should match valid HTTPS URLs', () => {
      expect(urlRegex.test('https://example.com')).toBe(true)
      expect(urlRegex.test('https://example.com/path')).toBe(true)
      expect(urlRegex.test('https://example.com/path?query=1')).toBe(true)
      expect(urlRegex.test('https://example.com/path#anchor')).toBe(true)
    })

    it('should not match invalid URLs', () => {
      expect(urlRegex.test('ftp://example.com')).toBe(false)
      expect(urlRegex.test('example.com')).toBe(false)
      expect(urlRegex.test('www.example.com')).toBe(false)
      expect(urlRegex.test('javascript:alert(1)')).toBe(false)
      expect(urlRegex.test('mailto:user@example.com')).toBe(false)
    })

    it('should not match URLs with whitespace', () => {
      expect(urlRegex.test('http://example.com with spaces')).toBe(false)
      expect(urlRegex.test(' http://example.com')).toBe(false)
      expect(urlRegex.test('http://example.com ')).toBe(false)
    })
  })

  describe('isValidUrl', () => {
    it('should return true for valid URLs', () => {
      expect(isValidUrl('http://example.com')).toBe(true)
      expect(isValidUrl('https://example.com')).toBe(true)
      expect(isValidUrl('https://example.com/path')).toBe(true)
    })

    it('should return false for invalid URLs', () => {
      expect(isValidUrl('example.com')).toBe(false)
      expect(isValidUrl('ftp://example.com')).toBe(false)
      expect(isValidUrl('not a url')).toBe(false)
      expect(isValidUrl('')).toBe(false)
    })

    it('should handle URLs with whitespace', () => {
      expect(isValidUrl(' http://example.com ')).toBe(true)
      expect(isValidUrl('http://example.com with spaces')).toBe(false)
    })
  })

  describe('findUrlsInText', () => {
    it('should find single plain URL', () => {
      const text = 'Visit https://example.com for more info'
      const urls = findUrlsInText(text)

      expect(urls).toHaveLength(1)
      expect(urls[0]).toEqual({
        url: 'https://example.com',
        from: 6,
        to: 25,
      })
    })

    it('should find multiple plain URLs', () => {
      const text = 'Visit https://example.com and https://github.com'
      const urls = findUrlsInText(text)

      expect(urls).toHaveLength(2)
      expect(urls[0]).toEqual({
        url: 'https://example.com',
        from: 6,
        to: 25,
      })
      expect(urls[1]).toEqual({
        url: 'https://github.com',
        from: 30,
        to: 48,
      })
    })

    it('should find URL in markdown link', () => {
      const text = 'Check out [Google](https://google.com) for search'
      const urls = findUrlsInText(text)

      expect(urls).toHaveLength(1)
      expect(urls[0]).toEqual({
        url: 'https://google.com',
        from: 19,
        to: 37,
      })
    })

    it('should find URL in markdown image', () => {
      const text = 'Look at this ![image](https://example.com/img.jpg) here'
      const urls = findUrlsInText(text)

      expect(urls).toHaveLength(1)
      expect(urls[0]).toEqual({
        url: 'https://example.com/img.jpg',
        from: 22,
        to: 49,
      })
    })

    it('should find both plain and markdown URLs', () => {
      const text = 'Visit https://example.com and [Google](https://google.com)'
      const urls = findUrlsInText(text)

      expect(urls).toHaveLength(2)
      expect(urls[0]).toEqual({
        url: 'https://google.com',
        from: 39,
        to: 57,
      })
      expect(urls[1]).toEqual({
        url: 'https://example.com',
        from: 6,
        to: 25,
      })
    })

    it('should handle URLs with complex paths', () => {
      const text =
        'API docs at https://api.example.com/v1/docs?format=json#section'
      const urls = findUrlsInText(text)

      expect(urls).toHaveLength(1)
      expect(urls[0]).toEqual({
        url: 'https://api.example.com/v1/docs?format=json#section',
        from: 12,
        to: 63,
      })
    })

    it('should handle URLs with parentheses in query params', () => {
      const text = 'Search at https://example.com/search?q=test(1) for results'
      const urls = findUrlsInText(text)

      expect(urls).toHaveLength(1)
      expect(urls[0]).toEqual({
        url: 'https://example.com/search?q=test(1',
        from: 10,
        to: 45,
      })
    })

    it('should handle markdown links with empty alt text', () => {
      const text = 'Visit [](https://example.com) for info'
      const urls = findUrlsInText(text)

      expect(urls).toHaveLength(1) // Only from markdown detection
      expect(urls[0]).toEqual({
        url: 'https://example.com',
        from: 9,
        to: 28,
      })
    })

    it('should handle markdown images with empty alt text', () => {
      const text = 'Image ![](https://example.com/img.jpg) here'
      const urls = findUrlsInText(text)

      expect(urls).toHaveLength(1) // Only from markdown detection
      expect(urls[0]).toEqual({
        url: 'https://example.com/img.jpg',
        from: 10,
        to: 37,
      })
    })

    it('should ignore non-HTTP URLs in markdown', () => {
      const text = 'Local file [link](file:///path/to/file) here'
      const urls = findUrlsInText(text)

      expect(urls).toHaveLength(0)
    })

    it('should handle URLs at text boundaries', () => {
      const text = 'https://example.com'
      const urls = findUrlsInText(text)

      expect(urls).toHaveLength(1)
      expect(urls[0]).toEqual({
        url: 'https://example.com',
        from: 0,
        to: 19,
      })
    })

    it('should handle URLs followed by punctuation', () => {
      const text = 'Visit https://example.com, it is great!'
      const urls = findUrlsInText(text)

      expect(urls).toHaveLength(1)
      expect(urls[0]).toEqual({
        url: 'https://example.com,',
        from: 6,
        to: 26,
      })
    })

    it('should handle URLs in parentheses', () => {
      const text = 'Visit (https://example.com) for info'
      const urls = findUrlsInText(text)

      expect(urls).toHaveLength(1)
      expect(urls[0]).toEqual({
        url: 'https://example.com',
        from: 7,
        to: 26,
      })
    })

    it('should apply offset to positions', () => {
      const text = 'Visit https://example.com for info'
      const urls = findUrlsInText(text, 100)

      expect(urls).toHaveLength(1)
      expect(urls[0]).toEqual({
        url: 'https://example.com',
        from: 106,
        to: 125,
      })
    })

    it('should handle complex markdown with multiple links', () => {
      const text =
        'Check [Google](https://google.com) and ![GitHub](https://github.com/logo.png) plus https://example.com'
      const urls = findUrlsInText(text)

      expect(urls).toHaveLength(3) // 2 markdown URLs + 1 plain URL
      expect(urls[0]).toEqual({
        url: 'https://google.com',
        from: 15,
        to: 33,
      })
      expect(urls[1]).toEqual({
        url: 'https://github.com/logo.png',
        from: 49,
        to: 76,
      })
      expect(urls[2]).toEqual({
        url: 'https://example.com',
        from: 83,
        to: 102,
      })
    })

    it('should return empty array for text without URLs', () => {
      const text = 'This is just plain text without any URLs'
      const urls = findUrlsInText(text)

      expect(urls).toHaveLength(0)
    })

    it('should handle empty text', () => {
      const text = ''
      const urls = findUrlsInText(text)

      expect(urls).toHaveLength(0)
    })
  })

  describe('isImageUrl', () => {
    it('should return true for URLs with common image extensions', () => {
      expect(isImageUrl('https://example.com/image.png')).toBe(true)
      expect(isImageUrl('https://example.com/photo.jpg')).toBe(true)
      expect(isImageUrl('https://example.com/photo.jpeg')).toBe(true)
      expect(isImageUrl('https://example.com/animation.gif')).toBe(true)
      expect(isImageUrl('https://example.com/image.webp')).toBe(true)
      expect(isImageUrl('https://example.com/icon.svg')).toBe(true)
      expect(isImageUrl('https://example.com/bitmap.bmp')).toBe(true)
      expect(isImageUrl('https://example.com/favicon.ico')).toBe(true)
    })

    it('should handle uppercase extensions', () => {
      expect(isImageUrl('https://example.com/IMAGE.PNG')).toBe(true)
      expect(isImageUrl('https://example.com/photo.JPG')).toBe(true)
      expect(isImageUrl('https://example.com/Image.WebP')).toBe(true)
    })

    it('should handle local paths with image extensions', () => {
      expect(isImageUrl('/src/assets/image.png')).toBe(true)
      expect(isImageUrl('./image.jpg')).toBe(true)
      expect(isImageUrl('../images/photo.webp')).toBe(true)
    })

    it('should handle URLs with query parameters', () => {
      // Image URLs with query parameters are still images
      expect(isImageUrl('https://example.com/image.png?size=large')).toBe(true)
      // But URLs where the image extension is only in the query param are not
      expect(isImageUrl('https://example.com/api?file=image.png')).toBe(false)
    })

    it('should return false for non-image URLs', () => {
      expect(isImageUrl('https://example.com/document.pdf')).toBe(false)
      expect(isImageUrl('https://example.com/video.mp4')).toBe(false)
      expect(isImageUrl('https://example.com/page.html')).toBe(false)
      expect(isImageUrl('https://example.com/')).toBe(false)
      expect(isImageUrl('https://example.com')).toBe(false)
    })

    it('should return false for URLs without extensions', () => {
      expect(isImageUrl('https://example.com/no-extension')).toBe(false)
      expect(isImageUrl('https://example.com/path/to/page')).toBe(false)
    })

    it('should handle edge cases', () => {
      expect(isImageUrl('')).toBe(false)
      expect(isImageUrl('image.png')).toBe(true)
      expect(isImageUrl('.png')).toBe(true)
    })
  })

  describe('findImageUrlsInText', () => {
    it('should find markdown image with image URL', () => {
      const text = 'Check out ![screenshot](https://example.com/screenshot.png) here'
      const imageUrls = findImageUrlsInText(text)

      expect(imageUrls).toHaveLength(1)
      expect(imageUrls[0]).toEqual({
        url: 'https://example.com/screenshot.png',
        from: 24,
        to: 58,
      })
    })

    it('should find multiple image URLs', () => {
      const text =
        'Images: ![one](https://example.com/1.png) and ![two](https://example.com/2.jpg)'
      const imageUrls = findImageUrlsInText(text)

      expect(imageUrls).toHaveLength(2)
      expect(imageUrls[0]).toEqual({
        url: 'https://example.com/1.png',
        from: 15,
        to: 40,
      })
      expect(imageUrls[1]).toEqual({
        url: 'https://example.com/2.jpg',
        from: 53,
        to: 78,
      })
    })

    it('should find plain image URLs', () => {
      const text = 'See image at https://example.com/photo.jpg for details'
      const imageUrls = findImageUrlsInText(text)

      expect(imageUrls).toHaveLength(1)
      expect(imageUrls[0]).toEqual({
        url: 'https://example.com/photo.jpg',
        from: 13,
        to: 42,
      })
    })

    it('should filter out non-image URLs', () => {
      const text =
        'Visit [site](https://example.com) and see ![image](https://example.com/pic.png)'
      const imageUrls = findImageUrlsInText(text)

      expect(imageUrls).toHaveLength(1)
      expect(imageUrls[0]).toEqual({
        url: 'https://example.com/pic.png',
        from: 51,
        to: 78,
      })
    })

    it('should handle mixed URLs and only return images', () => {
      const text =
        'Link to https://example.com and image https://example.com/image.png and video https://example.com/video.mp4'
      const imageUrls = findImageUrlsInText(text)

      expect(imageUrls).toHaveLength(1)
      expect(imageUrls[0]?.url).toBe('https://example.com/image.png')
    })

    it('should handle different image extensions', () => {
      const text =
        'PNG ![](https://a.com/1.png), JPEG ![](https://b.com/2.jpeg), GIF ![](https://c.com/3.gif), WebP ![](https://d.com/4.webp)'
      const imageUrls = findImageUrlsInText(text)

      expect(imageUrls).toHaveLength(4)
      expect(imageUrls[0]?.url).toBe('https://a.com/1.png')
      expect(imageUrls[1]?.url).toBe('https://b.com/2.jpeg')
      expect(imageUrls[2]?.url).toBe('https://c.com/3.gif')
      expect(imageUrls[3]?.url).toBe('https://d.com/4.webp')
    })

    it('should return empty array when no image URLs found', () => {
      const text = 'Visit https://example.com and [GitHub](https://github.com)'
      const imageUrls = findImageUrlsInText(text)

      expect(imageUrls).toHaveLength(0)
    })

    it('should return empty array for empty text', () => {
      const imageUrls = findImageUrlsInText('')

      expect(imageUrls).toHaveLength(0)
    })

    it('should apply offset correctly', () => {
      const text = 'Image: ![](https://example.com/image.png)'
      const imageUrls = findImageUrlsInText(text, 50)

      expect(imageUrls).toHaveLength(1)
      expect(imageUrls[0]).toEqual({
        url: 'https://example.com/image.png',
        from: 61,
        to: 90,
      })
    })

    it('should handle case-insensitive extension matching', () => {
      const text = 'Image ![](https://example.com/Photo.PNG) here'
      const imageUrls = findImageUrlsInText(text)

      expect(imageUrls).toHaveLength(1)
      expect(imageUrls[0]?.url).toBe('https://example.com/Photo.PNG')
    })

    it('should handle local absolute paths', () => {
      const text = 'Local image ![](/src/assets/image.png) here'
      // Note: findUrlsInText only finds http(s) URLs, so this won't match
      // This is expected behavior - local paths would need to be detected separately
      const imageUrls = findImageUrlsInText(text)

      expect(imageUrls).toHaveLength(0)
    })
  })
})
