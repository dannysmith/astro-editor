export function formatIsoDate(date: Date): string {
  return date.toISOString().split('T')[0]!
}

export function todayIsoDate(): string {
  return formatIsoDate(new Date())
}
