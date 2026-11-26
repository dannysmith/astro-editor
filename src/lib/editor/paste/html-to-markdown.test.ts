import { describe, it, expect } from 'vitest'
import { htmlToMarkdown } from './html-to-markdown'
import safari from './fixtures/safari.html?raw'
import chrome from './fixtures/chrome.html?raw'
import textedit from './fixtures/textedit.html?raw'
import word from './fixtures/word.html?raw'

const fixtures = { safari, chrome, textedit, word }

describe('htmlToMarkdown', () => {
  // The sample article (docs/tasks-todo paste testing) copied from each
  // source, as WebKit gave it to the paste event. Its .md beside it is what
  // it pastes as
  it.each(Object.entries(fixtures))(
    'converts the sample article copied from %s',
    async (source, html) => {
      await expect(htmlToMarkdown(html)).toMatchFileSnapshot(
        `fixtures/${source}.md`
      )
    }
  )

  it('keeps headings, paragraphs and line breaks', () => {
    expect(htmlToMarkdown('<h2>Title</h2><p>One<br>two</p><p>Three</p>')).toBe(
      '## Title\n\nOne\ntwo\n\nThree'
    )
  })

  it('makes bold and italic from tags and styles', () => {
    expect(
      htmlToMarkdown(
        '<p><strong>a</strong> <em>b</em> <span style="font-weight: 700">c</span> <span style="font-style: italic">d</span></p>'
      )
    ).toBe('**a** *b* **c** *d*')
  })

  it("doesn't make bold of an element styled not to be", () => {
    // Google Docs wraps everything in this
    expect(
      htmlToMarkdown(
        '<b style="font-weight: normal"><p>Plain <span style="font-weight: 700">bold</span></p></b>'
      )
    ).toBe('Plain **bold**')
  })

  it("doesn't double marks inside marks, and keeps spaces outside them", () => {
    expect(htmlToMarkdown('<p><b>all <strong>bold </strong></b>text</p>')).toBe(
      '**all bold** text'
    )
  })

  it('keeps links to web and email addresses', () => {
    expect(
      htmlToMarkdown(
        '<p><a href="https://a.com/">web</a>, <a href="mailto:a@b.com">mail</a>, <a href="/here/">relative</a></p>'
      )
    ).toBe('[web](https://a.com/), [mail](mailto:a@b.com), relative')
  })

  it('keeps images with a web address, and drops embedded ones', () => {
    expect(
      htmlToMarkdown(
        '<p><img src="https://a.com/x.jpg" alt="A view"><img src="blob:tauri://x" alt="Embedded"></p>'
      )
    ).toBe('![A view](https://a.com/x.jpg)')
  })

  it('makes nested and numbered lists', () => {
    expect(
      htmlToMarkdown(
        '<ul><li>One<ul><li>Nested</li></ul></li><li>Two</li></ul><ol start="3"><li>Three<ul><li>Under</li></ul></li></ol>'
      )
    ).toBe('- One\n  - Nested\n- Two\n\n3. Three\n   - Under')
  })

  it('makes quotes', () => {
    expect(
      htmlToMarkdown('<blockquote><p>Said</p><p>— Someone</p></blockquote>')
    ).toBe('> Said\n>\n> — Someone')
  })

  it('makes code, inline and in blocks', () => {
    expect(
      htmlToMarkdown(
        '<p>Run <code>a_b *c*</code></p><pre><code>x = 1\ny = 2\n</code></pre>'
      )
    ).toBe('Run `a_b *c*`\n\n```\nx = 1\ny = 2\n```')
  })

  it('makes code fences longer than the backticks in the code', () => {
    expect(
      htmlToMarkdown(
        '<p><code>a`b</code> <code>`x`</code></p><pre>```\nfenced\n```</pre>'
      )
    ).toBe('``a`b`` `` `x` ``\n\n````\n```\nfenced\n```\n````')
  })

  it('escapes text that reads as HTML or an entity', () => {
    // In an MDX file, an unescaped <div> would be read as JSX
    expect(
      htmlToMarkdown(
        '<p>Use &lt;div&gt; and write &amp;lt; for <b>it</b>, fish &amp; chips</p>'
      )
    ).toBe('Use \\<div> and write \\&lt; for **it**, fish & chips')
  })

  it('escapes text that would otherwise be Markdown', () => {
    expect(
      htmlToMarkdown(
        '<p>5 * 3, file_name, _under_, [note]</p><p># Not a heading</p><p>1986. A year</p><p>- Not a list</p>'
      )
    ).toBe(
      '5 \\* 3, file_name, \\_under\\_, \\[note\\]\n\n\\# Not a heading\n\n1986\\. A year\n\n\\- Not a list'
    )
  })
})
