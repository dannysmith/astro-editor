/**
 * Harper's own Web Worker. It runs harper.js's `LocalLinter`, so only this
 * thread loads Harper's WebAssembly (about 20 MB), and it answers with plain
 * data. harper.js's `WorkerLinter` would load a second copy on the main
 * thread to rebuild each issue, and never reports an error.
 *
 * `linter.ts` is the other end: it posts `{ id, method, args }` and gets back
 * `{ id, value }` or `{ id, error }`. Requests are handled one at a time.
 */

import { Dialect, type Lint, LocalLinter } from 'harper.js'
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
}

let linter: LocalLinter | null = null
/** What the linter was made with and given, so it's only changed when they change */
let dialect: DialectName | null = null
let words: string | null = null

/**
 * The last text checked and Harper's issues in it, kept so an issue can be
 * ignored without checking again. Ignoring hashes the issue with the whole
 * text around it, which is too slow to do for every issue in every check on
 * a long document.
 */
let checked: { text: string; lints: { rule: string; lint: Lint }[] } | null =
  null

function forgetChecked() {
  for (const { lint } of checked?.lints ?? []) lint.free()
  checked = null
}

async function check(text: string, regexMask: string) {
  if (checked?.text === text) return checked
  const byRule = await current().organizedLints(text, {
    language: 'plaintext',
    regex_mask: regexMask,
  })
  forgetChecked()
  checked = {
    text,
    lints: Object.entries(byRule).flatMap(([rule, lints]) =>
      lints.map(lint => ({ rule, lint }))
    ),
  }
  return checked
}

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
      forgetChecked()
      linter = await makeLinter(settings)
      dialect = settings.dialect
      words = null
    }
    const all = [...ASTRO_WORDS, ...settings.dictionary]
    if (all.join('\n') !== words) {
      forgetChecked()
      await linter.clearWords()
      await linter.importWords(all)
      words = all.join('\n')
    }
  },

  /** The issues in prose from `proseText`, which masks with `regexMask` */
  async lint(text: string, regexMask: string): Promise<HarperLint[]> {
    const { lints } = await check(text, regexMask)
    return lints.map(({ rule, lint }) => {
      const span = lint.span()
      return {
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
      }
    })
  },

  /**
   * Ignores the issue `rule` found at `start`–`end` in `text`, checked with
   * `regexMask`, in this and later checks. Returns every ignore, to store.
   */
  async ignore(
    text: string,
    regexMask: string,
    rule: string,
    start: number,
    end: number
  ): Promise<string> {
    const { lints } = await check(text, regexMask)
    const found = lints.find(lint => {
      const span = lint.lint.span()
      return lint.rule === rule && span.start === start && span.end === end
    })
    // Not there when the settings changed since that check, and then the
    // re-check that follows shows what's there now. Failing would restart
    // the worker (`linter.ts`)
    // By hash, since `ignoreLint` takes the lint, and `forgetChecked` would
    // then free it twice
    if (found) {
      await current().ignoreLintHash(
        await current().contextHash(text, found.lint)
      )
    }
    // The next check of the same text leaves it out
    forgetChecked()
    return current().exportIgnoredLints()
  },

  async clearIgnored(): Promise<void> {
    forgetChecked()
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
