import React from 'react'
import type { FieldConstraints } from '../../../lib/schema'

interface FieldWrapperProps {
  label: string
  required?: boolean
  description?: string
  defaultValue?: unknown
  constraints?: FieldConstraints
  layout?: 'vertical' | 'horizontal'
  children: React.ReactNode
  currentValue?: unknown
}

export const FieldWrapper: React.FC<FieldWrapperProps> = ({
  label,
  required,
  description,
  defaultValue,
  constraints,
  layout = 'vertical',
  children,
  currentValue,
}) => {
  const isEmpty =
    currentValue === undefined || currentValue === null || currentValue === ''

  const showDefault = defaultValue !== undefined && isEmpty

  const metadataText = formatMetadata(
    constraints,
    showDefault ? defaultValue : undefined
  )

  if (layout === 'horizontal') {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">
            {label}
            {required && (
              <span className="text-[var(--color-required)] ml-1">*</span>
            )}
          </label>
          {children}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
        {metadataText && (
          <p className="text-xs text-muted-foreground">{metadataText}</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">
          {label}
          {required && (
            <span className="text-[var(--color-required)] ml-1">*</span>
          )}
        </label>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
      {metadataText && (
        <p className="text-xs text-muted-foreground">{metadataText}</p>
      )}
    </div>
  )
}

function formatMetadata(
  constraints?: FieldConstraints,
  defaultValue?: unknown
): string | null {
  const parts: string[] = []

  if (constraints) {
    // Numeric constraints
    if (constraints.min !== undefined && constraints.max !== undefined) {
      parts.push(`${constraints.min}–${constraints.max}`)
    } else if (constraints.min !== undefined) {
      parts.push(`Min: ${constraints.min}`)
    } else if (constraints.max !== undefined) {
      parts.push(`Max: ${constraints.max}`)
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

  // Default value
  if (defaultValue !== undefined) {
    const defaultStr =
      typeof defaultValue === 'string'
        ? defaultValue
        : JSON.stringify(defaultValue)
    parts.push(`Default: ${defaultStr}`)
  }

  return parts.length > 0 ? parts.join(' • ') : null
}
