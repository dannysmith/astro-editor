import { describe, it, expect } from 'vitest'
import {
  setNestedValue,
  getNestedValue,
  deleteNestedValue,
} from './object-utils'

describe('setNestedValue', () => {
  describe('simple keys', () => {
    it('should set a simple key', () => {
      const obj = { name: 'Alice' }
      const result = setNestedValue(obj, 'age', 30)
      expect(result).toEqual({ name: 'Alice', age: 30 })
    })

    it('should override existing simple key', () => {
      const obj = { name: 'Alice' }
      const result = setNestedValue(obj, 'name', 'Bob')
      expect(result).toEqual({ name: 'Bob' })
    })

    it('should not mutate original object', () => {
      const obj = { name: 'Alice' }
      const result = setNestedValue(obj, 'age', 30)
      expect(obj).toEqual({ name: 'Alice' })
      expect(result).not.toBe(obj)
    })
  })

  describe('nested keys', () => {
    it('should set nested value in existing object', () => {
      const obj = { author: { name: 'Alice' } }
      const result = setNestedValue(obj, 'author.email', 'alice@example.com')
      expect(result).toEqual({
        author: { name: 'Alice', email: 'alice@example.com' },
      })
    })

    it('should create nested structure if path does not exist', () => {
      const obj = {}
      const result = setNestedValue(obj, 'author.name', 'Bob')
      expect(result).toEqual({ author: { name: 'Bob' } })
    })

    it('should handle deeply nested paths', () => {
      const obj = {}
      const result = setNestedValue(obj, 'a.b.c.d', 'deep')
      expect(result).toEqual({ a: { b: { c: { d: 'deep' } } } })
    })

    it('should replace non-object values in path', () => {
      const obj = { author: 'Alice' }
      const result = setNestedValue(obj, 'author.name', 'Bob')
      expect(result).toEqual({ author: { name: 'Bob' } })
    })

    it('should not mutate nested objects', () => {
      const nested = { name: 'Alice' }
      const obj = { author: nested }
      const result = setNestedValue(obj, 'author.email', 'alice@example.com')
      expect(nested).toEqual({ name: 'Alice' })
      expect(obj.author).toBe(nested)
      expect(result.author).not.toBe(nested)
    })
  })

  describe('prototype pollution protection', () => {
    it('should prevent __proto__ as simple key', () => {
      const obj = {}
      expect(() => setNestedValue(obj, '__proto__', 'evil')).toThrow(
        /prototype pollution prevented/
      )
    })

    it('should prevent constructor as simple key', () => {
      const obj = {}
      expect(() => setNestedValue(obj, 'constructor', 'evil')).toThrow(
        /prototype pollution prevented/
      )
    })

    it('should prevent prototype as simple key', () => {
      const obj = {}
      expect(() => setNestedValue(obj, 'prototype', 'evil')).toThrow(
        /prototype pollution prevented/
      )
    })

    it('should prevent __proto__ in nested path', () => {
      const obj = {}
      expect(() => setNestedValue(obj, 'user.__proto__.admin', true)).toThrow(
        /prototype pollution prevented/
      )
    })

    it('should prevent constructor in nested path', () => {
      const obj = {}
      expect(() => setNestedValue(obj, 'user.constructor.admin', true)).toThrow(
        /prototype pollution prevented/
      )
    })

    it('should prevent __proto__ as final key', () => {
      const obj = { user: {} }
      expect(() => setNestedValue(obj, 'user.__proto__', 'evil')).toThrow(
        /prototype pollution prevented/
      )
    })
  })
})

describe('getNestedValue', () => {
  describe('simple keys', () => {
    it('should get simple key value', () => {
      const obj = { name: 'Alice', age: 30 }
      expect(getNestedValue(obj, 'name')).toBe('Alice')
      expect(getNestedValue(obj, 'age')).toBe(30)
    })

    it('should return undefined for missing simple key', () => {
      const obj = { name: 'Alice' }
      expect(getNestedValue(obj, 'age')).toBeUndefined()
    })
  })

  describe('nested keys', () => {
    it('should get nested value', () => {
      const obj = { author: { name: 'Alice', email: 'alice@example.com' } }
      expect(getNestedValue(obj, 'author.name')).toBe('Alice')
      expect(getNestedValue(obj, 'author.email')).toBe('alice@example.com')
    })

    it('should handle deeply nested paths', () => {
      const obj = { a: { b: { c: { d: 'deep' } } } }
      expect(getNestedValue(obj, 'a.b.c.d')).toBe('deep')
    })

    it('should return undefined for missing nested key', () => {
      const obj = { author: { name: 'Alice' } }
      expect(getNestedValue(obj, 'author.age')).toBeUndefined()
    })

    it('should return undefined if intermediate path is null', () => {
      const obj = { author: null }
      expect(getNestedValue(obj, 'author.name')).toBeUndefined()
    })

    it('should return undefined if intermediate path is undefined', () => {
      const obj = {}
      expect(getNestedValue(obj, 'author.name')).toBeUndefined()
    })

    it('should return undefined if intermediate path is not an object', () => {
      const obj = { author: 'Alice' }
      expect(getNestedValue(obj, 'author.name')).toBeUndefined()
    })
  })

  describe('complex values', () => {
    it('should get array values', () => {
      const obj = { tags: ['react', 'typescript'] }
      expect(getNestedValue(obj, 'tags')).toEqual(['react', 'typescript'])
    })

    it('should get boolean values', () => {
      const obj = { draft: true }
      expect(getNestedValue(obj, 'draft')).toBe(true)
    })

    it('should get null values', () => {
      const obj = { data: null }
      expect(getNestedValue(obj, 'data')).toBeNull()
    })
  })
})

describe('deleteNestedValue', () => {
  describe('simple keys', () => {
    it('should delete simple key', () => {
      const obj = { name: 'Alice', age: 30 }
      const result = deleteNestedValue(obj, 'age')
      expect(result).toEqual({ name: 'Alice' })
    })

    it('should not mutate original object', () => {
      const obj = { name: 'Alice', age: 30 }
      const result = deleteNestedValue(obj, 'age')
      expect(obj).toEqual({ name: 'Alice', age: 30 })
      expect(result).not.toBe(obj)
    })

    it('should handle deleting missing key', () => {
      const obj = { name: 'Alice' }
      const result = deleteNestedValue(obj, 'age')
      expect(result).toEqual({ name: 'Alice' })
    })
  })

  describe('nested keys', () => {
    it('should delete nested value', () => {
      const obj = { author: { name: 'Alice', email: 'alice@example.com' } }
      const result = deleteNestedValue(obj, 'author.email')
      expect(result).toEqual({ author: { name: 'Alice' } })
    })

    it('should handle deeply nested deletion', () => {
      const obj = { a: { b: { c: { d: 'deep', e: 'keep' } } } }
      const result = deleteNestedValue(obj, 'a.b.c.d')
      expect(result).toEqual({ a: { b: { c: { e: 'keep' } } } })
    })

    it('should clean up empty parent objects', () => {
      const obj = { author: { email: 'alice@example.com' } }
      const result = deleteNestedValue(obj, 'author.email')
      expect(result).toEqual({})
    })

    it('should clean up deeply nested empty parents', () => {
      const obj = { a: { b: { c: { d: 'deep' } } } }
      const result = deleteNestedValue(obj, 'a.b.c.d')
      expect(result).toEqual({})
    })

    it('should stop cleaning when parent has other keys', () => {
      const obj = { a: { b: { c: { d: 'delete' } }, keep: 'me' } }
      const result = deleteNestedValue(obj, 'a.b.c.d')
      expect(result).toEqual({ a: { keep: 'me' } })
    })

    it('should handle deletion of missing nested key', () => {
      const obj = { author: { name: 'Alice' } }
      const result = deleteNestedValue(obj, 'author.age')
      expect(result).toEqual({ author: { name: 'Alice' } })
    })

    it('should handle deletion when intermediate path does not exist', () => {
      const obj = { author: { name: 'Alice' } }
      const result = deleteNestedValue(obj, 'user.email')
      expect(result).toEqual({ author: { name: 'Alice' } })
    })

    it('should handle deletion when intermediate path is not an object', () => {
      const obj = { author: 'Alice' }
      const result = deleteNestedValue(obj, 'author.email')
      expect(result).toEqual({ author: 'Alice' })
    })

    it('should not mutate nested objects', () => {
      const nested = { name: 'Alice', email: 'alice@example.com' }
      const obj = { author: nested }
      const result = deleteNestedValue(obj, 'author.email')
      expect(nested).toEqual({ name: 'Alice', email: 'alice@example.com' })
      expect(obj.author).toBe(nested)
      expect(result.author).not.toBe(nested)
    })
  })

  describe('prototype pollution protection', () => {
    it('should prevent __proto__ as simple key', () => {
      const obj = { __proto__: 'test' }
      expect(() => deleteNestedValue(obj, '__proto__')).toThrow(
        /prototype pollution prevented/
      )
    })

    it('should prevent constructor as simple key', () => {
      const obj = {}
      expect(() => deleteNestedValue(obj, 'constructor')).toThrow(
        /prototype pollution prevented/
      )
    })

    it('should prevent prototype as simple key', () => {
      const obj = {}
      expect(() => deleteNestedValue(obj, 'prototype')).toThrow(
        /prototype pollution prevented/
      )
    })

    it('should prevent __proto__ in nested path', () => {
      const obj = { user: { __proto__: 'test' } }
      expect(() => deleteNestedValue(obj, 'user.__proto__.admin')).toThrow(
        /prototype pollution prevented/
      )
    })

    it('should prevent __proto__ as final key', () => {
      const obj = { user: { __proto__: 'test' } }
      expect(() => deleteNestedValue(obj, 'user.__proto__')).toThrow(
        /prototype pollution prevented/
      )
    })
  })
})
