import React from 'react'
import { useFrontmatterValue } from '../../../hooks/useFrontmatterValue'
import {
  useCollectionEntriesQuery,
  type EntryOption,
} from '../../../hooks/queries/useCollectionEntriesQuery'
import { Button } from '../../ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../../ui/command'
import { Badge } from '../../ui/badge'
import { Check, ChevronsUpDown, X } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { FieldWrapper } from './FieldWrapper'
import { FieldType } from '../../../lib/schema'
import type { FieldControlProps } from './types'
import { NONE_SENTINEL } from './constants'

export const ReferenceField: React.FC<FieldControlProps> = ({
  name,
  label,
  field,
}) => {
  const [open, setOpen] = React.useState(false)
  const labelId = `${React.useId()}-label`
  const [value, setValue] = useFrontmatterValue(name)

  // Determine if this is a multi-select (array reference) or single select
  const isMultiSelect = field?.type === FieldType.Array && !!field?.subReference

  // Get the referenced collection name
  const referencedCollection = isMultiSelect
    ? field?.subReference
    : field?.reference

  const { options, isLoading, found } =
    useCollectionEntriesQuery(referencedCollection)

  // Handle single select value
  const selectedValue = isMultiSelect
    ? undefined
    : typeof value === 'string'
      ? value
      : ''

  // Handle multi-select values
  const selectedValues = isMultiSelect
    ? Array.isArray(value)
      ? (value as string[])
      : []
    : []

  // A value that isn't one of the collection's ids (a typo, a renamed entry)
  // shows as it's written, so it can be seen and removed
  const optionFor = (value: string): EntryOption | undefined =>
    options.find(opt => opt.value === value) ??
    (isLoading ? undefined : { value, label: value })

  // Get current selection label for single select
  const selectedOption = selectedValue ? optionFor(selectedValue) : undefined

  // Get selected options for multi-select
  const selectedOptions = selectedValues
    .map(optionFor)
    .filter((opt): opt is EntryOption => !!opt)

  // Handle multi-select toggle
  const handleMultiSelectToggle = (optionValue: string) => {
    const newValues = selectedValues.includes(optionValue)
      ? selectedValues.filter(v => v !== optionValue)
      : [...selectedValues, optionValue]

    setValue(newValues.length > 0 ? newValues : undefined)
  }

  // Handle removing a selected item in multi-select
  const handleRemoveItem = (
    optionValue: string,
    e: React.MouseEvent | React.KeyboardEvent
  ) => {
    e.stopPropagation()
    const newValues = selectedValues.filter(v => v !== optionValue)
    setValue(newValues.length > 0 ? newValues : undefined)
  }

  return (
    <FieldWrapper label={label} field={field} value={value} labelId={labelId}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              aria-labelledby={labelId}
              className={cn(
                'w-full justify-between',
                isMultiSelect && 'h-auto min-h-10 py-2'
              )}
            />
          }
        >
          <div className="flex min-w-0 flex-1 flex-wrap gap-1">
            {isMultiSelect ? (
              selectedOptions.length > 0 ? (
                selectedOptions.map(opt => (
                  <Badge
                    key={opt.value}
                    variant="secondary"
                    title={opt.label}
                    className="max-w-full gap-1 pr-1 has-focus-visible:border-ring has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50"
                  >
                    <span className="truncate">{opt.label}</span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={e => handleRemoveItem(opt.value, e)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          handleRemoveItem(opt.value, e)
                        }
                      }}
                      className="shrink-0 cursor-pointer rounded-full outline-hidden"
                      aria-label="Remove"
                    >
                      <X className="h-3 w-3" />
                      <span className="sr-only">Remove</span>
                    </span>
                  </Badge>
                ))
              ) : (
                <span className="truncate text-muted-foreground">
                  Select {label.toLowerCase()}...
                </span>
              )
            ) : selectedOption ? (
              <span className="truncate">{selectedOption.label}</span>
            ) : (
              <span className="truncate text-muted-foreground">
                Select {label.toLowerCase()}...
              </span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </PopoverTrigger>
        <PopoverContent className="w-(--anchor-width) p-0">
          <Command>
            <CommandInput placeholder={`Search ${label.toLowerCase()}...`} />
            <CommandList>
              <CommandEmpty>
                {isLoading
                  ? 'Loading...'
                  : !found
                    ? `Collection "${referencedCollection}" not found`
                    : 'No items found.'}
              </CommandEmpty>
              <CommandGroup>
                {/* For single select, show None option */}
                {!isMultiSelect && (
                  <CommandItem
                    value={NONE_SENTINEL}
                    onSelect={() => {
                      setValue(undefined)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        !value ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span className="text-muted-foreground">(None)</span>
                  </CommandItem>
                )}

                {/* Reference options */}
                {options.map(option => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={currentValue => {
                      if (isMultiSelect) {
                        handleMultiSelectToggle(currentValue)
                      } else {
                        setValue(currentValue)
                        setOpen(false)
                      }
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        isMultiSelect
                          ? selectedValues.includes(option.value)
                            ? 'opacity-100'
                            : 'opacity-0'
                          : selectedValue === option.value
                            ? 'opacity-100'
                            : 'opacity-0'
                      )}
                    />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </FieldWrapper>
  )
}
