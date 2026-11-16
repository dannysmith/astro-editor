import { describe, it, expect } from 'vitest'
import { shortSlugFromTitle, slugFromTitle } from './slug'

describe('slugFromTitle', () => {
  it('keeps every word, cleaned the same way as the short slug', () => {
    expect(slugFromTitle('My Trip to the Lake')).toBe('my-trip-to-the-lake')
    expect(slugFromTitle('Café Crème, à Zürich! 🚀')).toBe(
      'cafe-creme-a-zurich'
    )
    expect(slugFromTitle(' 🚀 ')).toBe('')
  })
})

describe('shortSlugFromTitle', () => {
  it('returns an empty string for empty or whitespace-only input', () => {
    expect(shortSlugFromTitle('')).toBe('')
    expect(shortSlugFromTitle('   ')).toBe('')
  })

  it('lowercases and joins words with hyphens', () => {
    expect(shortSlugFromTitle('Hello World Example')).toBe(
      'hello-world-example'
    )
  })

  it('filters out common stop words', () => {
    expect(shortSlugFromTitle('The Quick Brown Fox')).toBe('quick-brown-fox')
    expect(shortSlugFromTitle('A Guide to the Galaxy')).toBe('guide-galaxy')
  })

  it('falls back to unfiltered words when every word is a stop word', () => {
    expect(shortSlugFromTitle('the and of')).toBe('the-and-of')
  })

  it('strips emoji and punctuation', () => {
    expect(shortSlugFromTitle('Hello, World! 🚀')).toBe('hello-world')
    expect(shortSlugFromTitle("It's a Test: Round #2")).toBe('test-round-2')
  })

  it('collapses existing hyphens and whitespace', () => {
    expect(shortSlugFromTitle('already-hyphenated   title')).toBe(
      'already-hyphenated-title'
    )
  })

  it('truncates a single very long word to the target length', () => {
    const longWord = 'a'.repeat(80)
    expect(shortSlugFromTitle(longWord)).toBe('a'.repeat(50))
  })

  it('stops adding words once the target length is reached', () => {
    const result = shortSlugFromTitle(
      'supercalifragilistic expialidocious additional words here'
    )
    expect(result.length).toBeLessThanOrEqual(50)
    expect(result).toBe('supercalifragilistic-expialidocious-additional')
  })

  it('keeps digits', () => {
    expect(shortSlugFromTitle('Top 10 Tips for 2026')).toBe('top-10-tips-2026')
  })

  it('keeps accented letters without their accents', () => {
    expect(shortSlugFromTitle('Café Crème in Zürich')).toBe('cafe-creme-zurich')
  })
})
