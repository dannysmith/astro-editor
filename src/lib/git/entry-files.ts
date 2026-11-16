import type { GitChange } from '@/lib/bindings'

/** Content files, which are never pulled into another entry's commit */
const CONTENT_FILE = /\.mdx?$/i

/**
 * Which of the project's changes belong with the open entry, so the Git tab
 * ticks them for its commit. The rest are "Other changes", unticked.
 *
 * - The entry itself.
 * - Changed or new files whose name appears in the entry's text (from the
 *   editor, not disk): markdown images, image fields, MDX imports and
 *   component props all hold the name. AE names dropped files
 *   `YYYY-MM-DD-name.ext`, so chance matches are rare. A name only matches
 *   whole, not as the end of a longer name.
 * - For a `folder/index.md(x)` entry, changed files in its folder (the
 *   colocated layout).
 * - `alsoInclude`: paths that belong with it for another reason, like the old
 *   path of a rename.
 *
 * Other content files never join, even when linked: committing another
 * article because this one links to it would be a surprise.
 *
 * Paths are relative to the repository root, as `GitChange` has them.
 */
export function entryChanges({
  changes,
  entryPath,
  entryText,
  alsoInclude = [],
}: {
  changes: GitChange[]
  /** Relative to the repository root. Empty when there's no entry. */
  entryPath: string
  entryText: string
  alsoInclude?: string[]
}): { entry: GitChange[]; others: GitChange[] } {
  if (!entryPath) return { entry: [], others: changes }
  const folder = /(^|\/)index\.mdx?$/i.test(entryPath)
    ? entryPath.slice(0, entryPath.lastIndexOf('/') + 1)
    : null

  const belongs = (change: GitChange) => {
    if (change.path === entryPath || alsoInclude.includes(change.path)) {
      return true
    }
    if (CONTENT_FILE.test(change.path)) return false
    if (folder !== null && change.path.startsWith(folder)) return true
    return mentions(entryText, fileName(change.path))
  }

  const entry: GitChange[] = []
  const others: GitChange[] = []
  for (const change of changes) (belongs(change) ? entry : others).push(change)
  // The entry first, then the rest in git's order
  entry.sort(
    (a, b) => Number(b.path === entryPath) - Number(a.path === entryPath)
  )
  return { entry, others }
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
