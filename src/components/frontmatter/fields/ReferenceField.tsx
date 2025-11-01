import React from 'react'
import { useEditorStore } from '../../../store/editorStore'
import { getNestedValue } from '../../../lib/object-utils'
import { useProjectStore } from '../../../store/projectStore'
import { useCollectionsQuery } from '../../../hooks/queries/useCollectionsQuery'
import { useCollectionFilesQuery } from '../../../hooks/queries/useCollectionFilesQuery'
import { useFileBasedCollectionQuery } from '../../../hooks/queries/useFileBasedCollectionQuery'
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
import type { FieldProps } from '../../../types/common'
import type { SchemaField } from '../../../lib/schema'
import { NONE_SENTINEL } from './constants'

interface ReferenceFieldProps extends FieldProps {
  field?: SchemaField
}

interface ReferenceOption {
  value: string // slug/id
  label: string // title from frontmatter or fallback
}

export const ReferenceField: React.FC<ReferenceFieldProps> = ({
  name,
  label,
  required,
  field,
}) => {
  const [open, setOpen] = React.useState(false)
  const value = useEditorStore(state => getNestedValue(state.frontmatter, name))
  const updateFrontmatterField = useEditorStore(
    state => state.updateFrontmatterField
  )
  const { projectPath } = useProjectStore()

  // Determine if this is a multi-select (array reference) or single select
  const isMultiSelect = field?.type === FieldType.Array && !!field?.subReference

  // Get the referenced collection name
  const referencedCollection = isMultiSelect
    ? field?.subReference
    : field?.reference || field?.referenceCollection

  const { currentProjectSettings } = useProjectStore()

  // Get collections to find the collection path
  const { data: collections = [] } = useCollectionsQuery(
    projectPath,
    currentProjectSettings
  )
  const currentCollection = collections.find(
    c => c.name === referencedCollection
  )

  // Fetch files from the referenced collection (for regular glob-based collections)
  const { data: regularFiles, isLoading: isLoadingRegular } =
    useCollectionFilesQuery(
      projectPath,
      referencedCollection || '',
      currentCollection?.path || null
    )

  // Try file-based collection if not found in regular collections
  const { data: fileBasedFiles, isLoading: isLoadingFileBased } =
    useFileBasedCollectionQuery(
      projectPath,
      !currentCollection ? referencedCollection || null : null
    )

  // Use whichever query returned data
  const files = regularFiles || fileBasedFiles
  const isLoading = isLoadingRegular || isLoadingFileBased

  // Build options from collection files
  const options: ReferenceOption[] = React.useMemo(() => {
    if (!files) return []

    return files.map(file => {
      // Try common display fields in priority order
      // Don't search for "any string" - could grab description/bio
      const label =
        // Try frontmatter properties (works for both glob and file collections)
        (file.frontmatter?.title as string | undefined) ||
        (file.frontmatter?.name as string | undefined) ||
        (file.frontmatter?.slug as string | undefined) ||
        // Final fallbacks - FileEntry properties
        file.id || // ID always exists
        file.name || // Filename always exists
        'Untitled'

      return {
        value: file.id, // Always use ID for the value
        label,
      }
    })
  }, [files])

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

  // Get current selection label for single select
  const selectedOption = options.find(opt => opt.value === selectedValue)

  // Get selected options for multi-select
  const selectedOptions = selectedValues
    .map(val => options.find(opt => opt.value === val))
    .filter((opt): opt is ReferenceOption => !!opt)

  // Handle multi-select toggle
  const handleMultiSelectToggle = (optionValue: string) => {
    const newValues = selectedValues.includes(optionValue)
      ? selectedValues.filter(v => v !== optionValue)
      : [...selectedValues, optionValue]

    updateFrontmatterField(name, newValues.length > 0 ? newValues : undefined)
  }

  // Handle removing a selected item in multi-select
  const handleRemoveItem = (
    optionValue: string,
    e: React.MouseEvent | React.KeyboardEvent
  ) => {
    e.stopPropagation()
    const newValues = selectedValues.filter(v => v !== optionValue)
    updateFrontmatterField(name, newValues.length > 0 ? newValues : undefined)
  }

  return (
    <FieldWrapper
      label={label}
      required={required}
      description={
        field && 'description' in field ? field.description : undefined
      }
      defaultValue={field?.default}
      constraints={field?.constraints}
      currentValue={value}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              'w-full justify-between',
              isMultiSelect && 'h-auto min-h-10 py-2'
            )}
          >
            <div className="flex flex-1 flex-wrap gap-1">
              {isMultiSelect ? (
                selectedOptions.length > 0 ? (
                  selectedOptions.map(opt => (
                    <Badge
                      key={opt.value}
                      variant="secondary"
                      className="gap-1 pr-1"
                    >
                      {opt.label}
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
                        className="rounded-full outline-hidden ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer"
                        aria-label="Remove"
                      >
                        <X className="h-3 w-3" />
                        <span className="sr-only">Remove</span>
                      </span>
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground">
                    Select {label.toLowerCase()}...
                  </span>
                )
              ) : selectedOption ? (
                selectedOption.label
              ) : (
                <span className="text-muted-foreground">
                  Select {label.toLowerCase()}...
                </span>
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
          <Command>
            <CommandInput placeholder={`Search ${label.toLowerCase()}...`} />
            <CommandList>
              <CommandEmpty>
                {isLoading
                  ? 'Loading...'
                  : !currentCollection && !fileBasedFiles
                    ? `Collection "${referencedCollection}" not found`
                    : 'No items found.'}
              </CommandEmpty>
              <CommandGroup>
                {/* For single select, show None option */}
                {!isMultiSelect && (
                  <CommandItem
                    value={NONE_SENTINEL}
                    onSelect={() => {
                      updateFrontmatterField(name, undefined)
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
                        updateFrontmatterField(name, currentValue)
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
