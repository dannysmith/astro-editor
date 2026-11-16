import { describe, it, expect } from 'vitest'
import { parser } from '@lezer/markdown'
import { GFM } from '@lezer/markdown'
import { MASK, proseText } from './prose'

const gfmParser = parser.configure(GFM)

/**
 * The text Harper sees: masked characters removed, and whitespace collapsed
 * so expectations stay readable
 */
function prose(doc: string): string {
  const text = proseText(doc, gfmParser.parse(doc))
  expect(text).toHaveLength(doc.length)
  return text.replaceAll(MASK, '').replace(/\s+/g, ' ').trim()
}

describe('proseText', () => {
  it('keeps plain prose as it is', () => {
    const doc = 'A sentence. Another one, with a comma.'
    expect(proseText(doc, gfmParser.parse(doc))).toBe(doc)
  })

  it('removes code, keeping the prose around it', () => {
    expect(prose('Run `bun install` now.\n\n```ts\nconst a = 1\n```\n')).toBe(
      'Run now.'
    )
  })

  it('keeps link text and removes the URL', () => {
    expect(prose('Read [the docs](https://example.com "Docs") first.')).toBe(
      'Read the docs first.'
    )
  })

  it('removes images and bare URLs', () => {
    expect(prose('See ![alt](a.png) and <https://example.com>.')).toBe(
      'See and .'
    )
  })

  it('removes emphasis marks', () => {
    expect(prose('Some **bold** and _italic_ text.')).toBe(
      'Some bold and italic text.'
    )
  })

  it('separates list items and headings into paragraphs', () => {
    const text = proseText(
      '# Heading\n- one\n- two',
      gfmParser.parse('# Heading\n- one\n- two')
    )
    expect(text).toBe('\n Heading\n\n one\n\n two')
  })

  it('separates table cells', () => {
    const doc = '| a | b |\n| - | - |\n| c | d |'
    expect(proseText(doc, gfmParser.parse(doc))).toMatch(/^\n a \n b \n\n/)
    expect(prose(doc)).toBe('a b c d')
  })

  it('keeps text inside HTML and MDX components', () => {
    const doc =
      '<Callout type="tip">\n  Text inside a component.\n</Callout>\n\nAfter <em>this</em>.'
    expect(prose(doc).replace(/\s+/g, ' ')).toBe(
      'Text inside a component. After this.'
    )
  })

  it('removes JSX attributes with expressions', () => {
    expect(prose('Look at <Chart data={points} height={200} /> here.')).toBe(
      'Look at here.'
    )
  })

  it('removes MDX imports, exports and expressions', () => {
    const doc =
      "import Chart from './Chart.astro'\nexport const title = 'x'\n\nIt has {props.count} items."
    expect(prose(doc)).toBe('It has items.')
  })

  it('removes script and style contents', () => {
    expect(prose('<script>\nlet x = 1\n</script>\n\nProse.')).toBe('Prose.')
  })

  it('removes code, links and images inside a component', () => {
    const doc = [
      '<Aside>',
      '  Run `bun install`, see [the docs](https://example.com) and ![alt](a.png).',
      '  ```sh',
      '  npm create astro',
      '  ```',
      '</Aside>',
    ].join('\n')
    expect(prose(doc)).toBe('Run , see the docs and .')
  })

  it('removes paths, file names and domains', () => {
    expect(
      prose('Put first-post.md in src/content/blog, as on astro.build now.')
    ).toBe('Put in , as on now.')
  })

  it('removes display maths', () => {
    expect(prose('Where $$\\frac{1}{n}$$ is small.')).toBe('Where is small.')
  })

  it('keeps the escaped character', () => {
    expect(prose('Not \\*emphasis\\*.')).toBe('Not *emphasis*.')
  })
})
