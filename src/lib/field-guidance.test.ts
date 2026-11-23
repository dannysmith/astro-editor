import { describe, it, expect } from 'vitest'
import { fieldGuidance, isEmptyValue } from './field-guidance'
import { FieldType, type FieldConstraints, type SchemaField } from './schema'

const field = (
  type: FieldType,
  constraints?: FieldConstraints,
  rest: Partial<SchemaField> = {}
): SchemaField => ({
  name: 'test',
  label: 'Test',
  type,
  required: false,
  constraints,
  ...rest,
})

const text = (constraints?: FieldConstraints) =>
  field(FieldType.String, constraints)
const number = (constraints?: FieldConstraints) =>
  field(FieldType.Number, constraints)
const list = (constraints?: FieldConstraints) =>
  field(FieldType.Array, constraints)

describe('fieldGuidance', () => {
  it('says nothing about a field with no schema or no rules', () => {
    const nothing = { note: null, count: null, problem: null }
    expect(fieldGuidance(undefined, 'anything')).toEqual(nothing)
    expect(fieldGuidance(text(), 'anything')).toEqual(nothing)
  })

  describe('text length', () => {
    it('counts against the maximum and states the minimum', () => {
      expect(
        fieldGuidance(text({ minLength: 3, maxLength: 100 }), 'Hello')
      ).toEqual({
        note: 'Min 3',
        count: '5 / 100',
        problem: null,
      })
    })

    it('states an exact length', () => {
      const { note, count } = fieldGuidance(
        text({ minLength: 5, maxLength: 5 }),
        'abc'
      )
      expect(note).toBe('Exactly 5')
      expect(count).toBe('3 / 5')
    })

    it('spells out a minimum with no count beside it', () => {
      expect(fieldGuidance(text({ minLength: 1 }), 'a').note).toBe(
        'At least 1 character'
      )
      expect(fieldGuidance(list({ minItems: 2 }), ['a', 'b']).note).toBe(
        'At least 2 items'
      )
    })

    it('shows going over at once', () => {
      expect(fieldGuidance(text({ maxLength: 3 }), 'Hello').problem).toEqual({
        message: '2 over',
        whileTyping: true,
      })
    })

    it('waits until the writer leaves to say a value is too short', () => {
      expect(fieldGuidance(text({ minLength: 3 }), 'ab').problem).toEqual({
        message: '1 more needed',
        whileTyping: false,
      })
    })

    it("doesn't call an empty optional value too short", () => {
      expect(fieldGuidance(text({ minLength: 3 }), '').problem).toBeNull()
    })
  })

  describe('numbers', () => {
    it.each<[FieldConstraints, string]>([
      [{ min: 1, max: 10 }, '1–10'],
      [{ min: 0 }, 'At least 0'],
      [{ max: 99 }, 'At most 99'],
      [{ min: 0, minExclusive: true }, '> 0'],
      [
        { min: 0, max: 10, minExclusive: true, maxExclusive: true },
        '> 0 • < 10',
      ],
    ])('states %o as "%s"', (constraints, note) => {
      expect(fieldGuidance(number(constraints), 5).note).toBe(note)
    })

    it('flags a value out of range', () => {
      expect(fieldGuidance(number({ min: 1, max: 10 }), 14).problem).toEqual({
        message: 'Should be 1–10',
        whileTyping: true,
      })
      expect(fieldGuidance(number({ min: 5 }), 2).problem).toEqual({
        message: 'Should be at least 5',
        whileTyping: false,
      })
    })

    it('treats an exclusive bound as outside the range', () => {
      const positive = number({ min: 0, minExclusive: true })
      expect(fieldGuidance(positive, 0).problem?.message).toBe('Should be > 0')
      expect(fieldGuidance(positive, 0.5).problem).toBeNull()
    })

    it('states and checks whole numbers', () => {
      const whole = field(FieldType.Integer, { min: 1, max: 10 })
      expect(fieldGuidance(whole, 3).note).toBe('Whole number • 1–10')
      expect(fieldGuidance(whole, 2.5).problem?.message).toBe(
        'Should be a whole number'
      )
    })
  })

  describe('lists', () => {
    it('counts items and states the minimum', () => {
      expect(
        fieldGuidance(list({ minItems: 1, maxItems: 3 }), ['a', 'b'])
      ).toEqual({ note: 'Min 1', count: '2 / 3', problem: null })
    })

    it('flags too many and too few', () => {
      expect(
        fieldGuidance(list({ maxItems: 1 }), ['a', 'b']).problem?.message
      ).toBe('1 over')
      expect(fieldGuidance(list({ minItems: 3 }), ['a']).problem?.message).toBe(
        '2 more needed'
      )
    })
  })

  describe('formats and patterns', () => {
    it('states and checks a URL', () => {
      const url = field(FieldType.URL)
      expect(fieldGuidance(url, 'https://astro.build')).toEqual({
        note: 'URL',
        count: null,
        problem: null,
      })
      expect(fieldGuidance(url, 'astro build').problem).toEqual({
        message: "Doesn't look like a URL",
        whileTyping: false,
      })
    })

    it('states and checks an email', () => {
      const email = field(FieldType.Email)
      expect(fieldGuidance(email, 'a@example.com').note).toBe('Email')
      expect(fieldGuidance(email, 'a@example.com').problem).toBeNull()
      expect(fieldGuidance(email, 'not an email').problem?.message).toBe(
        "Doesn't look like an email"
      )
    })

    it('states and checks a pattern, however long', () => {
      const pattern = `^[A-Z]{3}$|^${'x'.repeat(40)}$`
      expect(fieldGuidance(text({ pattern }), 'ABC').note).toBe(
        `Format: ${pattern}`
      )
      expect(fieldGuidance(text({ pattern }), 'ABC').problem).toBeNull()
      expect(fieldGuidance(text({ pattern }), 'abc').problem?.message).toBe(
        "Doesn't match the format"
      )
    })

    it('leaves format checks until the writer stops typing', () => {
      const field = text({ pattern: '^[A-Z]+$' })
      expect(fieldGuidance(field, 'abc', { isTyping: true }).problem).toBeNull()
      expect(fieldGuidance(field, 'abc').problem?.message).toBe(
        "Doesn't match the format"
      )
    })

    it("doesn't flag a value against a pattern it can't read", () => {
      expect(
        fieldGuidance(text({ pattern: '(?<bad' }), 'anything').problem
      ).toBeNull()
    })
  })

  describe('controls that only offer valid values', () => {
    it('only speaks up about a dropdown value that is not an option', () => {
      const choice = field(FieldType.Enum, undefined, {
        enumValues: ['one', 'two'],
      })
      expect(fieldGuidance(choice, 'one')).toEqual({
        note: null,
        count: null,
        problem: null,
      })
      expect(fieldGuidance(choice, 'three').problem?.message).toBe(
        'Not one of the options'
      )
    })

    it('only speaks up about a date that is not a date', () => {
      const date = field(FieldType.Date, { format: 'date-time' })
      expect(fieldGuidance(date, '2024-01-15')).toEqual({
        note: null,
        count: null,
        problem: null,
      })
      expect(fieldGuidance(date, 'next tuesday').problem?.message).toBe(
        'Not a date: next tuesday'
      )
    })
  })

  describe('defaults', () => {
    const defaulted = field(FieldType.String, undefined, { default: 'guide' })

    it('shows the default only while the field is empty', () => {
      expect(fieldGuidance(defaulted, undefined).note).toBe('Default: guide')
      expect(fieldGuidance(defaulted, '').note).toBe('Default: guide')
      expect(fieldGuidance(defaulted, 'set').note).toBeNull()
    })

    it('can leave the default out', () => {
      expect(
        fieldGuidance(defaulted, undefined, { hideDefault: true }).note
      ).toBeNull()
    })

    it('writes other values as JSON and skips empty ones', () => {
      const of = (value: unknown) =>
        fieldGuidance(
          field(FieldType.String, undefined, { default: value }),
          undefined
        ).note
      expect(of(42)).toBe('Default: 42')
      expect(of({ key: 'value' })).toBe('Default: {"key":"value"}')
      expect(of('')).toBeNull()
      expect(of([])).toBeNull()
      expect(of({})).toBeNull()
    })
  })

  it('states several rules together', () => {
    const url = field(
      FieldType.URL,
      { maxLength: 40 },
      { default: 'https://a.b' }
    )
    expect(fieldGuidance(url, '')).toMatchObject({
      note: 'URL • Default: https://a.b',
      count: '0 / 40',
    })
  })
})

describe('isEmptyValue', () => {
  it('counts false and 0 as values', () => {
    expect(isEmptyValue(false)).toBe(false)
    expect(isEmptyValue(0)).toBe(false)
  })

  it.each([undefined, null, '', []])('counts %j as empty', value => {
    expect(isEmptyValue(value)).toBe(true)
  })
})
