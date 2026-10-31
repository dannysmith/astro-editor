import React from 'react'
import type { PropInfo } from '@/types'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '../ui/combobox'
import { useComponentBuilderStore } from '../../store/componentBuilderStore'
import {
  useCollectionEntriesQuery,
  type EntryOption,
} from '../../hooks/queries/useCollectionEntriesQuery'
import { FormField } from './FormField'

/**
 * A collection-entry prop when the builder adds imports: pick an entry, which
 * the file loads with `getEntry`. The prop's value is the name it's loaded as.
 */
export function EntryPropField({
  prop,
  collection,
  label,
  required,
  description,
}: {
  prop: PropInfo
  collection: string
  label: string
  required: boolean
  description: string
}) {
  const entry = useComponentBuilderStore(state => state.entries[prop.name])
  const setEntry = useComponentBuilderStore(state => state.setEntry)
  const { options, isLoading } = useCollectionEntriesQuery(collection)
  const id = React.useId()

  const selected = options.find(option => option.value === entry?.id) ?? null
  return (
    <FormField
      label={label}
      htmlFor={id}
      required={required}
      description={description}
    >
      <Combobox
        items={options}
        value={selected}
        onValueChange={(next: EntryOption | null) =>
          void setEntry(
            prop.name,
            next ? { collection, id: next.value } : undefined
          )
        }
      >
        <ComboboxInput
          id={id}
          className="w-full"
          placeholder={isLoading ? 'Loading entries…' : `Search ${collection}…`}
          showClear
        />
        {/* The form scrolls, so measure room for the list against the window,
            or it flips upwards over the fields above */}
        <ComboboxContent collisionBoundary={document.documentElement}>
          <ComboboxEmpty>No matches</ComboboxEmpty>
          <ComboboxList>
            {(option: EntryOption) => (
              <ComboboxItem key={option.value} value={option}>
                {option.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </FormField>
  )
}
