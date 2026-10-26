import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { handleUrlClick } from './handlers'

// Mock Tauri opener
vi.mock('@tauri-apps/plugin-opener', () => ({
  openPath: vi.fn(),
}))

// Mock URL detection
vi.mock('./detection', () => ({
  findUrlsInText: vi.fn(),
}))

const mockOpenPath = vi.mocked(
  await import('@tauri-apps/plugin-opener')
).openPath
const mockFindUrlsInText = vi.mocked(await import('./detection')).findUrlsInText

const createMockView = (content: string) => {
  const state = EditorState.create({ doc: content })

  return {
    state,
    posAtCoords: vi.fn(),
  } as unknown as EditorView
}

const createMockEvent = (options: {
  altKey?: boolean
  clientX?: number
  clientY?: number
}): MouseEvent => {
  return {
    altKey: options.altKey || false,
    clientX: options.clientX || 0,
    clientY: options.clientY || 0,
  } as MouseEvent
}

describe('URL Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('handleUrlClick', () => {
    it('should return false when Alt key is not pressed', async () => {
      const view = createMockView('Visit https://example.com')
      const event = createMockEvent({ altKey: false })

      const result = await handleUrlClick(view, event)

      expect(result).toBe(false)
      expect(mockOpenPath).not.toHaveBeenCalled()
    })

    it('should return false when click position is null', async () => {
      const view = createMockView('Visit https://example.com')
      const event = createMockEvent({ altKey: true })

      view.posAtCoords = vi.fn().mockReturnValue(null)

      const result = await handleUrlClick(view, event)

      expect(result).toBe(false)
      expect(mockOpenPath).not.toHaveBeenCalled()
    })

    it('should return false when no URL is found at click position', async () => {
      const view = createMockView('Visit https://example.com')
      const event = createMockEvent({ altKey: true, clientX: 100, clientY: 50 })

      view.posAtCoords = vi.fn().mockReturnValue(3) // Position before URL starts
      mockFindUrlsInText.mockReturnValue([
        { url: 'https://example.com', from: 6, to: 25 },
      ])

      const result = await handleUrlClick(view, event)

      expect(result).toBe(false)
      expect(mockOpenPath).not.toHaveBeenCalled()
    })

    it('should open URL when clicked with Alt key', async () => {
      const view = createMockView('Visit https://example.com')
      const event = createMockEvent({ altKey: true, clientX: 100, clientY: 50 })

      view.posAtCoords = vi.fn().mockReturnValue(15) // Position within URL
      mockFindUrlsInText.mockReturnValue([
        { url: 'https://example.com', from: 6, to: 24 },
      ])
      mockOpenPath.mockResolvedValue()

      const result = await handleUrlClick(view, event)

      expect(result).toBe(true)
      expect(mockOpenPath).toHaveBeenCalledWith('https://example.com')
    })

    it('should handle multiple URLs and click on second one', async () => {
      const view = createMockView(
        'Visit https://example.com and https://github.com'
      )
      const event = createMockEvent({ altKey: true, clientX: 100, clientY: 50 })

      view.posAtCoords = vi.fn().mockReturnValue(35) // Position within second URL
      mockFindUrlsInText.mockReturnValue([
        { url: 'https://example.com', from: 6, to: 24 },
        { url: 'https://github.com', from: 29, to: 47 },
      ])
      mockOpenPath.mockResolvedValue()

      const result = await handleUrlClick(view, event)

      expect(result).toBe(true)
      expect(mockOpenPath).toHaveBeenCalledWith('https://github.com')
    })

    it('should handle click at exact URL boundaries', async () => {
      const view = createMockView('Visit https://example.com')
      const event = createMockEvent({ altKey: true, clientX: 100, clientY: 50 })

      view.posAtCoords = vi.fn().mockReturnValue(6) // Position at start of URL
      mockFindUrlsInText.mockReturnValue([
        { url: 'https://example.com', from: 6, to: 24 },
      ])
      mockOpenPath.mockResolvedValue()

      const result = await handleUrlClick(view, event)

      expect(result).toBe(true)
      expect(mockOpenPath).toHaveBeenCalledWith('https://example.com')
    })

    it('should handle click at end of URL', async () => {
      const view = createMockView('Visit https://example.com')
      const event = createMockEvent({ altKey: true, clientX: 100, clientY: 50 })

      view.posAtCoords = vi.fn().mockReturnValue(24) // Position at end of URL
      mockFindUrlsInText.mockReturnValue([
        { url: 'https://example.com', from: 6, to: 24 },
      ])
      mockOpenPath.mockResolvedValue()

      const result = await handleUrlClick(view, event)

      expect(result).toBe(true)
      expect(mockOpenPath).toHaveBeenCalledWith('https://example.com')
    })

    it('should return false when URL opening fails', async () => {
      const view = createMockView('Visit https://example.com')
      const event = createMockEvent({ altKey: true, clientX: 100, clientY: 50 })

      view.posAtCoords = vi.fn().mockReturnValue(15)
      mockFindUrlsInText.mockReturnValue([
        { url: 'https://example.com', from: 6, to: 24 },
      ])
      mockOpenPath.mockRejectedValue(new Error('Failed to open URL'))

      const result = await handleUrlClick(view, event)

      expect(result).toBe(false)
      expect(mockOpenPath).toHaveBeenCalledWith('https://example.com')
    })

    it('should call posAtCoords with correct coordinates', async () => {
      const view = createMockView('Visit https://example.com')
      const event = createMockEvent({
        altKey: true,
        clientX: 123,
        clientY: 456,
      })

      view.posAtCoords = vi.fn().mockReturnValue(null)

      await handleUrlClick(view, event)

      // oxlint-disable-next-line @typescript-eslint/unbound-method
      expect(view.posAtCoords).toHaveBeenCalledWith({ x: 123, y: 456 })
    })

    it('should call findUrlsInText with correct line text and offset', async () => {
      const content = 'Line 1\nVisit https://example.com\nLine 3'
      const view = createMockView(content)
      const event = createMockEvent({ altKey: true, clientX: 100, clientY: 50 })

      // Position on second line (index 13 = 'V' in 'Visit')
      view.posAtCoords = vi.fn().mockReturnValue(13)
      mockFindUrlsInText.mockReturnValue([])

      await handleUrlClick(view, event)

      expect(mockFindUrlsInText).toHaveBeenCalledWith(
        'Visit https://example.com',
        7 // Line start position
      )
    })

    it('should handle edge case with empty line', async () => {
      const view = createMockView('')
      const event = createMockEvent({ altKey: true, clientX: 100, clientY: 50 })

      view.posAtCoords = vi.fn().mockReturnValue(0)
      mockFindUrlsInText.mockReturnValue([])

      const result = await handleUrlClick(view, event)

      expect(result).toBe(false)
      expect(mockFindUrlsInText).toHaveBeenCalledWith('', 0)
    })
  })
})
