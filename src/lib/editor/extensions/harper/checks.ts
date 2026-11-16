/**
 * The Harper checks the Copyedit panel switches on and off. Each covers some
 * of Harper's lint kinds; a kind Harper adds later counts as grammar.
 */

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
] as const

export type HarperCheck = (typeof HARPER_CHECKS)[number]['id']

/** The check a Harper lint kind belongs to */
export function checkForKind(kind: string): HarperCheck {
  const check = HARPER_CHECKS.find(({ kinds }) =>
    (kinds as readonly string[]).includes(kind)
  )
  return check?.id ?? 'grammar'
}

/** Harper's English dialects, by the names of its `Dialect` enum */
export const HARPER_DIALECTS = [
  'American',
  'British',
  'Canadian',
  'Australian',
  'Indian',
] as const

export type HarperDialect = (typeof HARPER_DIALECTS)[number]
