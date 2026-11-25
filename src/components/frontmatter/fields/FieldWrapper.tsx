import React from 'react'
import { FormField } from '@/components/ui/form-field'
import { fieldGuidance, isEmptyValue } from '../../../lib/field-guidance'
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

/**
 * A frontmatter field: a `FormField` whose footer states the schema's
 * constraints for the field and whether the value meets them. A required
 * field that's empty has a coloured left edge. Nothing here stops a value
 * being typed or saved.
 */
export const FieldWrapper: React.FC<FieldWrapperProps> = ({
  label,
  field,
  value,
  htmlFor,
  labelId,
  description,
  layout = 'vertical',
  framed = true,
  problem: controlProblem,
  overlay,
  after,
  children,
  hideDefaultValue = false,
}) => {
  const [isFocused, setIsFocused] = React.useState(false)

  const guidance = fieldGuidance(field, value, {
    hideDefault: hideDefaultValue,
    isTyping: isFocused,
  })
  const problem = controlProblem
    ? { message: controlProblem, whileTyping: true }
    : guidance.problem
  const shownProblem = problem?.whileTyping || !isFocused ? problem : null

  return (
    <FormField
      label={label}
      htmlFor={htmlFor}
      labelId={labelId}
      required={field?.required}
      missing={Boolean(field?.required) && isEmptyValue(value)}
      description={description ?? field?.description}
      footer={{
        text: shownProblem?.message ?? guidance.note,
        count: guidance.count,
        isProblem: Boolean(shownProblem),
      }}
      layout={layout}
      framed={framed}
      overlay={overlay}
      after={after}
      onFocusChange={setIsFocused}
    >
      {children}
    </FormField>
  )
}
