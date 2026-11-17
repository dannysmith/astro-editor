import type { GitChange } from '@/lib/bindings'

/** Content files, which are never pulled into another entry's commit */
const CONTENT_FILE = /\.mdx?$/i

/**
 * The changed files the open entry uses, as paths: files whose name appears in
 * its text (from the editor, not disk), and for a `folder/index.md(x)` entry,
 * the files in its folder (the colocated layout). Markdown images, image
 * fields, MDX imports and component props all hold the name. AE names dropped
 * files `YYYY-MM-DD-name.ext`, so chance matches are rare, and a name only
 * matches whole, not as the end of a longer name.
 *
 * Other content files never count, even when linked: committing another
 * article because this one links to it would be a surprise.
 *
 * Paths are relative to the repository root, as `GitChange` has them.
 */
export function usedFiles({
  changes,
  entryPath,
  entryText,
}: {
  changes: GitChange[]
  /** Relative to the repository root. Empty when there's no entry. */
  entryPath: string
  entryText: string
}): string[] {
  if (!entryPath) return []
  const folder = /(^|\/)index\.mdx?$/i.test(entryPath)
    ? entryPath.slice(0, entryPath.lastIndexOf('/') + 1)
    : null
  return changes
    .filter(
      change =>
        change.path !== entryPath &&
        !CONTENT_FILE.test(change.path) &&
        ((folder !== null && change.path.startsWith(folder)) ||
          mentions(entryText, fileName(change.path)))
    )
    .map(change => change.path)
}

/**
 * The project's changes, sorted for the Git tab: the entry's own change, the
 * files it uses, files it used earlier this session (`named`) that are still
 * changed, and everything else
 */
export function groupChanges({
  changes,
  entryPath,
  used,
  named,
}: {
  changes: GitChange[]
  entryPath: string
  used: string[]
  named: string[]
}): {
  entry: GitChange | null
  used: GitChange[]
  unused: GitChange[]
  others: GitChange[]
} {
  const groups = {
    entry: null as GitChange | null,
    used: [] as GitChange[],
    unused: [] as GitChange[],
    others: [] as GitChange[],
  }
  for (const change of changes) {
    if (entryPath && change.path === entryPath) groups.entry = change
    else if (used.includes(change.path)) groups.used.push(change)
    else if (named.includes(change.path)) groups.unused.push(change)
    else groups.others.push(change)
  }
  return groups
}

export function fileName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

/**
 * Whether `text` has `name` as a whole name: not the end of a longer one
 * (`map.png` in `old-map.png`), and as written or URL-encoded
 */
function mentions(text: string, name: string): boolean {
  if (!name) return false
  return [name, encodeURI(name)].some(form => {
    let at = text.indexOf(form)
    while (at !== -1) {
      if (at === 0 || !/[\w.-]/.test(text.charAt(at - 1))) return true
      at = text.indexOf(form, at + 1)
    }
    return false
  })
}
