import { describe, it, expect } from 'vitest'
import { slugFromTitle } from './slug'

describe('slugFromTitle', () => {
  it('returns an empty string for empty or whitespace-only input', () => {
    expect(slugFromTitle('')).toBe('')
    expect(slugFromTitle('   ')).toBe('')
  })

  it('lowercases and joins words with hyphens', () => {
    expect(slugFromTitle('Hello World Example')).toBe('hello-world-example')
  })

  it('filters out common stop words', () => {
    expect(slugFromTitle('The Quick Brown Fox')).toBe('quick-brown-fox')
    expect(slugFromTitle('A Guide to the Galaxy')).toBe('guide-galaxy')
  })

  it('falls back to unfiltered words when every word is a stop word', () => {
    expect(slugFromTitle('the and of')).toBe('the-and-of')
  })

  it('strips emoji and punctuation', () => {
    expect(slugFromTitle('Hello, World! 🚀')).toBe('hello-world')
    expect(slugFromTitle("It's a Test: Round #2")).toBe('test-round-2')
  })

  it('collapses existing hyphens and whitespace', () => {
    expect(slugFromTitle('already-hyphenated   title')).toBe(
      'already-hyphenated-title'
    )
  })

  it('truncates a single very long word to the target length', () => {
    const longWord = 'a'.repeat(80)
    expect(slugFromTitle(longWord)).toBe('a'.repeat(50))
  })

  it('stops adding words once the target length is reached', () => {
    const result = slugFromTitle(
      'supercalifragilistic expialidocious additional words here'
    )
    expect(result.length).toBeLessThanOrEqual(50)
    expect(result).toBe('supercalifragilistic-expialidocious-additional')
  })

  it('keeps digits', () => {
    expect(slugFromTitle('Top 10 Tips for 2026')).toBe('top-10-tips-2026')
  })
})
