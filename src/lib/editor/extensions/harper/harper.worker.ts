/**
 * Harper's own Web Worker. It runs harper.js's `LocalLinter`, so only this
 * thread loads Harper's WebAssembly (about 20 MB), and it answers with plain
 * data. harper.js's `WorkerLinter` would load a second copy on the main
 * thread to rebuild each issue, and never reports an error.
 *
 * `linter.ts` is the other end: it posts `{ id, method, args }` and gets back
 * `{ id, value }` or `{ id, error }`. Requests are handled one at a time.
 */

import { Dialect, LocalLinter } from 'harper.js'
import { binary } from 'harper.js/binary'

/**
 * Rules turned off for every check, as well as the `Expand…` rules, which ask
 * for abbreviations like "config" and "ctrl" to be spelled out
 */
const RULES_OFF = [
  // Masking syntax out of the text leaves runs of spaces
  'Spaces',
  'NoFrenchSpaces',
  // House style, not mistakes
  'OxfordComma',
  'UseEllipsisCharacter',
  'NumericRangeEnDash',
  'AvoidCurses',
  'Gonna',
  'Gotta',
  'Wanna',
  // Mostly wrong on blogs and docs: "file names" → "filenames", "auto-save"
  // → "autosave", "a greeting" as a mass noun, "plugin" as a phrasal verb,
  // "unclosed" and "dedent" as negatives meant to be other words
  'CompoundNouns',
  'DisjointPrefixes',
  'MassNouns',
  'PhrasalVerbAsCompoundNoun',
  'WrongNegative',
]

/**
 * Words every Astro project uses that Harper doesn't know. Short on purpose:
 * acronyms and names inside a sentence are never flagged (`filter.ts`), so
 * this only needs words that are lowercase or start sentences.
 */
const ASTRO_WORDS = [
  'Astro',
  "Astro's",
  'Astro’s',
  'frontmatter',
  'blockquote',
  'blockquotes',
  'Markdoc',
  'Starlight',
  'pnpm',
  'npx',
]

/** Harper's dialects, by the names of its `Dialect` enum */
export type DialectName = keyof typeof Dialect

export interface WorkerSettings {
  dialect: DialectName
  /** The user's dictionary */
  dictionary: string[]
  /** Ignored issues as Harper exports them, used when the linter is made */
  ignored: string | null
}

/** An issue Harper found, as plain data */
export interface HarperLint {
  /** The rule that found it */
  rule: string
  /** Its kind, like `WordChoice` */
  kind: string
  /** Its kind for people, like "Word Choice" */
  kindLabel: string
  start: number
  end: number
  message: string
  /** The message as HTML, which marks the words it quotes as code */
  messageHtml: string
  /** The issue's text, as Harper read it */
  problem: string
  /** `kind` is harper.js's `SuggestionKind`: replace, remove or insert after */
  suggestions: { kind: number; text: string }[]
  /** Identifies the issue and the text around it, for ignoring it */
  hash: string
}

let linter: LocalLinter | null = null
/** What the linter was made with and given, so it's only changed when they change */
let dialect: DialectName | null = null
let words: string | null = null

async function makeLinter(settings: WorkerSettings): Promise<LocalLinter> {
  // A new dialect needs a new linter, which keeps the old one's ignores
  const ignored = linter ? await linter.exportIgnoredLints() : settings.ignored
  const made = new LocalLinter({ binary, dialect: Dialect[settings.dialect] })
  await made.setup()
  const rules = Object.keys(await made.getDefaultLintConfig())
  await made.setLintConfig(
    Object.fromEntries(
      rules
        .filter(rule => rule.startsWith('Expand') || RULES_OFF.includes(rule))
        .map(rule => [rule, false])
    )
  )
  if (ignored) await made.importIgnoredLints(ignored)
  return made
}

function current(): LocalLinter {
  if (!linter) throw new Error('Harper has no settings yet')
  return linter
}

const api = {
  /** Applies the settings, making the linter the first time */
  async configure(settings: WorkerSettings): Promise<void> {
    if (!linter || settings.dialect !== dialect) {
      linter = await makeLinter(settings)
      dialect = settings.dialect
      words = null
    }
    const all = [...ASTRO_WORDS, ...settings.dictionary]
    if (all.join('\n') !== words) {
      await linter.clearWords()
      await linter.importWords(all)
      words = all.join('\n')
    }
  },

  /** The issues in prose from `proseText`, which masks with `regexMask` */
  async lint(text: string, regexMask: string): Promise<HarperLint[]> {
    const linter = current()
    const byRule = await linter.organizedLints(text, {
      language: 'plaintext',
      regex_mask: regexMask,
    })
    const found: HarperLint[] = []
    for (const [rule, lints] of Object.entries(byRule)) {
      for (const lint of lints) {
        const span = lint.span()
        found.push({
          rule,
          kind: lint.lint_kind(),
          kindLabel: lint.lint_kind_pretty(),
          start: span.start,
          end: span.end,
          message: lint.message(),
          messageHtml: lint.message_html(),
          problem: lint.get_problem_text(),
          suggestions: lint.suggestions().map(suggestion => ({
            kind: Number(suggestion.kind()),
            text: suggestion.get_replacement_text(),
          })),
          hash: String(await linter.contextHash(text, lint)),
        })
        lint.free()
      }
    }
    return found
  },

  /** Ignores an issue by its hash, returning every ignore to store */
  async ignore(hash: string): Promise<string> {
    const linter = current()
    await linter.ignoreLintHash(BigInt(hash))
    return linter.exportIgnoredLints()
  },

  async clearIgnored(): Promise<void> {
    await current().clearIgnoredLints()
  },
}

export type HarperApi = typeof api

export interface HarperRequest {
  id: number
  method: keyof HarperApi
  args: unknown[]
}

export type HarperResponse =
  | { id: number; value: unknown }
  | { id: number; error: string }

/** The worker's global scope (the project's types describe a window) */
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<HarperRequest>) => void) | null
  postMessage: (response: HarperResponse) => void
}

let queue: Promise<void> = Promise.resolve()

scope.onmessage = ({ data }) => {
  queue = queue.then(async () => {
    try {
      const method = api[data.method] as (...args: unknown[]) => unknown
      scope.postMessage({ id: data.id, value: await method(...data.args) })
    } catch (error) {
      scope.postMessage({ id: data.id, error: String(error) })
    }
  })
}
