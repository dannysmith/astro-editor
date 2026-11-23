import React from 'react'
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldContent,
} from '@/components/ui/field'
import type { FieldConstraints, SchemaField } from '../../../lib/schema'

interface FieldWrapperProps {
  label: string
  /** The field's schema: its required mark, description, default and constraints */
  field?: SchemaField
  /** The field's value. The schema's default is only shown while it's empty */
  value?: unknown
  /** Id of a text control: clicking the label focuses it */
  htmlFor?: string
  /** Id for the label, for button controls that name themselves with aria-labelledby (htmlFor would click them) */
  labelId?: string
  /** Shown instead of the schema's description */
  description?: string
  /** `horizontal` puts the control beside the label, with the hints below both */
  layout?: 'vertical' | 'horizontal'
  children: React.ReactNode
  hideDefaultValue?: boolean
}

/** A frontmatter field's label and hints, around its control */
export const FieldWrapper: React.FC<FieldWrapperProps> = ({
  label,
  field,
  value,
  htmlFor,
  labelId,
  description: descriptionOverride,
  layout = 'vertical',
  children,
  hideDefaultValue = false,
}) => {
  const description = descriptionOverride ?? field?.description
  const isEmpty = value === undefined || value === null || value === ''
  const showDefault =
    !hideDefaultValue && field?.default !== undefined && isEmpty

  const metadataText = formatMetadata(
    field?.constraints,
    showDefault ? field?.default : undefined
  )

  const fieldLabel = (
    <FieldLabel htmlFor={htmlFor} id={labelId}>
      {label}
      {field?.required && <span className="ml-1 text-required">*</span>}
    </FieldLabel>
  )
  const hints = (
    <>
      {description && <FieldDescription>{description}</FieldDescription>}
      {metadataText && (
        <FieldDescription className="text-xs">{metadataText}</FieldDescription>
      )}
    </>
  )

  if (layout === 'horizontal') {
    return (
      <div className="flex flex-col gap-1.5">
        <Field orientation="horizontal">
          {fieldLabel}
          {children}
        </Field>
        {hints}
      </div>
    )
  }

  return (
    <Field orientation="vertical">
      {fieldLabel}
      <FieldContent>
        {children}
        {hints}
      </FieldContent>
    </Field>
  )
}

function formatMetadata(
  constraints?: FieldConstraints,
  defaultValue?: unknown
): string | null {
  const parts: string[] = []

  if (constraints) {
    // Numeric constraints. Exclusive bounds (`gt`, `lt`) show as "> 0"
    const { min, max, minExclusive, maxExclusive } = constraints
    if (
      min !== undefined &&
      max !== undefined &&
      !minExclusive &&
      !maxExclusive
    ) {
      parts.push(`${min}–${max}`)
    } else {
      if (min !== undefined) {
        parts.push(minExclusive ? `> ${min}` : `Min: ${min}`)
      }
      if (max !== undefined) {
        parts.push(maxExclusive ? `< ${max}` : `Max: ${max}`)
      }
    }

    // String length constraints
    if (
      constraints.minLength !== undefined &&
      constraints.maxLength !== undefined
    ) {
      parts.push(`${constraints.minLength}–${constraints.maxLength} characters`)
    } else if (constraints.minLength !== undefined) {
      parts.push(`Min ${constraints.minLength} chars`)
    } else if (constraints.maxLength !== undefined) {
      parts.push(`Max ${constraints.maxLength} chars`)
    }

    // Array length constraints
    const items = (count: number) => (count === 1 ? 'item' : 'items')
    if (
      constraints.minItems !== undefined &&
      constraints.minItems === constraints.maxItems
    ) {
      parts.push(
        `Exactly ${constraints.minItems} ${items(constraints.minItems)}`
      )
    } else if (
      constraints.minItems !== undefined &&
      constraints.maxItems !== undefined
    ) {
      parts.push(`${constraints.minItems}–${constraints.maxItems} items`)
    } else if (constraints.minItems !== undefined) {
      parts.push(
        `At least ${constraints.minItems} ${items(constraints.minItems)}`
      )
    } else if (constraints.maxItems !== undefined) {
      parts.push(`Up to ${constraints.maxItems} ${items(constraints.maxItems)}`)
    }

    // Format hints
    if (constraints.format) {
      const formatLabels: Record<string, string> = {
        email: 'Email format',
        uri: 'URL format',
        'date-time': 'Date/time format',
        date: 'Date format',
      }
      const label = formatLabels[constraints.format]
      if (label) parts.push(label)
    }

    // Pattern (only if it's simple enough to show)
    if (constraints.pattern && constraints.pattern.length < 30) {
      parts.push(`Pattern: ${constraints.pattern}`)
    }
  }

  // Default value, unless it's empty (`''`, `[]`, `{}`), which would show a
  // bare "Default:"
  const emptyDefault =
    defaultValue === '' ||
    (Array.isArray(defaultValue) && defaultValue.length === 0) ||
    (typeof defaultValue === 'object' &&
      defaultValue !== null &&
      Object.keys(defaultValue).length === 0)
  if (defaultValue !== undefined && !emptyDefault) {
    const defaultStr =
      typeof defaultValue === 'string'
        ? defaultValue
        : JSON.stringify(defaultValue)
    parts.push(`Default: ${defaultStr}`)
  }

  return parts.length > 0 ? parts.join(' • ') : null
}
