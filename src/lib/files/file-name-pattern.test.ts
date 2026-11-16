import { describe, expect, it } from 'vitest'
import {
  fileNameStem,
  nextIndex,
  parseFileNamePattern,
  patternHasIndex,
  patternHasTitle,
  stemWithDate,
} from './file-name-pattern'

const date = new Date(2026, 0, 5)
const now = new Date(2026, 10, 12, 21, 58, 7)
const title = 'My Trip to the Lake'
const values = { title, date, now, index: 3 }

describe('fileNameStem', () => {
  it('fills in the title as a full or short slug', () => {
    expect(fileNameStem('{slug}', values)).toBe('my-trip-to-the-lake')
    expect(fileNameStem('{title}', values)).toBe('my-trip-to-the-lake')
    expect(fileNameStem('{shortSlug}', values)).toBe('trip-lake')
  })

  it('fills in the published date and the time it’s named', () => {
    expect(fileNameStem('{YYYY-MM-DD}-{slug}', values)).toBe(
      '2026-01-05-my-trip-to-the-lake'
    )
    expect(fileNameStem('{YY}{MM}{D}_{shortSlug}', values)).toBe(
      '26015_trip-lake'
    )
    expect(fileNameStem('{YYYYMMDDHHmmss}', values)).toBe('20260105215807')
    expect(fileNameStem('{H}h{m}m{s}s', values)).toBe('21h58m7s')
    expect(fileNameStem('{X}', values)).toBe(
      String(Math.floor(now.getTime() / 1000))
    )
    expect(fileNameStem('{x}', values)).toBe(String(now.getTime()))
  })

  it('fills in the number, padded to its width', () => {
    expect(fileNameStem('{index}-{slug}', values)).toBe('3-my-trip-to-the-lake')
    expect(fileNameStem('{index:2}-{slug}', values)).toBe(
      '03-my-trip-to-the-lake'
    )
  })

  it('keeps the times and number in the current name', () => {
    const named = { ...values, current: '2025-12-01-0930-07-old-title' }
    expect(fileNameStem('{YYYY-MM-DD}-{HHmm}-{index:2}-{slug}', named)).toBe(
      '2026-01-05-0930-07-my-trip-to-the-lake'
    )
    // Even when it was named before it had a title
    expect(
      fileNameStem('{YYYYMMDDHHmm}-{slug}', {
        ...values,
        current: '202601050930',
      })
    ).toBe('202601050930-my-trip-to-the-lake')
    // But not when it doesn't follow the pattern
    expect(fileNameStem('{HHmm}-{slug}', { ...values, current: 'trip' })).toBe(
      '2158-my-trip-to-the-lake'
    )
  })

  it('drops the hyphens around a missing title', () => {
    const untitled = { ...values, title: '' }
    expect(fileNameStem('{YYYY-MM-DD}-{slug}', untitled)).toBe('2026-01-05')
    expect(fileNameStem('{YYYY}-{slug}-notes', untitled)).toBe('2026-notes')
    expect(fileNameStem('{index}-{slug}', untitled)).toBe('3')
    expect(fileNameStem('{slug}', untitled)).toBe('')
  })

  it('gives nothing for a pattern that can’t name files', () => {
    expect(fileNameStem('{name}', values)).toBe('')
  })
})

describe('parseFileNamePattern', () => {
  it('explains what’s wrong with a pattern', () => {
    expect(parseFileNamePattern('')).toHaveProperty('error')
    expect(parseFileNamePattern('posts/{slug}')).toHaveProperty('error')
    expect(parseFileNamePattern('.{slug}')).toHaveProperty('error')
    expect(parseFileNamePattern('{slug')).toHaveProperty('error')
    expect(parseFileNamePattern('{yyyy-MM-dd}')).toHaveProperty('error')
    expect(parseFileNamePattern('{index:0}')).toHaveProperty('error')
    expect(parseFileNamePattern('{-}')).toHaveProperty('error')
    expect(parseFileNamePattern('{}')).toHaveProperty('error')
  })
})

describe('patternHasTitle and patternHasIndex', () => {
  it('are true only for valid patterns with the placeholder', () => {
    expect(patternHasTitle('{YYYY-MM-DD}-{slug}')).toBe(true)
    expect(patternHasTitle('{shortSlug}')).toBe(true)
    expect(patternHasTitle('{YYYY-MM-DD}')).toBe(false)
    expect(patternHasTitle('{slug}/{nope}')).toBe(false)
    expect(patternHasIndex('{index:2}-{slug}')).toBe(true)
    expect(patternHasIndex('{slug}')).toBe(false)
  })
})

describe('nextIndex', () => {
  it('is the number after the highest in the folder', () => {
    const names = ['01-welcome', '02-install', '3', 'notes', '07-x-1']
    expect(nextIndex('{index:2}-{slug}', names)).toBe(8)
    expect(nextIndex('{index:2}-{slug}', ['notes'])).toBe(1)
    expect(nextIndex('{slug}', names)).toBe(1)
    // Hyphens the pattern doubles are merged in the names it gives
    expect(nextIndex('{index:2}--{slug}', ['01-welcome'])).toBe(2)
  })
})

describe('stemWithDate', () => {
  const newDate = new Date(2026, 2, 14)

  it('changes only the date, keeping the rest of the name', () => {
    expect(stemWithDate('2026-01-05', '{YYYY-MM-DD}', newDate)).toBe(
      '2026-03-14'
    )
    expect(
      stemWithDate('2026-01-05-my-own-name', '{YYYY-MM-DD}-{slug}', newDate)
    ).toBe('2026-03-14-my-own-name')
    expect(stemWithDate('2026-01-05-1', '{YYYY-MM-DD}', newDate)).toBe(
      '2026-03-14'
    )
    expect(stemWithDate('202601052158', '{YYYYMMDDHHmm}', newDate)).toBe(
      '202603142158'
    )
    // A file named before it had a title
    expect(stemWithDate('2026-01-05', '{YYYY-MM-DD}-{slug}', newDate)).toBe(
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
    expect(stemWithDate('first-post', '{slug}', newDate)).toBeNull()
    expect(stemWithDate('1794866280', '{X}', newDate)).toBeNull()
  })
})
