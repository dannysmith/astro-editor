/**
 * What's wrong with how AE has read a project, for the project settings
 * dialog and the review toast. Text in backticks is shown as code.
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
  /** What to do about it */
  fix?: string
  /** The error AE got, verbatim */
  detail?: string
}

/** A path relative to the project, for showing */
export function relativePath(path: string, projectPath: string): string {
  if (path === projectPath) return '.'
  return path.startsWith(`${projectPath}/`)
    ? path.slice(projectPath.length + 1)
    : path
}

export function collectionProblems(
  collection: Collection,
  projectPath: string
): Problem[] {
  if (collection.kind === 'data') return []
  const folder = relativePath(collection.path, projectPath)
  const problems: Problem[] = []

  if (collection.folderStatus === 'missing') {
    problems.push({
      level: 'error',
      message: `Its folder, \`${folder}\`, doesn't exist.`,
      fix: 'Choose its folder in the settings below, or create it.',
    })
  } else if (collection.folderStatus === 'outsideProject') {
    problems.push({
      level: 'error',
      message: `Its folder, \`${folder}\`, is outside the project. Astro Editor only edits files inside the project.`,
    })
  }

  if (collection.patternError) {
    problems.push({
      level: 'warning',
      message:
        "Its pattern couldn't be read, so every Markdown file that doesn't start with `_` is treated as an entry.",
      detail: collection.patternError,
    })
  }

  if (collection.schemaStatus === 'unreadable') {
    problems.push({
      level: 'error',
      message:
        "Its generated schema couldn't be read, so the form only knows its image and reference fields.",
      fix: 'Run `astro sync` to generate it again.',
      detail: collection.schemaError ?? undefined,
    })
  } else if (collection.schemaStatus === 'notGenerated') {
    problems.push({
      level: 'warning',
      message:
        "There's no generated schema, so the form doesn't know its fields' types, defaults or which are required.",
      fix: 'Run `astro sync` in the project to generate it.',
    })
  }

  return problems
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
      message: `${reason}, so each folder in \`${content}\` is shown as a collection, without a schema.`,
      fix: 'If your content is somewhere else, set the content folder below.',
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
      message: "Astro Editor didn't find any collections to edit.",
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
