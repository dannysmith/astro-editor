import type { GitChange } from '@/lib/bindings'

/** Content files, which are never pulled into another entry's commit */
const CONTENT_FILE = /\.mdx?$/i

/**
 * The changed files the open entry uses, as paths: files its text (from the
 * editor, not disk) refers to, and for a `folder/index.md(x)` entry, the files
 * in its folder (the colocated layout). Markdown images, image fields, MDX
 * imports and component props all hold a reference.
 *
 * A relative reference (`./cover.jpg`, `../../assets/map.png`, a bare
 * `cover.jpg`) counts only for the file it resolves to from the entry's
 * folder, so another entry's `cover.jpg` isn't taken. Anything else (an alias
 * like `@assets/…`, a path from the project root or `public/`) counts for
 * any changed file of that name, since resolving it would mean reading the
 * project's config. A name only matches whole, not as the end of a longer
 * name, and AE names the files it copies in `YYYY-MM-DD-name.ext`, so chance
 * matches are rare.
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
  const entryFolder = entryPath.slice(0, entryPath.lastIndexOf('/') + 1)
  const colocated = /(^|\/)index\.mdx?$/i.test(entryPath)
  return changes
    .filter(
      change =>
        change.path !== entryPath &&
        !CONTENT_FILE.test(change.path) &&
        ((colocated && change.path.startsWith(entryFolder)) ||
          refersTo(entryText, change.path, entryFolder))
    )
    .map(change => change.path)
}

/**
 * The project's changes, sorted for the Git tab: the entry's own change, the
 * files it uses, files AE added for it this session that it no longer uses
 * (`added`), and everything else
 */
export function groupChanges({
  changes,
  entryPath,
  used,
  added,
}: {
  changes: GitChange[]
  entryPath: string
  used: string[]
  added: string[]
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
    else if (added.includes(change.path)) groups.unused.push(change)
    else groups.others.push(change)
  }
  return groups
}

export function fileName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

/**
 * An entry's name to show: its file name, with its folder for a
 * `folder/index.md(x)` entry (`trip/index.md`), since every one of those is
 * `index.md`
 */
export function entryName(path: string): string {
  const name = fileName(path)
  const slash = path.lastIndexOf('/')
  if (slash === -1 || !/^index\.mdx?$/i.test(name)) return name
  const folder = fileName(path.slice(0, slash))
  return folder ? `${folder}/${name}` : name
}

/** What can't be in a reference, unquoted, in markdown, YAML, JSON or JSX */
const REFERENCE_BOUNDARY = /[\s"'`()[\]<>{},=]/

/** A reference that isn't relative to the entry: from a root, an alias, a URL */
const NOT_RELATIVE = /^([/@~$#]|[a-z][a-z\d+.-]*:)/i

/**
 * Whether `text` refers to the file at `path` (both relative to the repository
 * root): has its name whole, not as the end of a longer one (`map.png` in
 * `old-map.png`), as written or URL-encoded, in a reference that's either not
 * relative or resolves to it from `entryFolder`
 */
function refersTo(text: string, path: string, entryFolder: string): boolean {
  const name = fileName(path)
  if (!name) return false
  return [name, encodeURI(name)].some(form => {
    for (
      let at = text.indexOf(form);
      at !== -1;
      at = text.indexOf(form, at + 1)
    ) {
      if (at > 0 && /[\w.-]/.test(text.charAt(at - 1))) continue
      let start = at
      while (start > 0 && !REFERENCE_BOUNDARY.test(text.charAt(start - 1))) {
        start--
      }
      const reference = decoded(text.slice(start, at + form.length))
      if (
        NOT_RELATIVE.test(reference) ||
        resolve(entryFolder, reference) === path
      ) {
        return true
      }
    }
    return false
  })
}

function decoded(reference: string): string {
  try {
    return decodeURI(reference)
  } catch {
    return reference
  }
}

/** `reference` resolved from `folder` (which ends with `/`, or is empty) */
function resolve(folder: string, reference: string): string {
  const segments: string[] = []
  for (const segment of `${folder}${reference}`.split('/')) {
    if (segment === '..') segments.pop()
    else if (segment && segment !== '.') segments.push(segment)
  }
  return segments.join('/')
}
