import { afterEach, describe, expect, it } from 'vitest'
import {
  applyCachedColourTheme,
  applyColourTheme,
  cacheColourTheme,
  parseColourTheme,
} from './colour-themes'

describe('parseColourTheme', () => {
  it('reads colour tokens, including light-dark() pairs and var() references', () => {
    const { tokens, ignored } = parseColourTheme(`
      :root {
        --background: light-dark(#e5e9f0,#292e39);
        --foreground: #2e3440;
        --card: var(--background);
      }
    `)
    expect(tokens).toEqual({
      background: 'light-dark(#e5e9f0,#292e39)',
      foreground: '#2e3440',
      card: 'var(--background)',
    })
    expect(ignored).toEqual([])
  })

  it('reads tokens from any top-level style rule', () => {
    const { tokens } = parseColourTheme(`
      :root { --background: #111111; }
      html { --foreground: #eeeeee; }
    `)
    expect(tokens).toEqual({ background: '#111111', foreground: '#eeeeee' })
  })

  it('ignores unknown tokens, other properties and the heading colour', () => {
    const { tokens, ignored } = parseColourTheme(`
      :root {
        --background: #111111;
        --not-a-token: #222222;
        --radius: 0px;
        --editor-color-heading: #ff0000;
        color: red;
      }
      body { display: none; }
    `)
    expect(tokens).toEqual({ background: '#111111' })
    expect(ignored).toEqual([
      '--not-a-token',
      '--radius',
      '--editor-color-heading',
      'color',
      'display',
    ])
  })

  it('ignores values that could load something', () => {
    const { tokens, ignored } = parseColourTheme(`
      :root {
        --background: url(https://example.com/a.png);
        --card: image-set("https://example.com/a.png" 1x);
        --muted: \\75 rl(https://example.com/a.png);
        --popover: #ffffff;
      }
    `)
    expect(tokens).toEqual({ popover: '#ffffff' })
    expect(ignored).toEqual(['--background', '--card', '--muted'])
  })

  it('ignores @import and rules inside at-rules', () => {
    const { tokens } = parseColourTheme(`
      @import url('https://example.com/theme.css');
      @media (prefers-color-scheme: dark) { :root { --background: #000000; } }
      :root { --foreground: #ffffff; }
    `)
    expect(tokens).toEqual({ foreground: '#ffffff' })
  })

  it('keeps what it can read from a file with errors', () => {
    const { tokens } = parseColourTheme(`
      :root { --background: #111111; --foreground: #eeeeee }
      this is not css {
    `)
    expect(tokens).toEqual({ background: '#111111', foreground: '#eeeeee' })
  })
})

describe('applyColourTheme', () => {
  const style = () => document.documentElement.style

  afterEach(() => {
    applyColourTheme({})
    localStorage.clear()
  })

  it("sets a theme's tokens and removes the previous theme's", () => {
    applyColourTheme({ background: '#111111', card: '#222222' })
    expect(style().getPropertyValue('--background')).toBe('#111111')

    applyColourTheme({ background: '#333333' })
    expect(style().getPropertyValue('--background')).toBe('#333333')
    expect(style().getPropertyValue('--card')).toBe('')
  })

  it('leaves inline variables that are not theme tokens alone', () => {
    style().setProperty('--heading-color-light', '#123456')
    applyColourTheme({})
    expect(style().getPropertyValue('--heading-color-light')).toBe('#123456')
    style().removeProperty('--heading-color-light')
  })

  it('applies the cached theme at launch, and nothing once it is forgotten', () => {
    cacheColourTheme({ background: '#111111' })
    applyCachedColourTheme()
    expect(style().getPropertyValue('--background')).toBe('#111111')

    applyColourTheme({})
    cacheColourTheme(null)
    applyCachedColourTheme()
    expect(style().getPropertyValue('--background')).toBe('')
  })
})
