/**
 * What's wrong with how AE has read a project, for the project settings
 * dialog, the file list and the review toast. Text in backticks is shown as
 * code.
 *
 * Errors mean a collection can't be used properly: its folder is missing or
 * outside the project, or its schema can't be read. Warnings mean AE is
 * working with less than it could: no generated schema, an unreadable
 * pattern, no readable config. Neither is shown for things that work but could
 * be better read, since the file list shows statuses all the time:
 * - an unknown loader whose folder exists, which the collection page explains;
 * - a field mapping with nothing to go on (no `draft` field, say), which
 *   plenty of sites don't need and the setting explains.
 */

import type { Collection, ProjectScan } from '@/lib/bindings'

export type StatusLevel = 'ok' | 'warning' | 'error'

export interface Problem {
  level: 'warning' | 'error'
  message: string
  /** What to do about it, when there's no button that does it */
  fix?: string
  /** A button that fixes it: choosing the collection's folder */
  action?: 'chooseFolder'
  /** The error AE got, verbatim */
  detail?: string
}

/**
 * A path relative to the project, with `/` separators whatever the platform,
 * or null if it's outside the project
 */
export function pathInProject(
  path: string,
  projectPath: string
): string | null {
  const normalise = (p: string) => p.replaceAll('\\', '/').replace(/\/+$/, '')
  const inner = normalise(path)
  const root = normalise(projectPath)
  if (inner === root) return '.'
  return inner.startsWith(`${root}/`) ? inner.slice(root.length + 1) : null
}

/** A path relative to the project, for showing */
export function relativePath(path: string, projectPath: string): string {
  return pathInProject(path, projectPath) ?? path
}

/**
 * A collection whose loader AE can't read and whose folder isn't where AE
 * looked by its name. Its entries usually don't come from files at all (an API,
 * say), so it isn't a problem, just not something AE edits. A folder the user
 * chose that's missing is still an error.
 */
export function isUnreadLoader(collection: Collection): boolean {
  return (
    collection.kind === 'unknown' &&
    collection.folderStatus === 'missing' &&
    collection.folderSource !== 'set'
  )
}

export function collectionProblems(
  collection: Collection,
  projectPath: string
): Problem[] {
  if (collection.kind === 'data' || isUnreadLoader(collection)) return []
  const folder = relativePath(collection.path, projectPath)
  const problems: Problem[] = []

  if (collection.folderStatus === 'missing') {
    problems.push({
      level: 'error',
      message: `Its folder, \`${folder}\`, doesn't exist.`,
      action: 'chooseFolder',
    })
  } else if (collection.folderStatus === 'outsideProject') {
    problems.push({
      level: 'error',
      message: `Its folder, \`${folder}\`, is outside the project. Only files in the project can be edited.`,
      action: 'chooseFolder',
    })
  }

  // A glob's folder only comes from the convention when its `base` couldn't be
  // read (built from variables, say)
  if (collection.kind === 'glob' && collection.folderSource === 'convention') {
    problems.push({
      level: 'warning',
      message: `Its loader's \`base\` couldn't be read, so its folder is assumed to be \`${folder}\`.`,
      // A missing folder's error already has the button
      action:
        collection.folderStatus === 'missing' ? undefined : 'chooseFolder',
    })
  }

  if (collection.patternError) {
    problems.push({
      level: 'warning',
      message:
        "Its file pattern couldn't be read, so every Markdown file not starting with `_` is listed.",
      detail: collection.patternError,
    })
  }

  if (collection.schemaStatus === 'unreadable') {
    problems.push({
      level: 'error',
      message:
        "Its generated schema couldn't be read, so only its image and reference fields are known.",
      fix: 'Run `astro sync` in the project to generate it again.',
      detail: collection.schemaError ?? undefined,
    })
  } else if (collection.schemaStatus === 'notGenerated') {
    problems.push({
      level: 'warning',
      message:
        "Astro hasn't generated its schema yet, so the frontmatter panel doesn't know its fields' types, defaults or which are required.",
      fix: 'Run `astro sync` in the project to generate it.',
    })
  }

  // Errors first: the file list's tooltip shows the first, beside the icon
  // for the worst
  return problems.sort(
    (a, b) => Number(b.level === 'error') - Number(a.level === 'error')
  )
}

export function projectProblems(scan: ProjectScan): Problem[] {
  const content = scan.projectSettings.contentDirectory.value
  const problems: Problem[] = []

  if (scan.fallback) {
    const reason = !scan.configPath
      ? "There's no content config"
      : scan.configError
        ? `The content config, \`${scan.configPath}\`, couldn't be read`
        : `None of the collections in \`${scan.configPath}\` could be read`
    problems.push({
      level: 'warning',
      message: `${reason}, so each folder in \`${content}\` is listed as a collection, without a schema.`,
      fix: 'If your content is somewhere else, change the content folder below.',
      detail: scan.configError ?? undefined,
    })
  } else if (scan.configError) {
    problems.push({
      level: 'warning',
      message: `Part of the content config, \`${scan.configPath}\`, couldn't be read.`,
      detail: scan.configError,
    })
  }

  if (scan.collections.every(c => c.kind === 'data')) {
    problems.push({
      level: 'warning',
      message: 'There are no collections to edit.',
    })
  }

  return problems
}

export function statusLevel(problems: Problem[]): StatusLevel {
  if (problems.some(p => p.level === 'error')) return 'error'
  return problems.length > 0 ? 'warning' : 'ok'
}

/** Whether anything in the project has a problem worth reviewing */
export function hasProblems(scan: ProjectScan, projectPath: string): boolean {
  return (
    projectProblems(scan).length > 0 ||
    scan.collections.some(c => collectionProblems(c, projectPath).length > 0)
  )
}
