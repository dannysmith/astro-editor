import type React from 'react'
import { FieldDescription, FieldLabel } from '../ui/field'

interface FormFieldProps {
  label: string
  /** Id of a text control: clicking the label focuses it */
  htmlFor?: string
  /** Id for the label, for button controls that name themselves with aria-labelledby */
  labelId?: string
  required?: boolean
  /** Shown beside the label, so it doesn't add a line under every field */
  defaultValue?: string
  description?: React.ReactNode
  children: React.ReactNode
}

/**
 * A field in the component builder form: the label with the default beside it,
 * then the control and any help text. More compact than the frontmatter
 * panel's FieldWrapper, since a component can have a dozen props.
 */
export function FormField({
  label,
  htmlFor,
  labelId,
  required,
  defaultValue,
  description,
  children,
}: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <FieldLabel htmlFor={htmlFor} id={labelId}>
          {label}
          {required && <span className="ml-1 text-required">*</span>}
        </FieldLabel>
        {defaultValue !== undefined && (
          <span className="truncate text-xs text-muted-foreground">
            Default: {defaultValue}
          </span>
        )}
      </div>
      {children}
      {description && (
        <FieldDescription className="text-xs">{description}</FieldDescription>
      )}
    </div>
  )
}
