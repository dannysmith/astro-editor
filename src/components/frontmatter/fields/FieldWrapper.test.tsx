import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FieldWrapper } from './FieldWrapper'
import type { FieldConstraints } from '../../../lib/schema'

describe('FieldWrapper', () => {
  describe('vertical layout', () => {
    it('renders label and children', () => {
      render(
        <FieldWrapper label="Test Field">
          <input data-testid="test-input" />
        </FieldWrapper>
      )

      expect(screen.getByText('Test Field')).toBeInTheDocument()
      expect(screen.getByTestId('test-input')).toBeInTheDocument()
    })

    it('shows required asterisk when required', () => {
      render(
        <FieldWrapper label="Test Field" required>
          <input />
        </FieldWrapper>
      )

      expect(screen.getByText('*')).toBeInTheDocument()
    })

    it('displays description when provided', () => {
      render(
        <FieldWrapper
          label="Test Field"
          description="This is a helpful description"
        >
          <input />
        </FieldWrapper>
      )

      expect(
        screen.getByText('This is a helpful description')
      ).toBeInTheDocument()
    })
  })

  describe('horizontal layout', () => {
    it('renders with horizontal layout for toggles', () => {
      const { container } = render(
        <FieldWrapper label="Test Field" layout="horizontal">
          <div data-testid="toggle">Toggle</div>
        </FieldWrapper>
      )

      // Check that the Field has horizontal orientation
      const field = container.querySelector('[data-orientation="horizontal"]')
      expect(field).toBeInTheDocument()
      expect(screen.getByTestId('toggle')).toBeInTheDocument()
    })
  })

  describe('constraint formatting', () => {
    it('formats numeric min-max range', () => {
      const constraints: FieldConstraints = { min: 1, max: 100 }

      render(
        <FieldWrapper label="Test" constraints={constraints} currentValue={50}>
          <input />
        </FieldWrapper>
      )

      expect(screen.getByText('1–100')).toBeInTheDocument()
    })

    it('formats min only', () => {
      const constraints: FieldConstraints = { min: 10 }

      render(
        <FieldWrapper label="Test" constraints={constraints} currentValue={15}>
          <input />
        </FieldWrapper>
      )

      expect(screen.getByText('Min: 10')).toBeInTheDocument()
    })

    it('formats max only', () => {
      const constraints: FieldConstraints = { max: 999 }

      render(
        <FieldWrapper label="Test" constraints={constraints} currentValue={50}>
          <input />
        </FieldWrapper>
      )

      expect(screen.getByText('Max: 999')).toBeInTheDocument()
    })

    it('formats string length constraints as range', () => {
      const constraints: FieldConstraints = { minLength: 3, maxLength: 500 }

      render(
        <FieldWrapper
          label="Test"
          constraints={constraints}
          currentValue="hello"
        >
          <input />
        </FieldWrapper>
      )

      expect(screen.getByText('3–500 characters')).toBeInTheDocument()
    })

    it('formats minLength only', () => {
      const constraints: FieldConstraints = { minLength: 5 }

      render(
        <FieldWrapper
          label="Test"
          constraints={constraints}
          currentValue="hello"
        >
          <input />
        </FieldWrapper>
      )

      expect(screen.getByText('Min 5 chars')).toBeInTheDocument()
    })

    it('formats maxLength only', () => {
      const constraints: FieldConstraints = { maxLength: 200 }

      render(
        <FieldWrapper
          label="Test"
          constraints={constraints}
          currentValue="test"
        >
          <input />
        </FieldWrapper>
      )

      expect(screen.getByText('Max 200 chars')).toBeInTheDocument()
    })

    it('formats email format constraint', () => {
      const constraints: FieldConstraints = { format: 'email' }

      render(
        <FieldWrapper
          label="Test"
          constraints={constraints}
          currentValue="test@example.com"
        >
          <input />
        </FieldWrapper>
      )

      expect(screen.getByText('Email format')).toBeInTheDocument()
    })

    it('formats URI format constraint', () => {
      const constraints: FieldConstraints = { format: 'uri' }

      render(
        <FieldWrapper
          label="Test"
          constraints={constraints}
          currentValue="https://example.com"
        >
          <input />
        </FieldWrapper>
      )

      expect(screen.getByText('URL format')).toBeInTheDocument()
    })

    it('shows pattern for short patterns', () => {
      const constraints: FieldConstraints = { pattern: '^[A-Z]{3}$' }

      render(
        <FieldWrapper label="Test" constraints={constraints} currentValue="ABC">
          <input />
        </FieldWrapper>
      )

      expect(screen.getByText('Pattern: ^[A-Z]{3}$')).toBeInTheDocument()
    })

    it('hides pattern for long patterns', () => {
      const constraints: FieldConstraints = {
        pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
      }

      render(
        <FieldWrapper
          label="Test"
          constraints={constraints}
          currentValue="test@example.com"
        >
          <input />
        </FieldWrapper>
      )

      expect(screen.queryByText(/Pattern:/)).not.toBeInTheDocument()
    })

    it('combines multiple constraints with bullet separator', () => {
      const constraints: FieldConstraints = {
        min: 1,
        max: 100,
        format: 'email',
      }

      render(
        <FieldWrapper label="Test" constraints={constraints} currentValue={50}>
          <input />
        </FieldWrapper>
      )

      expect(screen.getByText('1–100 • Email format')).toBeInTheDocument()
    })
  })

  describe('default value display', () => {
    it('shows default value when field is empty', () => {
      render(
        <FieldWrapper
          label="Test"
          defaultValue="default text"
          currentValue={undefined}
        >
          <input />
        </FieldWrapper>
      )

      expect(screen.getByText('Default: default text')).toBeInTheDocument()
    })

    it('hides default value when field has value', () => {
      render(
        <FieldWrapper
          label="Test"
          defaultValue="default text"
          currentValue="actual value"
        >
          <input />
        </FieldWrapper>
      )

      expect(screen.queryByText(/Default:/)).not.toBeInTheDocument()
    })

    it('shows default value when field is empty string', () => {
      render(
        <FieldWrapper label="Test" defaultValue="default text" currentValue="">
          <input />
        </FieldWrapper>
      )

      expect(screen.getByText('Default: default text')).toBeInTheDocument()
    })

    it('shows default value when field is null', () => {
      render(
        <FieldWrapper
          label="Test"
          defaultValue="default text"
          currentValue={null}
        >
          <input />
        </FieldWrapper>
      )

      expect(screen.getByText('Default: default text')).toBeInTheDocument()
    })

    it('formats non-string default values', () => {
      render(
        <FieldWrapper label="Test" defaultValue={42} currentValue={undefined}>
          <input />
        </FieldWrapper>
      )

      expect(screen.getByText('Default: 42')).toBeInTheDocument()
    })

    it('formats object default values as JSON', () => {
      render(
        <FieldWrapper
          label="Test"
          defaultValue={{ key: 'value' }}
          currentValue={undefined}
        >
          <input />
        </FieldWrapper>
      )

      expect(screen.getByText('Default: {"key":"value"}')).toBeInTheDocument()
    })

    it('hides default value when hideDefaultValue is true', () => {
      render(
        <FieldWrapper
          label="Test"
          defaultValue="default text"
          currentValue={undefined}
          hideDefaultValue={true}
        >
          <input />
        </FieldWrapper>
      )

      expect(screen.queryByText(/Default:/)).not.toBeInTheDocument()
    })

    it('still shows default value when hideDefaultValue is false', () => {
      render(
        <FieldWrapper
          label="Test"
          defaultValue="default text"
          currentValue={undefined}
          hideDefaultValue={false}
        >
          <input />
        </FieldWrapper>
      )

      expect(screen.getByText('Default: default text')).toBeInTheDocument()
    })
  })
})
