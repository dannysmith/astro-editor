import { describe, expect, it } from 'vitest'
import {
  fileNameStem,
  parseFileNamePattern,
  patternHasTitle,
  stemWithDate,
} from './file-name-pattern'

const date = new Date(2026, 0, 5)
const title = 'My Trip to the Lake'

describe('fileNameStem', () => {
  it('fills in the title as a slug and the date in its format', () => {
    expect(fileNameStem('{YYYY-MM-DD}', { title, date })).toBe('2026-01-05')
    expect(fileNameStem('{title}', { title, date })).toBe('trip-lake')
    expect(fileNameStem('{YYYY-MM-DD}-{title}', { title, date })).toBe(
      '2026-01-05-trip-lake'
    )
    expect(fileNameStem('{YY}{MM}{D}_{title}', { title, date })).toBe(
      '26015_trip-lake'
    )
  })

  it('drops the hyphens around a missing title', () => {
    expect(fileNameStem('{YYYY-MM-DD}-{title}', { title: '', date })).toBe(
      '2026-01-05'
    )
    expect(fileNameStem('{YYYY}-{title}-notes', { title: '', date })).toBe(
      '2026-notes'
    )
    expect(fileNameStem('{title}', { title: '', date })).toBe('')
  })

  it('gives nothing for a pattern that can’t name files', () => {
    expect(fileNameStem('{slug}', { title, date })).toBe('')
  })
})

describe('parseFileNamePattern', () => {
  it('explains what’s wrong with a pattern', () => {
    expect(parseFileNamePattern('')).toHaveProperty('error')
    expect(parseFileNamePattern('posts/{title}')).toHaveProperty('error')
    expect(parseFileNamePattern('.{title}')).toHaveProperty('error')
    expect(parseFileNamePattern('{title')).toHaveProperty('error')
    expect(parseFileNamePattern('{yyyy-MM-dd}')).toHaveProperty('error')
    expect(parseFileNamePattern('{}')).toHaveProperty('error')
  })
})

describe('patternHasTitle', () => {
  it('is true only for valid patterns with {title}', () => {
    expect(patternHasTitle('{YYYY-MM-DD}-{title}')).toBe(true)
    expect(patternHasTitle('{YYYY-MM-DD}')).toBe(false)
    expect(patternHasTitle('{title}/{nope}')).toBe(false)
  })
})

describe('stemWithDate', () => {
  const newDate = new Date(2026, 2, 14)

  it('changes only the date, keeping the rest of the name', () => {
    expect(stemWithDate('2026-01-05', '{YYYY-MM-DD}', newDate)).toBe(
      '2026-03-14'
    )
    expect(
      stemWithDate('2026-01-05-my-own-name', '{YYYY-MM-DD}-{title}', newDate)
    ).toBe('2026-03-14-my-own-name')
    expect(stemWithDate('2026-01-05-1', '{YYYY-MM-DD}', newDate)).toBe(
      '2026-03-14'
    )
  })

  it('keeps the name when the date already matches', () => {
    expect(stemWithDate('2026-03-14-1', '{YYYY-MM-DD}', newDate)).toBe(
      '2026-03-14-1'
    )
  })

  it('is null when the name doesn’t follow the pattern, or it has no date', () => {
    expect(stemWithDate('first-post', '{YYYY-MM-DD}', newDate)).toBeNull()
    expect(stemWithDate('first-post', '{title}', newDate)).toBeNull()
  })
})
