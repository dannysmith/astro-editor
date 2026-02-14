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

  // Basic validation
  if (m < 1 || m > 12 || d < 1 || d > 31) return undefined

  return new Date(y, m - 1, d)
}

export function todayIsoDate(): string {
  return formatIsoDate(new Date())
}
