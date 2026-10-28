import React from 'react'
import type { PropInfo } from '@/types'
import { Input } from '../ui/input'
import { AutoExpandingTextarea } from '../ui/auto-expanding-textarea'
import { Switch } from '../ui/switch'
import { FieldLabel, FieldDescription } from '../ui/field'
import { DatePicker } from '../ui/date-picker'
import { TagInput, type Tag } from '../ui/tag-input'
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '../ui/combobox'
import { NONE_SENTINEL } from '../frontmatter/fields/constants'
import { useComponentBuilderStore } from '../../store/componentBuilderStore'
import { formatIsoDate, parseIsoDate } from '../../lib/dates'
import { FormField } from './FormField'

/** Lists longer than this get a searchable combobox rather than a select */
const SEARCHABLE_OPTIONS = 12

/** What to type for props that take an imported variable, until there are pickers for them */
function bindingHint(prop: PropInfo): string | undefined {
  switch (prop.kind.kind) {
    case 'image':
      return 'The name of an imported image, like heroImage. Add its import yourself.'
    case 'collectionEntry':
      return `The name of an entry from the “${prop.kind.collection}” collection that you’ve loaded in this file.`
    default:
      return undefined
  }
}

/** One prop in the component builder form, with a control chosen by its kind */
export function PropField({ prop }: { prop: PropInfo }) {
  const value = useComponentBuilderStore(state => state.values[prop.name])
  const setValue = useComponentBuilderStore(state => state.setValue)
  const id = React.useId()
  const labelId = `${id}-label`

  const { name, kind } = prop
  const required = !prop.is_optional
  const description = [prop.description, bindingHint(prop)]
    .filter(Boolean)
    .join(' ')
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
        {description && (
          <FieldDescription className="text-xs">{description}</FieldDescription>
        )}
      </div>
    )
  }

  const fieldProps = { label: name, required, description, defaultValue }

  // Optional booleans can also be left to the component's default
  if (kind.kind === 'boolean') {
    const current = typeof value === 'boolean' ? String(value) : 'default'
    return (
      <FormField {...fieldProps} labelId={labelId}>
        <ToggleGroup
          aria-labelledby={labelId}
          variant="outline"
          size="sm"
          spacing={0}
          value={[current]}
          onValueChange={([next]) =>
            setValue(
              name,
              next === undefined || next === 'default'
                ? undefined
                : next === 'true'
            )
          }
        >
          <ToggleGroupItem value="default" className="px-3">
            Default
          </ToggleGroupItem>
          <ToggleGroupItem value="true" className="px-3">
            True
          </ToggleGroupItem>
          <ToggleGroupItem value="false" className="px-3">
            False
          </ToggleGroupItem>
        </ToggleGroup>
      </FormField>
    )
  }

  if (kind.kind === 'literals' && kind.values.length > SEARCHABLE_OPTIONS) {
    return (
      <FormField {...fieldProps} htmlFor={id}>
        <Combobox
          items={kind.values}
          value={typeof value === 'string' ? value : null}
          onValueChange={next => setValue(name, next ?? undefined)}
        >
          <ComboboxInput
            id={id}
            className="w-full"
            placeholder={`Search ${kind.values.length} options…`}
            showClear
          />
          {/* The form scrolls, so measure room for the list against the window,
              or it flips upwards over the fields above */}
          <ComboboxContent collisionBoundary={document.documentElement}>
            <ComboboxEmpty>No matches</ComboboxEmpty>
            <ComboboxList>
              {(option: string) => (
                <ComboboxItem key={option} value={option}>
                  {option}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </FormField>
    )
  }

  if (kind.kind === 'literals') {
    const items = [
      ...(required
        ? []
        : [
            {
              value: NONE_SENTINEL,
              label: <span className="text-muted-foreground">(Not set)</span>,
            },
          ]),
      ...kind.values.map(option => ({ value: option, label: option })),
    ]
    return (
      <FormField {...fieldProps} labelId={labelId}>
        <Select
          items={items}
          value={
            typeof value === 'string' ? value : required ? null : NONE_SENTINEL
          }
          onValueChange={next => {
            if (next === null) return
            setValue(name, next === NONE_SENTINEL ? undefined : next)
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
      </FormField>
    )
  }

  if (kind.kind === 'date') {
    return (
      <FormField {...fieldProps} labelId={labelId}>
        <DatePicker
          id={id}
          aria-labelledby={`${labelId} ${id}`}
          value={typeof value === 'string' ? parseIsoDate(value) : undefined}
          onChange={date =>
            setValue(name, date ? formatIsoDate(date) : undefined)
          }
          placeholder="Select date…"
        />
      </FormField>
    )
  }

  if (kind.kind === 'array' && kind.items.kind === 'literals') {
    const options = kind.items.values
    const selected = Array.isArray(value) ? value : []
    return (
      <FormField {...fieldProps} labelId={labelId}>
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
      </FormField>
    )
  }

  if (kind.kind === 'array') {
    const items = Array.isArray(value) ? value : []
    const isNumbers = kind.items.kind === 'number'
    return (
      <FormField {...fieldProps} htmlFor={id}>
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
      </FormField>
    )
  }

  // Strings grow to fit, so props like `code` can take several lines
  if (kind.kind === 'string') {
    return (
      <FormField {...fieldProps} htmlFor={id}>
        <AutoExpandingTextarea
          id={id}
          minRows={1}
          maxRows={10}
          value={typeof value === 'string' ? value : ''}
          onChange={e => setValue(name, e.target.value || undefined)}
        />
      </FormField>
    )
  }

  // Numbers, imported bindings, and types we can only take as text
  return (
    <FormField {...fieldProps} htmlFor={id}>
      <Input
        id={id}
        type={kind.kind === 'number' ? 'number' : 'text'}
        value={typeof value === 'string' ? value : ''}
        onChange={e => setValue(name, e.target.value || undefined)}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
      />
    </FormField>
  )
}
