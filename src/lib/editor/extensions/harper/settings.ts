/**
 * Harper's settings, read and written for the Copyedit panel and preferences.
 * They're global settings, so they survive restarts; the extension follows
 * them (see extension.ts).
 */

import type { CopyeditSettings, Dialect, GlobalSettings } from '@/lib/bindings'
import { useProjectStore } from '@/store/projectStore'
import type { HarperCheck } from './checks'

/** Harper's settings. Every check is off until the settings have loaded */
export function readCopyedit(
  settings: GlobalSettings | null
): CopyeditSettings {
  const copyedit = settings?.copyedit
  return {
    dialect: copyedit?.dialect ?? 'american',
    checks: {
      spelling: copyedit?.checks.spelling ?? false,
      grammar: copyedit?.checks.grammar ?? false,
      style: copyedit?.checks.style ?? false,
    },
    dictionary: copyedit?.dictionary ?? [],
  }
}

function current(): CopyeditSettings {
  return readCopyedit(useProjectStore.getState().globalSettings)
}

function save(copyedit: Partial<CopyeditSettings>) {
  void useProjectStore.getState().updateGlobalSettings({ copyedit })
}

export function setCheck(check: HarperCheck, on: boolean) {
  save({ checks: { ...current().checks, [check]: on } })
}

export function setDialect(dialect: Dialect) {
  save({ dialect })
}

/** Adds words to the dictionary, ignoring ones already in it */
export function addWords(words: string[]) {
  const { dictionary } = current()
  const added = words.filter(word => word && !dictionary.includes(word))
  if (added.length > 0) save({ dictionary: [...dictionary, ...added] })
}

export function setDictionary(words: string[]) {
  save({ dictionary: words })
}
