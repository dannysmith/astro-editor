/**
 * What a frontmatter field's footer says: every constraint the schema sets, and
 * whether the value meets it. AE is an editor, so this only ever informs: a
 * value outside its limits can still be typed and saved, and the real check
 * happens when Astro builds the site.
 */

import { parseIsoDate } from './dates'
import { FieldType, type FieldConstraints, type SchemaField } from './schema'

export interface FieldProblem {
  message: string
  /**
   * Whether to show it while the writer is in the field. A value on its way to
   * being valid (a half-typed URL, a word under its minimum) waits until they
   * leave; one that's gone over a limit shows at once
   */
  whileTyping: boolean
}

export interface FieldGuidance {
  /** The field's rules, and its default while it's empty */
  note: string | null
  /** How much of a length or list limit is used, like `46 / 100` */
  count: string | null
  problem: FieldProblem | null
}

/** Whether a field has no value: what a required field shouldn't be */
export function isEmptyValue(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  )
}

const plural = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? '' : 's'}`

/** A number's allowed range. Exclusive bounds (`gt`, `lt`) show as `> 0` */
function numberRange({
  min,
  max,
  minExclusive,
  maxExclusive,
}: FieldConstraints): string | null {
  if (
    min !== undefined &&
    max !== undefined &&
    !minExclusive &&
    !maxExclusive
  ) {
    return `${min}–${max}`
  }
  const parts: string[] = []
  if (min !== undefined)
    parts.push(minExclusive ? `> ${min}` : `At least ${min}`)
  if (max !== undefined)
    parts.push(maxExclusive ? `< ${max}` : `At most ${max}`)
  return parts.length > 0 ? parts.join(' • ') : null
}

/**
 * The lower bound of a length or list limit. Beside a count, which shows the
 * upper bound and what's being counted, it's kept short to fit a narrow panel
 */
function lowerBound(
  min: number | undefined,
  max: number | undefined,
  noun: string
): string | null {
  if (min === undefined) return null
  if (max === undefined) return `At least ${plural(min, noun)}`
  return min === max ? `Exactly ${min}` : `Min ${min}`
}

function formatName(field: SchemaField): 'URL' | 'Email' | null {
  const format = field.constraints?.format
  if (field.type === FieldType.URL || format === 'uri') return 'URL'
  if (field.type === FieldType.Email || format === 'email') return 'Email'
  return null
}

function defaultText(value: unknown): string | null {
  const isBlank =
    value === undefined ||
    value === '' ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === 'object' &&
      value !== null &&
      Object.keys(value).length === 0)
  if (isBlank) return null
  return `Default: ${typeof value === 'string' ? value : JSON.stringify(value)}`
}

function isUrl(text: string): boolean {
  try {
    new URL(text)
    return true
  } catch {
    return false
  }
}

/** Whether `text` matches `pattern`. One JavaScript can't read isn't checked */
function matchesPattern(text: string, pattern: string): boolean {
  try {
    return new RegExp(pattern).test(text)
  } catch {
    return true
  }
}

/** How a length or list count sits against its limits */
function countProblem(
  count: number,
  min: number | undefined,
  max: number | undefined
): FieldProblem | null {
  if (max !== undefined && count > max) {
    return { message: `${count - max} over`, whileTyping: true }
  }
  if (min !== undefined && count > 0 && count < min) {
    return { message: `${min - count} more needed`, whileTyping: false }
  }
  return null
}

function numberProblem(
  value: number,
  field: SchemaField,
  constraints: FieldConstraints
): FieldProblem | null {
  const { min, max, minExclusive, maxExclusive } = constraints
  const range = numberRange(constraints)
  const should = `Should be ${range?.replace('At', 'at')}`
  if (max !== undefined && (maxExclusive ? value >= max : value > max)) {
    return { message: should, whileTyping: true }
  }
  if (min !== undefined && (minExclusive ? value <= min : value < min)) {
    return { message: should, whileTyping: false }
  }
  if (field.type === FieldType.Integer && !Number.isInteger(value)) {
    return { message: 'Should be a whole number', whileTyping: false }
  }
  return null
}

function textProblem(
  value: string,
  field: SchemaField,
  constraints: FieldConstraints
): FieldProblem | null {
  const length = countProblem(
    value.length,
    constraints.minLength,
    constraints.maxLength
  )
  if (length) return length
  if (value === '') return null

  const format = formatName(field)
  if (format === 'URL' && !isUrl(value)) {
    return { message: "Doesn't look like a URL", whileTyping: false }
  }
  if (format === 'Email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return { message: "Doesn't look like an email", whileTyping: false }
  }
  if (constraints.pattern && !matchesPattern(value, constraints.pattern)) {
    return { message: "Doesn't match the format", whileTyping: false }
  }
  return null
}

function valueProblem(value: unknown, field: SchemaField): FieldProblem | null {
  if (isEmptyValue(value)) return null
  const constraints = field.constraints ?? {}

  if (field.type === FieldType.Enum && field.enumValues) {
    return field.enumValues.includes(String(value))
      ? null
      : { message: 'Not one of the options', whileTyping: true }
  }
  // Says what the file holds, since the picker can't show it
  if (field.type === FieldType.Date) {
    return typeof value === 'string' && parseIsoDate(value)
      ? null
      : { message: `Not a date: ${String(value)}`, whileTyping: true }
  }
  if (Array.isArray(value)) {
    return countProblem(
      value.length,
      constraints.minItems,
      constraints.maxItems
    )
  }
  if (typeof value === 'number') {
    return numberProblem(value, field, constraints)
  }
  if (typeof value === 'string') {
    return textProblem(value, field, constraints)
  }
  return null
}

/**
 * The footer for `field` holding `value`. Dropdowns and dates have no rules to
 * state, since the control only offers valid values, so they only speak up
 * about a value in the file that isn't one.
 */
export function fieldGuidance(
  field: SchemaField | undefined,
  value: unknown,
  { hideDefault = false }: { hideDefault?: boolean } = {}
): FieldGuidance {
  if (!field) return { note: null, count: null, problem: null }
  const constraints = field.constraints ?? {}
  const { minLength, maxLength, minItems, maxItems, pattern } = constraints

  const notes = [
    field.type === FieldType.Integer ? 'Whole number' : null,
    numberRange(constraints),
    lowerBound(minLength, maxLength, 'character'),
    lowerBound(minItems, maxItems, 'item'),
    formatName(field),
    pattern ? `Format: ${pattern}` : null,
    !hideDefault && isEmptyValue(value) ? defaultText(field.default) : null,
  ].filter(note => note !== null)

  let count: string | null = null
  if (maxLength !== undefined) {
    count = `${typeof value === 'string' ? value.length : 0} / ${maxLength}`
  } else if (maxItems !== undefined) {
    count = `${Array.isArray(value) ? value.length : 0} / ${maxItems}`
  }

  return {
    note: notes.length > 0 ? notes.join(' • ') : null,
    count,
    problem: valueProblem(value, field),
  }
}
