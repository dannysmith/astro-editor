import { describe, it, expect } from 'vitest'
import { imagesToPaste, pastedImageName } from './images'

/** A clipboard as WebKit gives it in a paste event */
const clipboard = (
  files: File[],
  data: Record<string, string> = {}
): DataTransfer =>
  ({
    files,
    getData: (type: string) => data[type] ?? '',
  }) as unknown as DataTransfer

const file = (name: string, type: string) => new File(['bytes'], name, { type })

// Shapes from real pastes (see the task doc for pasting images)
const screenshot = () => file('image.png', 'image/png')
const fromPhotos = () =>
  file('89A58956-C685-4501-8437-5AE39912AF79_1_105_c.jpeg', 'image/jpeg')
const fromFinder = () =>
  file('Screenshot 2026-11-26 at 20.15.02.png', 'image/png')

describe('imagesToPaste', () => {
  it('takes a screenshot or an image copied in Preview', () => {
    expect(imagesToPaste(clipboard([screenshot()]))).toMatchObject({
      files: [{ name: 'pasted-image.png' }],
      alt: null,
    })
  })

  it('takes images copied in Finder, keeping their names', () => {
    const second = file('Screenshot 2026-11-26 at 20.21.59.png', 'image/png')
    expect(
      imagesToPaste(clipboard([fromFinder(), second]))?.files.map(f => f.name)
    ).toEqual([
      'Screenshot 2026-11-26 at 20.15.02.png',
      'Screenshot 2026-11-26 at 20.21.59.png',
    ])
  })

  it('takes a HEIC, which is converted as it is saved', () => {
    const heic = file('Photo From iPhone.HEIC', 'image/heic')
    expect(imagesToPaste(clipboard([heic]))?.files[0]?.name).toBe(
      'Photo From iPhone.HEIC'
    )
  })

  it("takes Copy Image from a browser, with the image's alt text", () => {
    // Safari and Chrome both give the image and HTML that's just the <img>
    const html =
      '<img alt="An airport corridor with the words \'International Arrivals\'. " src="https://ichef.bbci.co.uk/photo.jpg" style="color: rgb(255, 255, 255);">'
    expect(
      imagesToPaste(clipboard([screenshot()], { 'text/html': html }))
    ).toMatchObject({
      files: [{ name: 'pasted-image.png' }],
      alt: "An airport corridor with the words 'International Arrivals'.",
    })
  })

  it('escapes brackets and backslashes in the alt text', () => {
    const html = '<img alt="A [draft] cover\\" src="https://example.com/a.jpg">'
    expect(
      imagesToPaste(clipboard([screenshot()], { 'text/html': html }))?.alt
    ).toBe('A \\[draft\\] cover\\\\')
  })

  it('leaves copied text with images in it to the text handling', () => {
    const html =
      '<p>Some text</p><img src="blob:tauri://localhost/1" alt="A chart">'
    expect(
      imagesToPaste(clipboard([screenshot()], { 'text/html': html }))
    ).toBeNull()
    // A web page selection brings remote images and no files at all
    expect(
      imagesToPaste(
        clipboard([], { 'text/html': html, 'text/plain': 'Some text' })
      )
    ).toBeNull()
  })

  it('leaves a paste with a file that is not an image', () => {
    const pdf = file('notes.pdf', 'application/pdf')
    expect(imagesToPaste(clipboard([pdf]))).toBeNull()
    expect(imagesToPaste(clipboard([fromFinder(), pdf]))).toBeNull()
  })

  it('leaves an image that comes with text', () => {
    expect(
      imagesToPaste(clipboard([screenshot()], { 'text/plain': 'A caption' }))
    ).toBeNull()
  })

  it('handles a clipboard with nothing on it', () => {
    expect(imagesToPaste(null)).toBeNull()
    expect(imagesToPaste(clipboard([]))).toBeNull()
  })
})

describe('pastedImageName', () => {
  it('replaces names made up by WebKit and Photos', () => {
    expect(pastedImageName(screenshot())).toBe('pasted-image.png')
    expect(pastedImageName(fromPhotos())).toBe('pasted-image.jpeg')
  })

  it('names an image with no name from its type', () => {
    expect(pastedImageName(file('', 'image/jpeg'))).toBe('pasted-image.jpg')
  })

  it('keeps a real file name', () => {
    expect(pastedImageName(fromFinder())).toBe(
      'Screenshot 2026-11-26 at 20.15.02.png'
    )
  })
})
