import React from 'react'
import { useFrontmatterValue } from '../../../hooks/useFrontmatterValue'
import { DatePicker } from '../../ui/date-picker'
import { FieldWrapper } from './FieldWrapper'
import { RenameToDateLink } from './RenameToDateLink'
import type { FieldControlProps } from './types'
import { formatIsoDate, parseIsoDate } from '../../../lib/dates'

interface DateFieldProps extends FieldControlProps {
  /** The collection's published date, which the file's name can follow */
  isPublishedDate?: boolean
}

export const DateField: React.FC<DateFieldProps> = ({
  name,
  label,
  field,
  isPublishedDate = false,
}) => {
  const [value, setValue] = useFrontmatterValue(name)
  const id = React.useId()
  const labelId = `${id}-label`

  return (
    <FieldWrapper
      label={label}
      field={field}
      value={value}
      labelId={labelId}
      after={
        isPublishedDate && (
          <RenameToDateLink
            date={
              value && typeof value === 'string'
                ? parseIsoDate(value)
                : undefined
            }
          />
        )
      }
    >
      <DatePicker
        id={id}
        aria-labelledby={`${labelId} ${id}`}
        value={
          value && typeof value === 'string' ? parseIsoDate(value) : undefined
        }
        onChange={(date: Date | undefined) => {
          const dateValue =
            date instanceof Date && !isNaN(date.getTime())
              ? formatIsoDate(date)
              : undefined
          setValue(dateValue)
        }}
        placeholder="Select date..."
      />
    </FieldWrapper>
  )
}
