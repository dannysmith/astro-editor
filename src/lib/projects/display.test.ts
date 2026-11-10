import { describe, expect, it } from 'vitest'
import { formatLastOpened, projectName, tildePath } from './display'

describe('projectName', () => {
  it('is the folder name', () => {
    expect(projectName('/Users/me/sites/blog')).toBe('blog')
    expect(projectName('/Users/me/sites/blog/')).toBe('blog')
    expect(projectName('C:\\sites\\blog')).toBe('blog')
  })
})

describe('tildePath', () => {
  it('writes the home folder as ~', () => {
    expect(tildePath('/Users/me/sites/blog', '/Users/me')).toBe('~/sites/blog')
    expect(tildePath('/Users/me/sites/blog', '/Users/me/')).toBe('~/sites/blog')
  })

  it('leaves other paths alone', () => {
    expect(tildePath('/Users/meg/blog', '/Users/me')).toBe('/Users/meg/blog')
    expect(tildePath('/Volumes/work/blog', null)).toBe('/Volumes/work/blog')
  })
})

describe('formatLastOpened', () => {
  // Local times, so the calendar-day checks don't depend on the timezone
  const now = new Date(2026, 10, 5, 15, 0)
  const ago = (minutes: number) =>
    new Date(now.getTime() - minutes * 60_000).toISOString()

  it('is relative for the last week', () => {
    expect(formatLastOpened(ago(0), now)).toBe('Just now')
    expect(formatLastOpened(ago(1), now)).toBe('1 minute ago')
    expect(formatLastOpened(ago(45), now)).toBe('45 minutes ago')
    expect(formatLastOpened(ago(60), now)).toBe('1 hour ago')
    expect(formatLastOpened(ago(14 * 60), now)).toBe('14 hours ago')
    expect(formatLastOpened(ago(16 * 60), now)).toBe('Yesterday')
    expect(formatLastOpened(ago(3 * 24 * 60), now)).toBe('3 days ago')
  })

  it('is a date after that, with the year only if it is not this one', () => {
    const march = new Date(2026, 2, 28, 12).toISOString()
    const lastYear = new Date(2025, 2, 28, 12).toISOString()
    expect(formatLastOpened(march, now)).toMatch(/28/)
    expect(formatLastOpened(march, now)).not.toMatch(/2026/)
    expect(formatLastOpened(lastYear, now)).toMatch(/2025/)
  })
})
