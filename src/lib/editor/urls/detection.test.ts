import { describe, it, expect } from 'vitest'
import {
  findUrlsInText,
  isValidUrl,
  urlRegex,
  isImageUrl,
  findImageUrlsAndPathsInText,
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

  describe('findImageUrlsAndPathsInText', () => {
    it('should find remote image URLs', () => {
      const text = 'Check out https://example.com/screenshot.png here'
      const images = findImageUrlsAndPathsInText(text)

      expect(images).toHaveLength(1)
      expect(images[0]).toEqual({
        url: 'https://example.com/screenshot.png',
        from: 10,
        to: 44,
      })
    })

    it('should find relative paths with ./', () => {
      const text = 'Local image: ./images/photo.jpg'
      const images = findImageUrlsAndPathsInText(text)

      expect(images).toHaveLength(1)
      expect(images[0]).toEqual({
        url: './images/photo.jpg',
        from: 13,
        to: 31,
      })
    })

    it('should find relative paths with ../', () => {
      const text = 'Parent directory: ../assets/icon.png'
      const images = findImageUrlsAndPathsInText(text)

      expect(images).toHaveLength(1)
      expect(images[0]).toEqual({
        url: '../assets/icon.png',
        from: 18,
        to: 36,
      })
    })

    it('should find absolute paths from project root', () => {
      const text = 'Absolute path: /src/assets/hero.webp'
      const images = findImageUrlsAndPathsInText(text)

      expect(images).toHaveLength(1)
      expect(images[0]).toEqual({
        url: '/src/assets/hero.webp',
        from: 15,
        to: 36,
      })
    })

    it('should find images in markdown syntax', () => {
      const text = 'Check out ![screenshot](https://example.com/image.png) here'
      const images = findImageUrlsAndPathsInText(text)

      expect(images).toHaveLength(1)
      expect(images[0]?.url).toBe('https://example.com/image.png')
    })

    it('should find images in HTML img tags', () => {
      const text = '<img src="/src/assets/photo.jpg" alt="Photo" />'
      const images = findImageUrlsAndPathsInText(text)

      expect(images).toHaveLength(1)
      expect(images[0]?.url).toBe('/src/assets/photo.jpg')
    })

    it('should find images in custom components', () => {
      const text = '<Image path="./local.png" />'
      const images = findImageUrlsAndPathsInText(text)

      expect(images).toHaveLength(1)
      expect(images[0]?.url).toBe('./local.png')
    })

    it('should find multiple images of different types', () => {
      const text =
        'Remote: https://cdn.com/img.jpg, Local: ./test.png, Absolute: /assets/icon.svg'
      const images = findImageUrlsAndPathsInText(text)

      expect(images).toHaveLength(3)
      expect(images[0]?.url).toBe('https://cdn.com/img.jpg')
      expect(images[1]?.url).toBe('./test.png')
      expect(images[2]?.url).toBe('/assets/icon.svg')
    })

    it('should handle all image extensions', () => {
      const text =
        'PNG: ./1.png, JPG: ./2.jpg, JPEG: ./3.jpeg, GIF: ./4.gif, WebP: ./5.webp, SVG: ./6.svg'
      const images = findImageUrlsAndPathsInText(text)

      expect(images).toHaveLength(6)
      expect(images.map(img => img.url)).toEqual([
        './1.png',
        './2.jpg',
        './3.jpeg',
        './4.gif',
        './5.webp',
        './6.svg',
      ])
    })

    it('should be case-insensitive for extensions', () => {
      const text = 'Image: ./Photo.PNG and /assets/Icon.JPG'
      const images = findImageUrlsAndPathsInText(text)

      expect(images).toHaveLength(2)
      expect(images[0]?.url).toBe('./Photo.PNG')
      expect(images[1]?.url).toBe('/assets/Icon.JPG')
    })

    it('should filter out non-image paths', () => {
      const text =
        'Link: https://example.com/page and Image: https://example.com/photo.jpg'
      const images = findImageUrlsAndPathsInText(text)

      expect(images).toHaveLength(1)
      expect(images[0]?.url).toBe('https://example.com/photo.jpg')
    })

    it('should handle images with query parameters', () => {
      const text = 'CDN: https://cdn.com/image.png?size=large&quality=high'
      const images = findImageUrlsAndPathsInText(text)

      expect(images).toHaveLength(1)
      expect(images[0]?.url).toBe('https://cdn.com/image.png?size=large&quality=high')
    })

    it('should apply offset correctly', () => {
      const text = 'Image: ./test.png'
      const images = findImageUrlsAndPathsInText(text, 100)

      expect(images).toHaveLength(1)
      expect(images[0]).toEqual({
        url: './test.png',
        from: 107,
        to: 117,
      })
    })

    it('should handle plain text with image paths', () => {
      const text = 'Check the file at ./docs/screenshot.png for reference'
      const images = findImageUrlsAndPathsInText(text)

      expect(images).toHaveLength(1)
      expect(images[0]?.url).toBe('./docs/screenshot.png')
    })

    it('should not match URLs without image extensions', () => {
      const text = 'Visit https://example.com and /about/page'
      const images = findImageUrlsAndPathsInText(text)

      expect(images).toHaveLength(0)
    })

    it('should return empty array for empty text', () => {
      const images = findImageUrlsAndPathsInText('')

      expect(images).toHaveLength(0)
    })

    it('should avoid duplicate matches', () => {
      // Same image path should only be matched once even if it appears in overlapping contexts
      const text = './image.png'
      const images = findImageUrlsAndPathsInText(text)

      expect(images).toHaveLength(1)
    })

    it('should work with mixed markdown and plain text', () => {
      const text =
        'See ![alt](https://example.com/one.png) and also ./local.jpg plus /assets/three.gif'
      const images = findImageUrlsAndPathsInText(text)

      expect(images).toHaveLength(3)
      expect(images[0]?.url).toBe('https://example.com/one.png')
      expect(images[1]?.url).toBe('./local.jpg')
      expect(images[2]?.url).toBe('/assets/three.gif')
    })
  })
})
