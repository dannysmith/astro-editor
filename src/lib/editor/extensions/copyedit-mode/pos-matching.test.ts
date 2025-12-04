import { describe, test, expect } from 'vitest'
import {
  isExcludedContent,
  isRangeBeingEdited,
  buildExclusionSet,
  getMatchRanges,
  isValidRange,
  processPosType,
} from './pos-matching'
import type {
  CompromiseDocument,
  CompromiseMatch,
  CompromiseMatches,
  PosConfig,
} from './types'

/**
 * Helper to create mock Compromise matches
 */
function createMockMatches(
  items: Array<{ text: string; offset?: { start: number; length: number } }>
): CompromiseMatches {
  return {
    length: items.length,
    forEach: (callback: (match: CompromiseMatch) => void) => {
      for (const item of items) {
        callback({
          text: () => item.text,
          offset: item.offset,
        })
      }
    },
  }
}

/**
 * Helper to create mock Compromise document
 */
function createMockDoc(
  matchesByTag: Record<string, CompromiseMatches>
): CompromiseDocument {
  return {
    match: (pattern: string) => matchesByTag[pattern] || createMockMatches([]),
  }
}

describe('isExcludedContent', () => {
  describe('fenced code blocks', () => {
    test('excludes content inside fenced code block', () => {
      const text = 'Hello\n```\ncode here\n```\nWorld'
      // "code here" starts at position 10
      expect(isExcludedContent(text, 10, 19)).toBe(true)
    })

    test('excludes code block delimiters', () => {
      const text = '```\ncode\n```'
      expect(isExcludedContent(text, 0, 3)).toBe(true)
    })

    test('does not exclude content outside code block', () => {
      const text = 'Hello\n```\ncode\n```\nWorld'
      // "World" starts at position 19
      expect(isExcludedContent(text, 19, 24)).toBe(false)
    })
  })

  describe('inline code', () => {
    test('excludes content inside inline code', () => {
      const text = 'Hello `code` World'
      // "code" is at positions 7-11
      expect(isExcludedContent(text, 7, 11)).toBe(true)
    })

    test('excludes backticks of inline code', () => {
      const text = 'Hello `code` World'
      // backtick at position 6
      expect(isExcludedContent(text, 6, 7)).toBe(true)
    })

    test('does not exclude content outside inline code', () => {
      const text = 'Hello `code` World'
      // "Hello" is at 0-5
      expect(isExcludedContent(text, 0, 5)).toBe(false)
    })
  })

  describe('frontmatter', () => {
    test('excludes content inside frontmatter', () => {
      const text = '---\ntitle: Test\n---\nContent here'
      // "title" is within frontmatter
      expect(isExcludedContent(text, 4, 9)).toBe(true)
    })

    test('does not exclude content after frontmatter', () => {
      const text = '---\ntitle: Test\n---\nContent here'
      // "Content" starts at position 20
      expect(isExcludedContent(text, 20, 27)).toBe(false)
    })

    test('frontmatter must start at beginning', () => {
      const text = 'Hello\n---\ntitle: Test\n---'
      // This is not frontmatter since it doesn't start at the beginning
      expect(isExcludedContent(text, 10, 15)).toBe(false)
    })
  })

  describe('link syntax', () => {
    test('excludes content inside markdown links', () => {
      const text = 'Click [here](https://example.com) to continue'
      // "here" is at 7-11, inside the link
      expect(isExcludedContent(text, 7, 11)).toBe(true)
    })

    test('excludes URL portion of links', () => {
      const text = 'Click [here](https://example.com) to continue'
      // URL starts at 13
      expect(isExcludedContent(text, 13, 32)).toBe(true)
    })

    test('does not exclude content outside links', () => {
      const text = 'Click [here](https://example.com) to continue'
      // "Click" is at 0-5
      expect(isExcludedContent(text, 0, 5)).toBe(false)
    })
  })

  describe('edge cases', () => {
    test('handles empty text', () => {
      expect(isExcludedContent('', 0, 0)).toBe(false)
    })

    test('handles text with no special content', () => {
      const text = 'Just a plain sentence here.'
      expect(isExcludedContent(text, 5, 6)).toBe(false)
    })
  })
})

describe('isRangeBeingEdited', () => {
  test('returns false when cursor position is -1', () => {
    expect(isRangeBeingEdited(0, 5, -1)).toBe(false)
  })

  test('returns true when cursor is inside range', () => {
    expect(isRangeBeingEdited(0, 10, 5)).toBe(true)
  })

  test('returns true when cursor is at range start', () => {
    expect(isRangeBeingEdited(5, 10, 5)).toBe(true)
  })

  test('returns true when cursor is at range end', () => {
    expect(isRangeBeingEdited(5, 10, 10)).toBe(true)
  })

  test('returns true when cursor is within buffer of range start', () => {
    // Buffer is 2, so cursor at 3 should exclude range starting at 5
    expect(isRangeBeingEdited(5, 10, 3)).toBe(true)
  })

  test('returns true when cursor is within buffer of range end', () => {
    // Buffer is 2, so cursor at 12 should exclude range ending at 10
    expect(isRangeBeingEdited(5, 10, 12)).toBe(true)
  })

  test('returns false when cursor is outside buffer', () => {
    expect(isRangeBeingEdited(5, 10, 0)).toBe(false)
    expect(isRangeBeingEdited(5, 10, 15)).toBe(false)
  })
})

describe('buildExclusionSet', () => {
  test('builds exclusion set from single tag', () => {
    const doc = createMockDoc({
      '#Pronoun': createMockMatches([
        { text: 'he' },
        { text: 'she' },
        { text: 'They' },
      ]),
    })

    const exclusions = buildExclusionSet(doc, ['#Pronoun'])

    expect(exclusions.has('he')).toBe(true)
    expect(exclusions.has('she')).toBe(true)
    expect(exclusions.has('they')).toBe(true) // lowercase
    expect(exclusions.size).toBe(3)
  })

  test('builds exclusion set from multiple tags', () => {
    const doc = createMockDoc({
      '#Auxiliary': createMockMatches([{ text: 'is' }, { text: 'are' }]),
      '#Modal': createMockMatches([{ text: 'can' }, { text: 'will' }]),
    })

    const exclusions = buildExclusionSet(doc, ['#Auxiliary', '#Modal'])

    expect(exclusions.has('is')).toBe(true)
    expect(exclusions.has('are')).toBe(true)
    expect(exclusions.has('can')).toBe(true)
    expect(exclusions.has('will')).toBe(true)
    expect(exclusions.size).toBe(4)
  })

  test('handles empty exclusion tags', () => {
    const doc = createMockDoc({})
    const exclusions = buildExclusionSet(doc, [])
    expect(exclusions.size).toBe(0)
  })

  test('handles matches with empty text', () => {
    const doc = createMockDoc({
      '#Pronoun': createMockMatches([{ text: '' }, { text: 'he' }]),
    })

    const exclusions = buildExclusionSet(doc, ['#Pronoun'])
    expect(exclusions.has('he')).toBe(true)
    // Empty string should not be added
    expect(exclusions.has('')).toBe(false)
  })
})

describe('getMatchRanges', () => {
  test('uses offset when available', () => {
    const doc = createMockDoc({
      '#Noun': createMockMatches([
        { text: 'cat', offset: { start: 4, length: 3 } },
        { text: 'dog', offset: { start: 12, length: 3 } },
      ]),
    })

    const ranges = getMatchRanges(
      doc,
      '#Noun',
      'The cat and dog ran.',
      new Set()
    )

    expect(ranges).toEqual([
      { from: 4, to: 7, text: 'cat' },
      { from: 12, to: 15, text: 'dog' },
    ])
  })

  test('falls back to regex when offset not available', () => {
    const doc = createMockDoc({
      '#Noun': createMockMatches([{ text: 'cat' }, { text: 'dog' }]),
    })

    const ranges = getMatchRanges(
      doc,
      '#Noun',
      'The cat and dog ran.',
      new Set()
    )

    expect(ranges).toContainEqual({ from: 4, to: 7, text: 'cat' })
    expect(ranges).toContainEqual({ from: 12, to: 15, text: 'dog' })
  })

  test('finds multiple occurrences with regex fallback', () => {
    const doc = createMockDoc({
      '#Noun': createMockMatches([{ text: 'cat' }]),
    })

    const ranges = getMatchRanges(
      doc,
      '#Noun',
      'The cat saw another cat.',
      new Set()
    )

    expect(ranges).toContainEqual({ from: 4, to: 7, text: 'cat' })
    expect(ranges).toContainEqual({ from: 20, to: 23, text: 'cat' })
  })

  test('excludes words in exclusion set', () => {
    const doc = createMockDoc({
      '#Noun': createMockMatches([
        { text: 'cat', offset: { start: 4, length: 3 } },
        { text: 'he', offset: { start: 0, length: 2 } },
      ]),
    })

    const exclusions = new Set(['he'])
    const ranges = getMatchRanges(doc, '#Noun', 'He has a cat.', exclusions)

    expect(ranges).toEqual([{ from: 4, to: 7, text: 'cat' }])
  })

  test('skips empty or whitespace-only matches', () => {
    const doc = createMockDoc({
      '#Noun': createMockMatches([
        { text: '', offset: { start: 0, length: 0 } },
        { text: '   ', offset: { start: 0, length: 3 } },
        { text: 'cat', offset: { start: 4, length: 3 } },
      ]),
    })

    const ranges = getMatchRanges(doc, '#Noun', 'The cat.', new Set())

    expect(ranges).toEqual([{ from: 4, to: 7, text: 'cat' }])
  })

  test('handles special regex characters in match text', () => {
    const doc = createMockDoc({
      '#Noun': createMockMatches([{ text: 'test+case' }]),
    })

    const ranges = getMatchRanges(
      doc,
      '#Noun',
      'A test+case example.',
      new Set()
    )

    expect(ranges).toContainEqual({ from: 2, to: 11, text: 'test+case' })
  })
})

describe('isValidRange', () => {
  test('returns true for valid range', () => {
    const range = { from: 0, to: 5, text: 'Hello' }
    const processedRanges = new Set<string>()

    expect(isValidRange(range, 'Hello World', -1, processedRanges)).toBe(true)
  })

  test('returns false for negative from', () => {
    const range = { from: -1, to: 5, text: 'Hello' }
    expect(isValidRange(range, 'Hello World', -1, new Set())).toBe(false)
  })

  test('returns false when to exceeds text length', () => {
    const range = { from: 0, to: 20, text: 'Hello' }
    expect(isValidRange(range, 'Hello', -1, new Set())).toBe(false)
  })

  test('returns false when from >= to', () => {
    const range = { from: 5, to: 5, text: 'Hello' }
    expect(isValidRange(range, 'Hello World', -1, new Set())).toBe(false)
  })

  test('returns false for already processed range', () => {
    const range = { from: 0, to: 5, text: 'Hello' }
    const processedRanges = new Set(['0-5'])

    expect(isValidRange(range, 'Hello World', -1, processedRanges)).toBe(false)
  })

  test('returns false for excluded content', () => {
    const range = { from: 7, to: 11, text: 'code' }
    const text = 'Hello `code` World'

    expect(isValidRange(range, text, -1, new Set())).toBe(false)
  })

  test('returns false when cursor is near range', () => {
    const range = { from: 0, to: 5, text: 'Hello' }
    // Cursor at position 3 (inside the range)
    expect(isValidRange(range, 'Hello World', 3, new Set())).toBe(false)
  })
})

describe('processPosType', () => {
  const nounConfig: PosConfig = {
    tag: '#Noun',
    className: 'cm-pos-noun',
    settingKey: 'nouns',
    exclusionTags: ['#Pronoun'],
  }

  const adjectiveConfig: PosConfig = {
    tag: '#Adjective',
    className: 'cm-pos-adjective',
    settingKey: 'adjectives',
  }

  test('processes POS type with exclusions', () => {
    const doc = createMockDoc({
      '#Noun': createMockMatches([
        { text: 'cat', offset: { start: 4, length: 3 } },
        { text: 'he', offset: { start: 0, length: 2 } },
      ]),
      '#Pronoun': createMockMatches([{ text: 'he' }]),
    })

    const processedRanges = new Set<string>()
    const ranges = processPosType(
      doc,
      'He saw a cat.',
      nounConfig,
      -1,
      processedRanges
    )

    // "he" should be excluded as a pronoun
    expect(ranges).toEqual([{ from: 4, to: 7, text: 'cat' }])
    expect(processedRanges.has('4-7')).toBe(true)
  })

  test('processes POS type without exclusions', () => {
    const doc = createMockDoc({
      '#Adjective': createMockMatches([
        { text: 'big', offset: { start: 4, length: 3 } },
        { text: 'red', offset: { start: 8, length: 3 } },
      ]),
    })

    const processedRanges = new Set<string>()
    const ranges = processPosType(
      doc,
      'The big red car.',
      adjectiveConfig,
      -1,
      processedRanges
    )

    expect(ranges).toHaveLength(2)
    expect(ranges).toContainEqual({ from: 4, to: 7, text: 'big' })
    expect(ranges).toContainEqual({ from: 8, to: 11, text: 'red' })
  })

  test('skips ranges near cursor', () => {
    const doc = createMockDoc({
      '#Noun': createMockMatches([
        { text: 'cat', offset: { start: 4, length: 3 } },
        { text: 'dog', offset: { start: 12, length: 3 } },
      ]),
      '#Pronoun': createMockMatches([]),
    })

    const processedRanges = new Set<string>()
    // Cursor at position 5 (inside "cat")
    const ranges = processPosType(
      doc,
      'The cat and dog ran.',
      nounConfig,
      5,
      processedRanges
    )

    // "cat" should be excluded due to cursor proximity
    expect(ranges).toEqual([{ from: 12, to: 15, text: 'dog' }])
  })

  test('avoids duplicate ranges across calls', () => {
    const doc = createMockDoc({
      '#Noun': createMockMatches([
        { text: 'cat', offset: { start: 4, length: 3 } },
      ]),
      '#Pronoun': createMockMatches([]),
    })

    const processedRanges = new Set<string>()

    // First call
    const ranges1 = processPosType(
      doc,
      'The cat ran.',
      nounConfig,
      -1,
      processedRanges
    )
    expect(ranges1).toHaveLength(1)

    // Second call with same processedRanges
    const ranges2 = processPosType(
      doc,
      'The cat ran.',
      nounConfig,
      -1,
      processedRanges
    )
    expect(ranges2).toHaveLength(0) // Already processed
  })

  test('handles code blocks correctly', () => {
    const doc = createMockDoc({
      '#Noun': createMockMatches([
        { text: 'variable', offset: { start: 12, length: 8 } }, // inside code
        { text: 'text', offset: { start: 27, length: 4 } }, // outside code
      ]),
      '#Pronoun': createMockMatches([]),
    })

    const text = 'Some text `variable` and more text.'
    const processedRanges = new Set<string>()
    const ranges = processPosType(doc, text, nounConfig, -1, processedRanges)

    // "variable" inside inline code should be excluded
    expect(ranges).toEqual([{ from: 27, to: 31, text: 'text' }])
  })
})
