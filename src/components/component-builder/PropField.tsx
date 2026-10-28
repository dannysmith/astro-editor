import React from 'react'
import type { PropInfo } from '@/types'
import { Input } from '../ui/input'
import { Switch } from '../ui/switch'
import { FieldLabel, FieldDescription } from '../ui/field'
import { DatePicker } from '../ui/date-picker'
import { TagInput, type Tag } from '../ui/tag-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { FieldWrapper } from '../frontmatter/fields/FieldWrapper'
import { NONE_SENTINEL } from '../frontmatter/fields/constants'
import { useComponentBuilderStore } from '../../store/componentBuilderStore'
import { formatIsoDate, parseIsoDate } from '../../lib/dates'

/** One prop in the component builder form, with a control chosen by its kind */
export function PropField({ prop }: { prop: PropInfo }) {
  const value = useComponentBuilderStore(state => state.values[prop.name])
  const setValue = useComponentBuilderStore(state => state.setValue)
  const id = React.useId()
  const labelId = `${id}-label`

  const { name, kind } = prop
  const required = !prop.is_optional
  const description = prop.description ?? undefined
  // Defaults like `''` or `null` mean "nothing", so they aren't worth showing
  const defaultValue =
    prop.default_value && !['null', 'undefined'].includes(prop.default_value)
      ? prop.default_value
      : undefined

  if (kind.kind === 'boolean' && required) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-3">
          <FieldLabel htmlFor={id}>
            {name}
            <span className="ml-1 text-required">*</span>
          </FieldLabel>
          <Switch
            id={id}
            checked={value === true}
            onCheckedChange={checked => setValue(name, checked)}
          />
        </div>
        {description && <FieldDescription>{description}</FieldDescription>}
      </div>
    )
  }

  const wrapperProps = {
    label: name,
    required,
    description,
    defaultValue,
    currentValue: value,
  }

  if (kind.kind === 'boolean' || kind.kind === 'literals') {
    const options = kind.kind === 'boolean' ? ['true', 'false'] : kind.values
    const selected =
      typeof value === 'boolean' ? String(value) : (value as string | undefined)
    const items = [
      ...(required
        ? []
        : [
            {
              value: NONE_SENTINEL,
              label: <span className="text-muted-foreground">(Not set)</span>,
            },
          ]),
      ...options.map(option => ({ value: option, label: option })),
    ]
    return (
      <FieldWrapper {...wrapperProps} labelId={labelId}>
        <Select
          items={items}
          value={selected ?? (required ? null : NONE_SENTINEL)}
          onValueChange={next => {
            if (next === null) return
            if (next === NONE_SENTINEL) return setValue(name, undefined)
            setValue(name, kind.kind === 'boolean' ? next === 'true' : next)
          }}
        >
          <SelectTrigger aria-labelledby={labelId} className="w-full">
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {items.map(item => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldWrapper>
    )
  }

  if (kind.kind === 'date') {
    return (
      <FieldWrapper {...wrapperProps} labelId={labelId}>
        <DatePicker
          id={id}
          aria-labelledby={`${labelId} ${id}`}
          value={typeof value === 'string' ? parseIsoDate(value) : undefined}
          onChange={date =>
            setValue(name, date ? formatIsoDate(date) : undefined)
          }
          placeholder="Select date…"
        />
      </FieldWrapper>
    )
  }

  if (kind.kind === 'array' && kind.items.kind === 'literals') {
    const options = kind.items.values
    const selected = Array.isArray(value) ? value : []
    return (
      <FieldWrapper {...wrapperProps} labelId={labelId}>
        <Select
          multiple
          value={selected}
          onValueChange={next =>
            // Keep the order the component declares, not the order they were picked
            setValue(
              name,
              options.filter(option => next.includes(option))
            )
          }
        >
          <SelectTrigger aria-labelledby={labelId} className="w-full">
            <SelectValue>
              {(picked: string[]) =>
                picked.length > 0 ? (
                  picked.join(', ')
                ) : (
                  <span className="text-muted-foreground">Select…</span>
                )
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {options.map(option => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldWrapper>
    )
  }

  if (kind.kind === 'array') {
    const items = Array.isArray(value) ? value : []
    const isNumbers = kind.items.kind === 'number'
    return (
      <FieldWrapper {...wrapperProps} htmlFor={id}>
        <TagInput
          inputId={id}
          tags={items.map((text, index) => ({ id: `${index}-${text}`, text }))}
          onTagsChange={(tags: Tag[]) =>
            setValue(
              name,
              tags
                .map(tag => tag.text)
                .filter(text => !isNumbers || !isNaN(Number(text)))
            )
          }
          placeholder={isNumbers ? 'Add a number…' : 'Add an item…'}
        />
      </FieldWrapper>
    )
  }

  // Strings, numbers, and types we can only take as text
  return (
    <FieldWrapper {...wrapperProps} htmlFor={id}>
      <Input
        id={id}
        type={kind.kind === 'number' ? 'number' : 'text'}
        value={typeof value === 'string' ? value : ''}
        onChange={e => setValue(name, e.target.value || undefined)}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
      />
    </FieldWrapper>
  )
}
