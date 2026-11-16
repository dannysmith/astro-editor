/**
 * The Harper checks the Copyedit panel switches on and off. Each covers some
 * of Harper's lint kinds; a kind Harper adds later counts as grammar.
 */

import type { CopyeditChecks, Dialect } from '@/lib/bindings'

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

/** The check a Harper lint kind belongs to */
export function checkForKind(kind: string): HarperCheck {
  const check = HARPER_CHECKS.find(({ kinds }) =>
    (kinds as readonly string[]).includes(kind)
  )
  return check?.id ?? 'grammar'
}

/** Each dialect setting, with its name in harper.js's `Dialect` enum */
export const HARPER_DIALECTS: Record<
  Dialect,
  'American' | 'British' | 'Canadian' | 'Australian' | 'Indian'
> = {
  american: 'American',
  british: 'British',
  canadian: 'Canadian',
  australian: 'Australian',
  indian: 'Indian',
}
