/**
 * The Harper checks the Copyedit panel switches on and off. Each covers some
 * of Harper's lint kinds; a kind Harper adds later counts as grammar.
 */

import type { CopyeditChecks, Dialect } from '@/lib/bindings'
import type { DialectName } from './harper.worker'

export const HARPER_CHECKS = [
  {
    id: 'spelling',
    label: 'Spelling',
    kinds: ['Spelling', 'Typo'],
  },
  {
    id: 'grammar',
    label: 'Grammar',
    kinds: [
      'Grammar',
      'Agreement',
      'Punctuation',
      'Capitalization',
      'WordOrder',
      'BoundaryError',
      'Malapropism',
      'Eggcorn',
      'Usage',
      'Nonstandard',
      'WordChoice',
      'Formatting',
      'Miscellaneous',
    ],
  },
  {
    id: 'style',
    label: 'Style',
    kinds: [
      'Style',
      'Readability',
      'Redundancy',
      'Repetition',
      'Enhancement',
      'Regionalism',
    ],
  },
] as const satisfies readonly {
  id: HarperCheck
  label: string
  kinds: readonly string[]
}[]

export type HarperCheck = keyof CopyeditChecks

/** Each check's colour: its underlines, and its issues in the panel */
export const CHECK_COLOURS: Record<HarperCheck, string> = {
  spelling: 'var(--editor-color-red)',
  grammar: 'var(--editor-color-blue)',
  style: 'var(--editor-color-green)',
}

/** The check a Harper lint kind belongs to */
export function checkForKind(kind: string): HarperCheck {
  const check = HARPER_CHECKS.find(({ kinds }) =>
    (kinds as readonly string[]).includes(kind)
  )
  return check?.id ?? 'grammar'
}

/** Each dialect setting, with its name in harper.js's `Dialect` enum */
export const HARPER_DIALECTS: Record<Dialect, DialectName> = {
  american: 'American',
  british: 'British',
  canadian: 'Canadian',
  australian: 'Australian',
  indian: 'Indian',
}
