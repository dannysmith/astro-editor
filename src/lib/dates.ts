/**
 * Format a Date as an ISO date string (YYYY-MM-DD) using local timezone.
 * This avoids UTC conversion which can shift dates by a day in some timezones.
 */
export function formatIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Parse an ISO date or datetime string as a local Date (at local midnight).
 *
 * Handles various formats that may appear in YAML frontmatter:
 * - "2025-01-15" (date only)
 * - "2025-01-15T12:30:00Z" (datetime with Z)
 * - "2025-01-15T12:30:00+05:00" (datetime with offset)
 * - "2025-1-15" (unpadded, valid YAML)
 *
 * The time portion is ignored - we only extract the date and create local midnight.
 * This avoids timezone shifting that occurs with `new Date("YYYY-MM-DD")`.
 */
export function parseIsoDate(dateString: string): Date | undefined {
  // Extract just the date portion (before any 'T' or space)
  const datePart = dateString.split(/[T\s]/)[0]
  if (!datePart) return undefined

  // Match YYYY-MM-DD or YYYY-M-D (padded or unpadded)
  const match = datePart.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (!match) return undefined

  const [, year, month, day] = match
  const y = Number(year)
  const m = Number(month)
  const d = Number(day)

  // Create the date and verify components match (catches invalid dates like Feb 31)
  const date = new Date(y, m - 1, d)
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return undefined
  }

  return date
}

/**
 * Format a Date for display, e.g. "5 Oct 2026" or "Oct 5, 2026" depending on
 * the user's locale. The month is always a name because the webview can't see
 * every macOS region setting and may fall back to US order, where a numeric
 * date like 10/5/2026 is easy to misread.
 */
export function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function todayIsoDate(): string {
  return formatIsoDate(new Date())
}
