import { describe, it, expect } from 'vitest'
import { tagsToStringArray, valueToString } from '../utils'
import type { Tag } from '../../ui/tag-input'

describe('Frontmatter Field Utilities', () => {
  describe('tagsToStringArray', () => {
    it('should convert array of tags to string array', () => {
      const tags: Tag[] = [
        { id: 'tag-1', text: 'react' },
        { id: 'tag-2', text: 'typescript' },
        { id: 'tag-3', text: 'vite' },
      ]

      const result = tagsToStringArray(tags)

      expect(result).toEqual(['react', 'typescript', 'vite'])
    })

    it('should handle empty tag array', () => {
      const tags: Tag[] = []

      const result = tagsToStringArray(tags)

      expect(result).toEqual([])
    })

    it('should handle tags with special characters', () => {
      const tags: Tag[] = [
        { id: 'tag-1', text: 'React.js' },
        { id: 'tag-2', text: 'Node.js' },
        { id: 'tag-3', text: 'C++' },
        { id: 'tag-4', text: 'C#' },
      ]

      const result = tagsToStringArray(tags)

      expect(result).toEqual(['React.js', 'Node.js', 'C++', 'C#'])
    })

    it('should handle tags with unicode characters', () => {
      const tags: Tag[] = [
        { id: 'tag-1', text: '🚀' },
        { id: 'tag-2', text: '测试' },
        { id: 'tag-3', text: 'Ñiño' },
      ]

      const result = tagsToStringArray(tags)

      expect(result).toEqual(['🚀', '测试', 'Ñiño'])
    })

    it('should handle tags with empty strings', () => {
      const tags: Tag[] = [
        { id: 'tag-1', text: 'react' },
        { id: 'tag-2', text: '' },
        { id: 'tag-3', text: 'vite' },
      ]

      const result = tagsToStringArray(tags)

      expect(result).toEqual(['react', '', 'vite'])
    })

    it('should handle tags with whitespace', () => {
      const tags: Tag[] = [
        { id: 'tag-1', text: '  react  ' },
        { id: 'tag-2', text: '\ttypescript\n' },
        { id: 'tag-3', text: ' vite ' },
      ]

      const result = tagsToStringArray(tags)

      expect(result).toEqual(['  react  ', '\ttypescript\n', ' vite '])
    })
  })

  describe('valueToString', () => {
    describe('null and undefined handling', () => {
      it('should convert null to empty string', () => {
        expect(valueToString(null)).toBe('')
      })

      it('should convert undefined to empty string', () => {
        expect(valueToString(undefined)).toBe('')
      })
    })

    describe('string handling', () => {
      it('should return strings as-is', () => {
        expect(valueToString('hello world')).toBe('hello world')
      })

      it('should handle empty strings', () => {
        expect(valueToString('')).toBe('')
      })

      it('should handle strings with special characters', () => {
        expect(valueToString('Hello, 世界! 🌍')).toBe('Hello, 世界! 🌍')
      })

      it('should handle multiline strings', () => {
        const multiline = 'Line 1\nLine 2\rLine 3\r\nLine 4'
        expect(valueToString(multiline)).toBe(multiline)
      })
    })

    describe('number handling', () => {
      it('should convert positive integers', () => {
        expect(valueToString(42)).toBe('42')
      })

      it('should convert negative integers', () => {
        expect(valueToString(-17)).toBe('-17')
      })

      it('should convert zero', () => {
        expect(valueToString(0)).toBe('0')
      })

      it('should convert floating point numbers', () => {
        expect(valueToString(3.14159)).toBe('3.14159')
      })

      it('should convert negative floating point numbers', () => {
        expect(valueToString(-2.718)).toBe('-2.718')
      })

      it('should handle very large numbers', () => {
        expect(valueToString(Number.MAX_SAFE_INTEGER)).toBe('9007199254740991')
      })

      it('should handle very small numbers', () => {
        expect(valueToString(Number.MIN_SAFE_INTEGER)).toBe('-9007199254740991')
      })

      it('should handle scientific notation', () => {
        expect(valueToString(1.23e10)).toBe('12300000000')
        expect(valueToString(1.23e-5)).toBe('0.0000123')
      })

      it('should handle special number values', () => {
        expect(valueToString(NaN)).toBe('NaN')
        expect(valueToString(Infinity)).toBe('Infinity')
        expect(valueToString(-Infinity)).toBe('-Infinity')
      })
    })

    describe('boolean handling', () => {
      it('should convert true to string', () => {
        expect(valueToString(true)).toBe('true')
      })

      it('should convert false to string', () => {
        expect(valueToString(false)).toBe('false')
      })
    })

    describe('array handling', () => {
      it('should join string arrays with commas', () => {
        expect(valueToString(['react', 'typescript', 'vite'])).toBe(
          'react,typescript,vite'
        )
      })

      it('should handle empty arrays', () => {
        expect(valueToString([])).toBe('')
      })

      it('should handle single-item arrays', () => {
        expect(valueToString(['react'])).toBe('react')
      })

      it('should handle mixed type arrays', () => {
        expect(valueToString(['string', 42, true, null])).toBe(
          'string,42,true,'
        )
      })

      it('should handle arrays with special characters', () => {
        expect(valueToString(['hello,world', 'foo;bar', 'baz|qux'])).toBe(
          'hello,world,foo;bar,baz|qux'
        )
      })

      it('should handle nested arrays', () => {
        expect(
          valueToString([
            ['a', 'b'],
            ['c', 'd'],
          ])
        ).toBe('a,b,c,d')
      })

      it('should handle arrays with undefined/null values', () => {
        expect(valueToString(['a', undefined, 'b', null, 'c'])).toBe('a,,b,,c')
      })
    })

    describe('object and other type handling', () => {
      it('should return empty string for plain objects', () => {
        expect(valueToString({ foo: 'bar' })).toBe('')
      })

      it('should return empty string for complex objects', () => {
        expect(
          valueToString({
            nested: { object: { with: ['arrays', 42] } },
            func: () => 'test',
            date: new Date(),
          })
        ).toBe('')
      })

      it('should return empty string for functions', () => {
        expect(valueToString(() => 'hello')).toBe('')
      })

      it('should return empty string for Date objects', () => {
        expect(valueToString(new Date('2023-12-01'))).toBe('')
      })

      it('should return empty string for RegExp objects', () => {
        expect(valueToString(/test/g)).toBe('')
      })

      it('should return empty string for symbols', () => {
        expect(valueToString(Symbol('test'))).toBe('')
      })

      it('should return empty string for BigInt values', () => {
        expect(valueToString(BigInt(123))).toBe('')
      })

      it('should return empty string for Map objects', () => {
        const map = new Map([['key', 'value']])
        expect(valueToString(map)).toBe('')
      })

      it('should return empty string for Set objects', () => {
        const set = new Set(['a', 'b', 'c'])
        expect(valueToString(set)).toBe('')
      })

      it('should return empty string for class instances', () => {
        class TestClass {
          value = 'test'
        }
        expect(valueToString(new TestClass())).toBe('')
      })
    })

    describe('edge cases', () => {
      it('should handle objects with toString methods', () => {
        const objectWithToString = {
          toString: () => 'custom toString',
        }
        expect(valueToString(objectWithToString)).toBe('')
      })

      it('should handle objects with valueOf methods', () => {
        const objectWithValueOf = {
          valueOf: () => 42,
        }
        expect(valueToString(objectWithValueOf)).toBe('')
      })

      it('should handle array-like objects', () => {
        const arrayLike = { 0: 'a', 1: 'b', length: 2 }
        expect(valueToString(arrayLike)).toBe('')
      })

      it('should handle sparse arrays', () => {
        const sparse = ['a', , , 'b'] // oxlint-disable-line no-sparse-arrays
        expect(valueToString(sparse)).toBe('a,,,b')
      })

      it('should handle arrays with object elements', () => {
        expect(valueToString(['string', { obj: 'value' }, 'string2'])).toBe(
          'string,[object Object],string2'
        )
      })
    })
  })
})
