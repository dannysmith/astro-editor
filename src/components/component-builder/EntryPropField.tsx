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
 * A collection-entry prop: pick an entry, which the file loads with
 * `getEntry`, and the tag gets the name it's loaded as. `fallback`, a text
 * field, is shown when the app can't list the collection.
 */
export function EntryPropField({
  prop,
  fallback,
}: {
  prop: PropInfo
  fallback: React.ReactNode
}) {
  const collection =
    prop.kind.kind === 'collectionEntry' ? prop.kind.collection : undefined
  const entry = useComponentBuilderStore(state => state.entries[prop.name])
  const setEntry = useComponentBuilderStore(state => state.setEntry)
  const { options, isLoading, found } = useCollectionEntriesQuery(collection)
  const id = React.useId()

  if (!collection || (!found && !isLoading)) return fallback

  const selected = options.find(option => option.value === entry?.id) ?? null
  return (
    <FormField
      label={prop.name}
      htmlFor={id}
      required={!prop.is_optional}
      description={prop.description ?? ''}
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
                {/* The id tells apart entries with the same title */}
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{option.label}</span>
                  {option.label !== option.value && (
                    <span className="truncate text-xs text-muted-foreground">
                      {option.value}
                    </span>
                  )}
                </span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </FormField>
  )
}
