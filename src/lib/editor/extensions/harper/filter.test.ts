import { describe, it, expect } from 'vitest'
import { parser, GFM } from '@lezer/markdown'
import { shouldShow } from './filter'
import { proseText } from './prose'

const gfmParser = parser.configure(GFM)

/** Whether an issue on `word` (its first match in `doc`) would be shown */
function shows(doc: string, word: string, rule: string, kind: string) {
  const start = doc.indexOf(word)
  const text = proseText(doc, gfmParser.parse(doc))
  return shouldShow({ rule, kind, start, end: start + word.length }, text, doc)
}

const spelling = (doc: string, word: string) =>
  shows(doc, word, 'SpellCheck', 'Spelling')

describe('shouldShow', () => {
  it('shows a misspelled word', () => {
    expect(spelling('This sentense is wrong.', 'sentense')).toBe(true)
  })

  it('ignores acronyms anywhere', () => {
    expect(spelling('MDX files work.', 'MDX')).toBe(false)
    expect(spelling('Some APIs are slow.', 'APIs')).toBe(false)
  })

  it('ignores capitalised words inside a sentence', () => {
    expect(spelling('I use Keystatic daily.', 'Keystatic')).toBe(false)
    expect(spelling('Read the "Keystatic" docs.', 'Keystatic')).toBe(false)
  })

  it('ignores code written as prose', () => {
    expect(spelling('Set the pubDate field.', 'pubDate')).toBe(false)
    const doc = 'The `import`s are hidden.'
    const start = doc.indexOf('`s') + 1
    const text = proseText(doc, gfmParser.parse(doc))
    expect(
      shouldShow(
        { rule: 'SpellCheck', kind: 'Spelling', start, end: start + 1 },
        text,
        doc
      )
    ).toBe(false)
  })

  it('shows capitalised words that start a sentence', () => {
    expect(spelling('Keystatic is good.', 'Keystatic')).toBe(true)
    expect(spelling('It works. Keystatic is good.', 'Keystatic')).toBe(true)
    expect(spelling('First.\n\nKeystatic is good.', 'Keystatic')).toBe(true)
    expect(spelling('# Keystatic', 'Keystatic')).toBe(true)
    expect(spelling('- Keystatic', 'Keystatic')).toBe(true)
    expect(spelling('Wait… Keystatic is good.', 'Keystatic')).toBe(true)
    expect(
      spelling('| a | b |\n| - | - |\n| c | Keystatic |', 'Keystatic')
    ).toBe(true)
  })

  it('ignores grammar beside masked code', () => {
    expect(shows('Use an `index.ts` file.', 'an', 'AnA', 'Miscellaneous')).toBe(
      false
    )
    expect(
      shows(
        'It ends. `expected` is the block.',
        'is',
        'SentenceCapitalization',
        'Capitalization'
      )
    ).toBe(false)
  })

  it('shows grammar away from code', () => {
    expect(shows('This is an banana.', 'an', 'AnA', 'Miscellaneous')).toBe(true)
  })

  it('ignores lowercase list items and table cells', () => {
    const capitalisation = (doc: string, word: string) =>
      shows(doc, word, 'SentenceCapitalization', 'Capitalization')
    expect(capitalisation('- another item', 'another')).toBe(false)
    expect(capitalisation('1. another item', 'another')).toBe(false)
    expect(capitalisation('| a | another cell |', 'another')).toBe(false)
    expect(capitalisation('It ends. another starts.', 'another')).toBe(true)
  })
})
