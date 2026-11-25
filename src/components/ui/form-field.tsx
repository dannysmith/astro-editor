import React from 'react'
import { cn } from '@/lib/utils'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from '@/components/ui/field'

/** A line attached under the control: a note or problem, and a count */
export interface FormFieldFooter {
  text: string | null
  /** How much of a limit is used, like `46 / 100` */
  count?: string | null
  /** Shows the text as a warning */
  isProblem?: boolean
}

interface FormFieldProps {
  label: string
  /** Id of a text control: clicking the label focuses it */
  htmlFor?: string
  /** Id for the label, for button controls that name themselves with aria-labelledby (htmlFor would click them) */
  labelId?: string
  /** Tells screen readers the field is required */
  required?: boolean
  /** A required field that's empty: shown with a coloured left edge */
  missing?: boolean
  description?: React.ReactNode
  footer?: FormFieldFooter
  /** `horizontal` puts the control beside the label, with the description below both, and no footer */
  layout?: 'vertical' | 'horizontal'
  /**
   * `side` puts the label in a column to the left of the control, so a form
   * with many fields reads as a list. A `horizontal` control then sits at
   * the start of the control column, in line with the others
   */
  labelPosition?: 'top' | 'side'
  /**
   * Whether the control sits in the field's box with its footer attached. Off
   * for controls made of several boxes (image pickers)
   */
  framed?: boolean
  /** Floats over the control, inside the box: a small action */
  overlay?: React.ReactNode
  /** Goes straight after the box */
  after?: React.ReactNode
  /** Called when focus moves into or out of the control */
  onFocusChange?: (focused: boolean) => void
  children: React.ReactNode
}

/** A label column beside the control column */
const SIDE_LABEL_GRID = 'grid grid-cols-[8rem_minmax(0,1fr)] gap-x-4 gap-y-0'

const Footer: React.FC<{
  id: string
  footer: FormFieldFooter
  framed: boolean
}> = ({ id, footer: { text, count, isProblem }, framed }) => {
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
 * A labelled form field: its control in a box with a footer attached, and a
 * description below. The control gives up its own border and background to
 * the box. Only shows what it's given; working out what the footer says is
 * up to the caller.
 */
export const FormField: React.FC<FormFieldProps> = ({
  label,
  htmlFor,
  labelId,
  required = false,
  missing = false,
  description,
  footer = { text: null },
  layout = 'vertical',
  labelPosition = 'top',
  framed = true,
  overlay,
  after,
  onFocusChange,
  children,
}) => {
  const footerId = React.useId()
  const hasFooter = Boolean(footer.text || footer.count)
  const side = labelPosition === 'side'

  const fieldLabel = (
    <FieldLabel
      htmlFor={htmlFor}
      id={labelId}
      // Level with the text in a control beside it
      className={cn(
        side && 'self-start',
        side && layout === 'vertical' && 'pt-2.5'
      )}
    >
      {label}
      {required && <span className="sr-only">{' (required)'}</span>}
    </FieldLabel>
  )
  const descriptionText = description && (
    <FieldDescription>{description}</FieldDescription>
  )
  const focusHandlers = {
    onFocus: () => onFocusChange?.(true),
    onBlur: (event: React.FocusEvent<HTMLDivElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        onFocusChange?.(false)
      }
    },
  }

  if (layout === 'horizontal' && side) {
    return (
      <Field orientation="vertical" className={SIDE_LABEL_GRID}>
        {fieldLabel}
        <FieldContent>
          <div className="flex">{children}</div>
          {descriptionText}
        </FieldContent>
      </Field>
    )
  }

  if (layout === 'horizontal') {
    return (
      <div
        className={cn(
          'flex flex-col gap-1.5',
          missing && 'border-l-2 border-l-required pl-2.5'
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
      className={cn(side && SIDE_LABEL_GRID)}
      aria-describedby={hasFooter ? footerId : undefined}
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
              missing && 'border-l-2 border-l-required'
            )}
          >
            <div data-slot="field-control">{children}</div>
            {overlay}
            <Footer id={footerId} footer={footer} framed />
          </div>
        ) : (
          <div
            {...focusHandlers}
            className={cn(
              'space-y-1.5',
              missing && 'border-l-2 border-l-required pl-2.5'
            )}
          >
            {children}
            <Footer id={footerId} footer={footer} framed={false} />
          </div>
        )}
        {after}
        {descriptionText}
      </FieldContent>
    </Field>
  )
}
