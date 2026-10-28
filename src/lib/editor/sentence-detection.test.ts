import { describe, test, expect } from 'vitest'
import { EditorState } from '@codemirror/state'
import {
  detectSentencesInLine,
  findCurrentSentence,
} from './sentence-detection'

describe('Sentence Detection', () => {
  describe('detectSentencesInLine', () => {
    test('detects simple sentences', () => {
      const text = 'First sentence. Second sentence!'
      const sentences = detectSentencesInLine(text)

      expect(sentences).toEqual([
        { from: 0, to: 16 }, // "First sentence. "
        { from: 16, to: 32 }, // "Second sentence!"
      ])
    })

    test('handles single sentence', () => {
      const text = 'This is a single sentence.'
      const sentences = detectSentencesInLine(text)

      expect(sentences).toEqual([{ from: 0, to: 26 }])
    })

    test('handles text without ending punctuation', () => {
      const text = 'This has no ending punctuation'
      const sentences = detectSentencesInLine(text)

      expect(sentences).toEqual([{ from: 0, to: 30 }])
    })

    test('handles multiple question marks', () => {
      const text = 'What is this??? And this!'
      const sentences = detectSentencesInLine(text)

      expect(sentences).toEqual([
        { from: 0, to: 16 }, // "What is this??? "
        { from: 16, to: 25 }, // "And this!"
      ])
    })

    test('handles empty string', () => {
      const text = ''
      const sentences = detectSentencesInLine(text)

      expect(sentences).toEqual([])
    })

    test('handles text with only punctuation', () => {
      const text = '...'
      const sentences = detectSentencesInLine(text)

      expect(sentences).toEqual([{ from: 0, to: 3 }])
    })
  })

  describe('findCurrentSentence', () => {
    test('finds sentence containing cursor position', () => {
      const doc = 'First sentence. Second sentence! Third sentence.'
      const state = EditorState.create({ doc })

      // Cursor in first sentence
      const sentence1 = findCurrentSentence(state, 5)
      expect(sentence1).toEqual({ from: 0, to: 16 })

      // Cursor in second sentence
      const sentence2 = findCurrentSentence(state, 20)
      expect(sentence2).toEqual({ from: 16, to: 33 })

      // Cursor in third sentence
      const sentence3 = findCurrentSentence(state, 40)
      expect(sentence3).toEqual({ from: 33, to: 48 })
    })

    test('handles cursor at sentence boundaries', () => {
      const doc = 'First sentence. Second sentence!'
      const state = EditorState.create({ doc })

      // Cursor at end of first sentence
      const sentenceAtEnd = findCurrentSentence(state, 15)
      expect(sentenceAtEnd).toEqual({ from: 0, to: 16 })

      // Cursor at start of second sentence (boundary selects previous)
      const sentenceAtStart = findCurrentSentence(state, 16)
      expect(sentenceAtStart).toEqual({ from: 0, to: 16 })
    })

    test('returns range for empty document', () => {
      const state = EditorState.create({ doc: '' })
      const sentence = findCurrentSentence(state, 0)
      expect(sentence).toEqual({ from: 0, to: 0 })
    })

    test('handles multiline documents', () => {
      const doc = 'First line sentence.\nSecond line sentence.'
      const state = EditorState.create({ doc })

      // Cursor in first line
      const sentence1 = findCurrentSentence(state, 10)
      expect(sentence1).toEqual({ from: 0, to: 20 })

      // Cursor in second line
      const sentence2 = findCurrentSentence(state, 30)
      expect(sentence2).toEqual({ from: 21, to: 42 })
    })
  })
})
