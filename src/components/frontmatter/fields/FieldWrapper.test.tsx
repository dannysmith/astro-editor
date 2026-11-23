import { describe, it, expect } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { FieldWrapper } from './FieldWrapper'
import { FieldType, type SchemaField } from '../../../lib/schema'

const fieldWith = (overrides: Partial<SchemaField>): SchemaField => ({
  name: 'test',
  label: 'Test',
  type: FieldType.String,
  required: false,
  ...overrides,
})

const frame = (container: HTMLElement) =>
  container.querySelector('[data-slot="field-frame"]')

describe('FieldWrapper', () => {
  it('renders its label, control and description', () => {
    render(
      <FieldWrapper label="Test Field" description="A helpful description">
        <input data-testid="test-input" />
      </FieldWrapper>
    )

    expect(screen.getByText('Test Field')).toBeInTheDocument()
    expect(screen.getByTestId('test-input')).toBeInTheDocument()
    expect(screen.getByText('A helpful description')).toBeInTheDocument()
  })

  it("uses the schema's description unless given another", () => {
    const field = fieldWith({ description: 'From the schema' })
    const { rerender } = render(
      <FieldWrapper label="Test" field={field}>
        <input />
      </FieldWrapper>
    )
    expect(screen.getByText('From the schema')).toBeInTheDocument()

    rerender(
      <FieldWrapper label="Test" field={field} description="Instead">
        <input />
      </FieldWrapper>
    )
    expect(screen.getByText('Instead')).toBeInTheDocument()
    expect(screen.queryByText('From the schema')).not.toBeInTheDocument()
  })

  describe('required fields', () => {
    const required = fieldWith({ required: true })

    it('marks an empty required field with a coloured edge', () => {
      const { container } = render(
        <FieldWrapper label="Test" field={required} value="">
          <input />
        </FieldWrapper>
      )
      expect(frame(container)).toHaveClass('border-l-required')
    })

    it('drops the edge once it has a value', () => {
      const { container } = render(
        <FieldWrapper label="Test" field={required} value="Filled">
          <input />
        </FieldWrapper>
      )
      expect(frame(container)).not.toHaveClass('border-l-required')
    })

    it("doesn't mark an empty optional field", () => {
      const { container } = render(
        <FieldWrapper label="Test" field={fieldWith({})} value="">
          <input />
        </FieldWrapper>
      )
      expect(frame(container)).not.toHaveClass('border-l-required')
    })

    it('tells screen readers, filled or not', () => {
      render(
        <FieldWrapper label="Test" field={required} value="Filled">
          <input />
        </FieldWrapper>
      )
      expect(screen.getByText('(required)')).toHaveClass('sr-only')
    })
  })

  describe('footer', () => {
    it('has no footer when there is nothing to say', () => {
      const { container } = render(
        <FieldWrapper label="Test" field={fieldWith({})} value="Text">
          <input />
        </FieldWrapper>
      )
      expect(
        container.querySelector('[data-slot="field-footer"]')
      ).not.toBeInTheDocument()
    })

    it('shows the rules and the count', () => {
      render(
        <FieldWrapper
          label="Test"
          field={fieldWith({ constraints: { minLength: 3, maxLength: 100 } })}
          value="Hello"
        >
          <input />
        </FieldWrapper>
      )
      expect(screen.getByText('Min 3')).toBeInTheDocument()
      expect(screen.getByText('5 / 100')).toBeInTheDocument()
    })

    it('replaces the rules with the problem', () => {
      render(
        <FieldWrapper
          label="Test"
          field={fieldWith({ type: FieldType.URL })}
          value="not a url"
        >
          <input />
        </FieldWrapper>
      )
      expect(screen.getByText("Doesn't look like a URL")).toBeInTheDocument()
      expect(screen.queryByText('URL')).not.toBeInTheDocument()
    })

    it('holds back a problem that can wait until the writer leaves', () => {
      render(
        <FieldWrapper
          label="Test"
          field={fieldWith({ type: FieldType.URL })}
          value="not a url"
        >
          <input />
        </FieldWrapper>
      )
      const input = screen.getByRole('textbox')

      fireEvent.focus(input)
      expect(screen.getByText('URL')).toBeInTheDocument()

      fireEvent.blur(input)
      expect(screen.getByText("Doesn't look like a URL")).toBeInTheDocument()
    })

    it('shows going over a limit while typing', () => {
      render(
        <FieldWrapper
          label="Test"
          field={fieldWith({ constraints: { maxLength: 3 } })}
          value="Hello"
        >
          <input />
        </FieldWrapper>
      )

      fireEvent.focus(screen.getByRole('textbox'))

      expect(screen.getByText('2 over')).toBeInTheDocument()
    })

    it('shows a problem only the control knows about', () => {
      render(
        <FieldWrapper label="Test" value="x" problem="Not in authors">
          <input />
        </FieldWrapper>
      )
      expect(screen.getByText('Not in authors')).toBeInTheDocument()
    })

    it('describes the field to screen readers', () => {
      render(
        <FieldWrapper
          label="Test"
          field={fieldWith({ type: FieldType.URL })}
          value="not a url"
        >
          <input />
        </FieldWrapper>
      )
      expect(screen.getByRole('group')).toHaveAccessibleDescription(
        "Doesn't look like a URL"
      )
    })

    it('has no description without a footer', () => {
      render(
        <FieldWrapper label="Test" field={fieldWith({})} value="Text">
          <input />
        </FieldWrapper>
      )
      expect(screen.getByRole('group')).not.toHaveAttribute('aria-describedby')
    })
  })

  describe('horizontal layout', () => {
    it('puts the control beside the label', () => {
      const { container } = render(
        <FieldWrapper label="Test Field" layout="horizontal">
          <div data-testid="toggle">Toggle</div>
        </FieldWrapper>
      )

      const row = container.querySelector('[data-orientation="horizontal"]')
      expect(row).toContainElement(screen.getByTestId('toggle'))
    })

    it('can leave out the default', () => {
      render(
        <FieldWrapper
          label="Test"
          layout="horizontal"
          field={fieldWith({ default: 'default text' })}
          hideDefaultValue
        >
          <input />
        </FieldWrapper>
      )
      expect(screen.queryByText(/Default:/)).not.toBeInTheDocument()
    })
  })

  it('shows its footer under a control made of several boxes', () => {
    const { container } = render(
      <FieldWrapper
        label="Test"
        framed={false}
        field={fieldWith({ constraints: { maxItems: 3 } })}
        value={['a.png']}
      >
        <input />
      </FieldWrapper>
    )
    expect(frame(container)).not.toBeInTheDocument()
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
  })
})
