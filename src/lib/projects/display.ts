/**
 * How projects are named and described in the UI. A project is shown by its
 * folder name, as Finder and the title bar show it.
 */

/** A project's folder name */
export function projectName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path
}

/** `path` with the home folder written as `~` */
export function tildePath(path: string, home: string | null): string {
  const base = home?.replace(/[\\/]+$/, '')
  if (!base || (path !== base && !path.startsWith(`${base}/`))) return path
  return `~${path.slice(base.length)}`
}

/**
 * When a project was last opened, relative to `now`: "Just now", "5 minutes
 * ago", "3 hours ago", "Yesterday", "4 days ago", then a date like "28 Mar"
 * (with the year if it isn't this one)
 */
export function formatLastOpened(iso: string, now: Date = new Date()): string {
  const ago = howLongAgo(new Date(iso), now)
  return 'phrase' in ago
    ? ago.phrase.charAt(0).toUpperCase() + ago.phrase.slice(1)
    : ago.date
}

/**
 * How long before `now` a time was: a phrase within the week ("just now",
 * "5 minutes ago", "3 hours ago", "yesterday", "4 days ago"), then a date
 * like "28 Mar" (with the year if it isn't this one). Which it is decides how
 * it reads in a sentence ("committed yesterday", "committed on 28 Mar").
 */
export function howLongAgo(
  date: Date,
  now: Date = new Date()
): { phrase: string } | { date: string } {
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000)
  if (minutes < 1) return { phrase: 'just now' }
  if (minutes < 60) {
    return { phrase: minutes === 1 ? '1 minute ago' : `${minutes} minutes ago` }
  }
  const hours = Math.floor(minutes / 60)
  if (hours < 24 && date.getDate() === now.getDate()) {
    return { phrase: hours === 1 ? '1 hour ago' : `${hours} hours ago` }
  }

  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000)
  if (days <= 1) return { phrase: 'yesterday' }
  if (days < 7) return { phrase: `${days} days ago` }
  return {
    date: date.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
    }),
  }
}
