import { describe, it, expect } from 'vitest'
import { parser, GFM } from '@lezer/markdown'
import { mdxJsxFlow } from './mdx'

const mdx = parser.configure([GFM, mdxJsxFlow])
const md = parser.configure(GFM)

/** The top-level blocks, as `Name: text` */
function blocks(doc: string, p = mdx): string[] {
  const out: string[] = []
  const cursor = p.parse(doc).cursor()
  cursor.firstChild()
  do {
    out.push(`${cursor.name}: ${doc.slice(cursor.from, cursor.to)}`)
  } while (cursor.nextSibling())
  return out
}

/** Every node name in the tree */
function names(doc: string): string[] {
  const out: string[] = []
  mdx.parse(doc).iterate({ enter: node => void out.push(node.name) })
  return out
}

describe('mdxJsxFlow', () => {
  it('reads Markdown directly inside a component', () => {
    expect(
      blocks('<Callout type="info">\nSome **bold** text.\n</Callout>')
    ).toEqual([
      'HTMLBlock: <Callout type="info">',
      'Paragraph: Some **bold** text.',
      'HTMLBlock: </Callout>',
    ])
    expect(names('<Callout>\nSome **bold**\n</Callout>')).toContain(
      'StrongEmphasis'
    )
  })

  it('takes a tag that spans lines, with expressions holding `>`', () => {
    const doc = '<Card\n  title="A > B"\n  show={a > b}\n/>\nAfter'
    expect(blocks(doc)).toEqual([
      'HTMLBlock: <Card\n  title="A > B"\n  show={a > b}\n/>',
      'Paragraph: After',
    ])
  })

  it('reads nested components and several tags on one line', () => {
    expect(blocks('<Tabs><Tab>\n\n- item\n\n</Tab></Tabs>')).toEqual([
      'HTMLBlock: <Tabs><Tab>',
      'BulletList: - item',
      'HTMLBlock: </Tab></Tabs>',
    ])
  })

  it('keeps indented children as prose, not code', () => {
    expect(blocks('<Tab>\n    Some text\n</Tab>')).toEqual([
      'HTMLBlock: <Tab>',
      'Paragraph: Some text',
      'HTMLBlock: </Tab>',
    ])
  })

  it('reads lowercase HTML elements as JSX too', () => {
    expect(blocks('<div class="note">\nHTML with **bold**\n</div>')).toEqual([
      'HTMLBlock: <div class="note">',
      'Paragraph: HTML with **bold**',
      'HTMLBlock: </div>',
    ])
  })

  it('leaves a line with text after its tag to the paragraph', () => {
    expect(blocks('<Badge>New</Badge> and more')).toEqual([
      'Paragraph: <Badge>New</Badge> and more',
    ])
  })

  it('leaves autolinks, emails and comparisons alone', () => {
    expect(blocks('<https://example.com>')).toEqual([
      'Paragraph: <https://example.com>',
    ])
    expect(blocks('<me@example.com>')).toEqual(['Paragraph: <me@example.com>'])
    expect(blocks('< 3 apples')).toEqual(['Paragraph: < 3 apples'])
  })

  it('reads fragments', () => {
    expect(blocks('<>\ntext\n</>')).toEqual([
      'HTMLBlock: <>',
      'Paragraph: text',
      'HTMLBlock: </>',
    ])
  })

  it('takes a tag inside a blockquote', () => {
    expect(names('> <Callout>\n> Some **bold**\n> </Callout>')).toEqual(
      expect.arrayContaining(['Blockquote', 'HTMLBlock', 'StrongEmphasis'])
    )
  })

  it('takes an unclosed tag to the end of the document', () => {
    expect(blocks('<Card\n  title="x"')).toEqual([
      'HTMLBlock: <Card\n  title="x"',
    ])
  })

  it('reads escaped quotes in an expression', () => {
    expect(blocks("<Card title={'It\\'s fine'}>\ntext\n</Card>")).toEqual([
      "HTMLBlock: <Card title={'It\\'s fine'}>",
      'Paragraph: text',
      'HTMLBlock: </Card>',
    ])
  })

  it('stops a tag the scan loses track of at a blank line', () => {
    // Half typed, and a quote in a regex that reads as a string
    for (const tag of ['<Card title="', '<Card pattern={/"/} />']) {
      expect(blocks(`${tag}\nmore\n\n**After**`)).toEqual([
        `HTMLBlock: ${tag}\nmore`,
        'Paragraph: **After**',
      ])
    }
  })

  it("doesn't change .md files", () => {
    expect(blocks('<Callout>\nSome **bold**\n</Callout>', md)).toEqual([
      'HTMLBlock: <Callout>\nSome **bold**\n</Callout>',
    ])
  })
})
