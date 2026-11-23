import React from 'react'
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldContent,
} from '@/components/ui/field'
import { fieldGuidance, isEmptyValue } from '../../../lib/field-guidance'
import { cn } from '../../../lib/utils'
import type { SchemaField } from '../../../lib/schema'

interface FieldWrapperProps {
  label: string
  /** The field's schema: whether it's required, its description, default and constraints */
  field?: SchemaField
  /** The field's value, which its constraints are checked against */
  value?: unknown
  /** Id of a text control: clicking the label focuses it */
  htmlFor?: string
  /** Id for the label, for button controls that name themselves with aria-labelledby (htmlFor would click them) */
  labelId?: string
  /** Shown instead of the schema's description */
  description?: string
  /** `horizontal` puts the control beside the label, with the description below both */
  layout?: 'vertical' | 'horizontal'
  /**
   * Whether the control sits in the field's box with its footer attached. Off
   * for controls made of several boxes (image pickers)
   */
  framed?: boolean
  /** A problem only the control can know about, shown in the footer */
  problem?: string
  /** Floats over the control, inside the box: a small action */
  overlay?: React.ReactNode
  /** Goes straight after the box */
  after?: React.ReactNode
  children: React.ReactNode
  hideDefaultValue?: boolean
}

/** The footer: the field's rules or what's wrong, and how much of a limit is used */
const GuidanceFooter: React.FC<{
  id: string
  text: string | null
  count: string | null
  isProblem: boolean
  framed: boolean
}> = ({ id, text, count, isProblem, framed }) => {
  if (!text && !count) return null
  return (
    <div
      id={id}
      data-slot="field-footer"
      className={cn(
        'flex items-center justify-between gap-2 text-xs text-muted-foreground',
        framed && 'min-h-6 border-t border-input/70 bg-muted/50 px-3 py-0.5',
        isProblem && 'text-warning'
      )}
    >
      <span
        className="min-w-0 truncate"
        title={text ?? undefined}
        aria-live="polite"
      >
        {text}
      </span>
      {count && <span className="shrink-0 tabular-nums">{count}</span>}
    </div>
  )
}

/**
 * A frontmatter field: its label, its control in a box with a footer attached
 * for its constraints, and its description. A required field that's empty has
 * a coloured left edge. Nothing here stops a value being typed or saved.
 */
export const FieldWrapper: React.FC<FieldWrapperProps> = ({
  label,
  field,
  value,
  htmlFor,
  labelId,
  description: descriptionOverride,
  layout = 'vertical',
  framed = true,
  problem: controlProblem,
  overlay,
  after,
  children,
  hideDefaultValue = false,
}) => {
  const [isFocused, setIsFocused] = React.useState(false)
  const footerId = React.useId()
  const description = descriptionOverride ?? field?.description
  const isMissing = Boolean(field?.required) && isEmptyValue(value)

  const guidance = fieldGuidance(field, value, {
    hideDefault: hideDefaultValue,
    isTyping: isFocused,
  })
  const problem = controlProblem
    ? { message: controlProblem, whileTyping: true }
    : guidance.problem
  const shownProblem = problem?.whileTyping || !isFocused ? problem : null
  const footerText = shownProblem?.message ?? guidance.note

  const fieldLabel = (
    <FieldLabel htmlFor={htmlFor} id={labelId}>
      {label}
      {field?.required && <span className="sr-only">{' (required)'}</span>}
    </FieldLabel>
  )
  const descriptionText = description && (
    <FieldDescription>{description}</FieldDescription>
  )
  const footer = (
    <GuidanceFooter
      id={footerId}
      text={footerText}
      count={guidance.count}
      isProblem={Boolean(shownProblem)}
      framed={framed}
    />
  )
  const focusHandlers = {
    onFocus: () => setIsFocused(true),
    onBlur: (event: React.FocusEvent<HTMLDivElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        setIsFocused(false)
      }
    },
  }

  if (layout === 'horizontal') {
    return (
      <div
        className={cn(
          'flex flex-col gap-1.5',
          isMissing && 'border-l-2 border-l-required pl-2.5'
        )}
      >
        <Field orientation="horizontal">
          {fieldLabel}
          {children}
        </Field>
        {descriptionText}
      </div>
    )
  }

  return (
    <Field
      orientation="vertical"
      aria-describedby={footerText || guidance.count ? footerId : undefined}
    >
      {fieldLabel}
      <FieldContent>
        {framed ? (
          <div
            data-slot="field-frame"
            {...focusHandlers}
            className={cn(
              'relative overflow-hidden rounded-md border border-input shadow-xs transition-[color,box-shadow] dark:bg-input/30',
              'has-[:focus-visible]:border-ring has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50',
              // The control gives up its own box to the frame
              '[&>[data-slot=field-control]>*]:w-full [&>[data-slot=field-control]>*]:rounded-none [&>[data-slot=field-control]>*]:border-0 [&>[data-slot=field-control]>*]:bg-transparent [&>[data-slot=field-control]>*]:shadow-none [&>[data-slot=field-control]>*]:ring-0!',
              '[&>[data-slot=field-control]>button:hover]:bg-accent/50',
              isMissing && 'border-l-2 border-l-required'
            )}
          >
            <div data-slot="field-control">{children}</div>
            {overlay}
            {footer}
          </div>
        ) : (
          <div
            {...focusHandlers}
            className={cn(
              'space-y-1.5',
              isMissing && 'border-l-2 border-l-required pl-2.5'
            )}
          >
            {children}
            {footer}
          </div>
        )}
        {after}
        {descriptionText}
      </FieldContent>
    </Field>
  )
}
