import { describe, expect, it } from 'vitest'
import { formatIsoDate, parseIsoDate, todayIsoDate } from './dates'

describe('formatIsoDate', () => {
  it('formats a date as YYYY-MM-DD using local timezone', () => {
    // Create a date at local midnight
    const date = new Date(2025, 0, 15) // Jan 15, 2025 local time
    expect(formatIsoDate(date)).toBe('2025-01-15')
  })

  it('handles single-digit months and days with zero padding', () => {
    const date = new Date(2025, 2, 5) // March 5, 2025
    expect(formatIsoDate(date)).toBe('2025-03-05')
  })

  it('handles end of year dates', () => {
    const date = new Date(2025, 11, 31) // Dec 31, 2025
    expect(formatIsoDate(date)).toBe('2025-12-31')
  })

  it('round-trips correctly with parseIsoDate', () => {
    const original = new Date(2025, 5, 20) // June 20, 2025
    const formatted = formatIsoDate(original)
    const parsed = parseIsoDate(formatted)

    expect(parsed).toBeDefined()
    expect(parsed!.getFullYear()).toBe(2025)
    expect(parsed!.getMonth()).toBe(5) // June (0-indexed)
    expect(parsed!.getDate()).toBe(20)
  })
})

describe('parseIsoDate', () => {
  it('parses YYYY-MM-DD as local midnight', () => {
    const date = parseIsoDate('2025-01-15')

    expect(date).toBeDefined()
    expect(date!.getFullYear()).toBe(2025)
    expect(date!.getMonth()).toBe(0) // January (0-indexed)
    expect(date!.getDate()).toBe(15)
    expect(date!.getHours()).toBe(0)
    expect(date!.getMinutes()).toBe(0)
  })

  it('parses ISO datetime with Z suffix (extracts date only)', () => {
    const date = parseIsoDate('2025-01-15T12:30:00Z')

    expect(date).toBeDefined()
    expect(date!.getFullYear()).toBe(2025)
    expect(date!.getMonth()).toBe(0)
    expect(date!.getDate()).toBe(15)
    expect(date!.getHours()).toBe(0) // Local midnight, not 12:30
  })

  it('parses ISO datetime with timezone offset', () => {
    const date = parseIsoDate('2025-06-20T08:00:00+05:00')

    expect(date).toBeDefined()
    expect(date!.getFullYear()).toBe(2025)
    expect(date!.getMonth()).toBe(5) // June
    expect(date!.getDate()).toBe(20)
  })

  it('parses ISO datetime with negative offset', () => {
    const date = parseIsoDate('2025-03-10T23:59:59-08:00')

    expect(date).toBeDefined()
    expect(date!.getDate()).toBe(10)
  })

  it('parses unpadded dates (valid YAML)', () => {
    // YAML allows unpadded month/day
    const date1 = parseIsoDate('2025-1-5')
    expect(date1).toBeDefined()
    expect(date1!.getMonth()).toBe(0) // January
    expect(date1!.getDate()).toBe(5)

    const date2 = parseIsoDate('2025-12-1')
    expect(date2).toBeDefined()
    expect(date2!.getMonth()).toBe(11) // December
    expect(date2!.getDate()).toBe(1)
  })

  it('returns undefined for invalid format', () => {
    expect(parseIsoDate('01-15-2025')).toBeUndefined()
    expect(parseIsoDate('2025/01/15')).toBeUndefined()
    expect(parseIsoDate('not a date')).toBeUndefined()
    expect(parseIsoDate('')).toBeUndefined()
  })

  it('returns undefined for partial dates', () => {
    expect(parseIsoDate('2025-01')).toBeUndefined()
    expect(parseIsoDate('2025')).toBeUndefined()
  })

  it('returns undefined for invalid month/day values', () => {
    expect(parseIsoDate('2025-13-01')).toBeUndefined() // Invalid month
    expect(parseIsoDate('2025-00-15')).toBeUndefined() // Invalid month
    expect(parseIsoDate('2025-01-32')).toBeUndefined() // Invalid day
    expect(parseIsoDate('2025-01-00')).toBeUndefined() // Invalid day
  })

  it('parses dates that would be affected by UTC conversion', () => {
    // This is the key test for the timezone bug fix.
    // When parsed as UTC (like `new Date("2025-01-15")`), this would
    // display as Jan 14th in US timezones. parseIsoDate should always
    // return local midnight on the specified date.
    const date = parseIsoDate('2025-01-15')

    expect(date).toBeDefined()
    expect(date!.getDate()).toBe(15) // Should always be 15, not 14
  })

  it('handles datetime with T00:00:00Z (common from YAML)', () => {
    // YAML parsers often produce this format for date values
    const date = parseIsoDate('2024-01-15T00:00:00Z')

    expect(date).toBeDefined()
    expect(date!.getFullYear()).toBe(2024)
    expect(date!.getMonth()).toBe(0)
    expect(date!.getDate()).toBe(15)
  })

  it('handles datetime with milliseconds', () => {
    const date = parseIsoDate('2025-01-15T12:30:00.123Z')

    expect(date).toBeDefined()
    expect(date!.getFullYear()).toBe(2025)
    expect(date!.getMonth()).toBe(0)
    expect(date!.getDate()).toBe(15)
  })

  it('handles datetime with space separator (YAML alternate format)', () => {
    // YAML 1.1 allows space instead of T
    const date = parseIsoDate('2025-01-15 12:30:00')

    expect(date).toBeDefined()
    expect(date!.getFullYear()).toBe(2025)
    expect(date!.getMonth()).toBe(0)
    expect(date!.getDate()).toBe(15)
  })

  it('handles leap year date (Feb 29)', () => {
    const date = parseIsoDate('2024-02-29') // 2024 is a leap year

    expect(date).toBeDefined()
    expect(date!.getFullYear()).toBe(2024)
    expect(date!.getMonth()).toBe(1) // February
    expect(date!.getDate()).toBe(29)
  })

  it('handles year boundary dates', () => {
    const jan1 = parseIsoDate('2025-01-01')
    expect(jan1).toBeDefined()
    expect(jan1!.getMonth()).toBe(0)
    expect(jan1!.getDate()).toBe(1)

    const dec31 = parseIsoDate('2025-12-31')
    expect(dec31).toBeDefined()
    expect(dec31!.getMonth()).toBe(11)
    expect(dec31!.getDate()).toBe(31)
  })

  it('round-trips datetime strings correctly', () => {
    // When we receive a datetime string and the user doesn't change it,
    // the date should remain the same after round-trip
    const inputs = [
      '2025-01-15T00:00:00Z',
      '2025-06-20T12:30:00+05:00',
      '2025-12-31T23:59:59-08:00',
    ]

    for (const input of inputs) {
      const parsed = parseIsoDate(input)
      expect(parsed).toBeDefined()
      const formatted = formatIsoDate(parsed!)
      const reparsed = parseIsoDate(formatted)

      expect(reparsed).toBeDefined()
      expect(reparsed!.getFullYear()).toBe(parsed!.getFullYear())
      expect(reparsed!.getMonth()).toBe(parsed!.getMonth())
      expect(reparsed!.getDate()).toBe(parsed!.getDate())
    }
  })
})

describe('todayIsoDate', () => {
  it('returns today in YYYY-MM-DD format', () => {
    const today = todayIsoDate()
    const now = new Date()

    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    const parsed = parseIsoDate(today)
    expect(parsed).toBeDefined()
    expect(parsed!.getFullYear()).toBe(now.getFullYear())
    expect(parsed!.getMonth()).toBe(now.getMonth())
    expect(parsed!.getDate()).toBe(now.getDate())
  })
})
