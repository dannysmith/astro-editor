import React from 'react'
import { Check, ArrowLeft } from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '../ui/command'
import { Badge } from '../ui/badge'
import { cn } from '../../lib/utils'
import { useComponentBuilderStore } from '../../store/componentBuilderStore'
import { useMdxComponentsQuery } from '../../hooks/queries/useMdxComponentsQuery'
import { useProjectStore } from '../../store/projectStore'
import { useEffectiveSettings } from '../../lib/project-registry/effective-settings'
import { useHotkeys } from 'react-hotkeys-hook'

/**
 * MDX Component Builder Dialog
 * Allows users to select and configure MDX components for insertion into the editor
 */
export function ComponentBuilderDialog() {
  const { projectPath } = useProjectStore()
  const { pathOverrides } = useEffectiveSettings()
  const {
    isOpen,
    step,
    selectedComponent,
    enabledProps,
    propSearchQuery,
    close,
    selectComponent,
    toggleProp,
    insert,
    back,
    setPropSearchQuery,
  } = useComponentBuilderStore()

  // Fetch MDX components using TanStack Query with effective settings
  const { data: components = [], isLoading } = useMdxComponentsQuery(
    projectPath,
    pathOverrides.mdxComponentsDirectory
  )

  // Custom filter function that only searches component names and descriptions
  const customFilter = React.useCallback((value: string, search: string) => {
    // Extract the label from the value
    const label = value.toLowerCase()

    // Case-insensitive search
    if (label.includes(search.toLowerCase())) {
      return 1
    }
    return 0
  }, [])

  // Keyboard shortcuts for configuration step
  useHotkeys(
    'backspace',
    () => {
      if (step === 'configure') {
        back()
      }
    },
    {
      enabled: isOpen && step === 'configure' && propSearchQuery === '',
      preventDefault: true,
    }
  )

  // Cmd+A to toggle all optional props
  useHotkeys(
    'mod+a',
    () => {
      if (step === 'configure' && selectedComponent) {
        const optionalProps = selectedComponent.props.filter(
          prop => prop.is_optional
        )
        const allOptionalEnabled = optionalProps.every(prop =>
          enabledProps.has(prop.name)
        )

        // If all optional props are enabled, disable them all
        // Otherwise, enable all optional props
        optionalProps.forEach(prop => {
          if (allOptionalEnabled && enabledProps.has(prop.name)) {
            toggleProp(prop.name)
          } else if (!allOptionalEnabled && !enabledProps.has(prop.name)) {
            toggleProp(prop.name)
          }
        })
      }
    },
    {
      enabled: isOpen && step === 'configure',
      preventDefault: true,
    }
  )

  // Handle keyboard shortcuts in CommandItems
  const handleCommandItemKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      // Cmd+Enter to insert
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        e.stopPropagation()
        insert()
        return
      }

      // Cmd+A to toggle all optional props
      if (e.key === 'a' && (e.metaKey || e.ctrlKey) && selectedComponent) {
        e.preventDefault()
        e.stopPropagation()

        const optionalProps = selectedComponent.props.filter(
          prop => prop.is_optional
        )
        const allOptionalEnabled = optionalProps.every(prop =>
          enabledProps.has(prop.name)
        )

        optionalProps.forEach(prop => {
          if (allOptionalEnabled && enabledProps.has(prop.name)) {
            toggleProp(prop.name)
          } else if (!allOptionalEnabled && !enabledProps.has(prop.name)) {
            toggleProp(prop.name)
          }
        })
      }
    },
    [insert, selectedComponent, enabledProps, toggleProp]
  )

  // Filter props based on search query
  const filteredProps = React.useMemo(() => {
    if (!selectedComponent) return { required: [], optional: [] }

    const filtered = selectedComponent.props.filter(
      prop =>
        prop.name.toLowerCase().includes(propSearchQuery.toLowerCase()) ||
        prop.prop_type.toLowerCase().includes(propSearchQuery.toLowerCase())
    )

    return {
      required: filtered.filter(prop => !prop.is_optional),
      optional: filtered.filter(prop => prop.is_optional),
    }
  }, [selectedComponent, propSearchQuery])

  // Generate preview of what will be inserted
  const generatePreview = React.useCallback(() => {
    if (!selectedComponent) return ''

    const propsString = selectedComponent.props
      .filter(prop => enabledProps.has(prop.name))
      .map(prop => `${prop.name}=""`)
      .join(' ')

    if (selectedComponent.has_slot) {
      return `<${selectedComponent.name}${propsString ? ' ' + propsString : ''}></${selectedComponent.name}>`
    }
    return `<${selectedComponent.name}${propsString ? ' ' + propsString : ''} />`
  }, [selectedComponent, enabledProps])

  return (
    <CommandDialog
      open={isOpen}
      onOpenChange={close}
      title="Insert MDX Component"
      description="Select a component to insert"
      filter={customFilter}
    >
      {step === 'list' && (
        <>
          <CommandInput placeholder="Search components..." />
          <CommandList>
            {isLoading ? (
              <CommandEmpty>Loading components...</CommandEmpty>
            ) : components.length === 0 ? (
              <CommandEmpty>
                No MDX components found in this project.
              </CommandEmpty>
            ) : (
              <>
                <CommandEmpty>No results found.</CommandEmpty>
                <CommandGroup>
                  {components.map(component => (
                    <CommandItem
                      key={component.name}
                      value={component.name}
                      onSelect={() => selectComponent(component)}
                      className="cursor-pointer"
                    >
                      <div className="flex flex-col">
                        <span>{component.name}</span>
                        {component.description && (
                          <span className="text-xs text-muted-foreground">
                            {component.description}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {component.props.length} props
                          {component.has_slot && ' + slot'}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </>
      )}
      {step === 'configure' && selectedComponent && (
        <>
          <div className="flex items-center gap-2 px-3 pb-2 pt-3 text-sm text-muted-foreground">
            <ArrowLeft className="h-3 w-3" />
            <span>Configure &lt;{selectedComponent?.name} /&gt;</span>
          </div>
          <CommandInput
            placeholder="Filter props..."
            value={propSearchQuery}
            onValueChange={setPropSearchQuery}
            onKeyDown={handleCommandItemKeyDown}
            autoFocus
          />
          <CommandList>
            {filteredProps.required.length === 0 &&
            filteredProps.optional.length === 0 ? (
              <CommandEmpty>No props match</CommandEmpty>
            ) : (
              <>
                {filteredProps.required.length > 0 && (
                  <CommandGroup>
                    {filteredProps.required.map(prop => (
                      <CommandItem
                        key={prop.name}
                        value={prop.name}
                        onSelect={() => toggleProp(prop.name)}
                        onKeyDown={handleCommandItemKeyDown}
                        disabled={!prop.is_optional}
                        className={cn(
                          'cursor-pointer',
                          !prop.is_optional && 'opacity-60'
                        )}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            enabledProps.has(prop.name)
                              ? 'opacity-100'
                              : 'opacity-0'
                          )}
                        />
                        <span className="flex-1">{prop.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {prop.prop_type}
                        </span>
                        <Badge variant="secondary" className="ml-2">
                          Required
                        </Badge>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {filteredProps.optional.length > 0 && (
                  <CommandGroup>
                    {filteredProps.optional.map(prop => (
                      <CommandItem
                        key={prop.name}
                        value={prop.name}
                        onSelect={() => toggleProp(prop.name)}
                        onKeyDown={handleCommandItemKeyDown}
                        className="cursor-pointer"
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            enabledProps.has(prop.name)
                              ? 'opacity-100'
                              : 'opacity-0'
                          )}
                        />
                        <span className="flex-1">{prop.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {prop.prop_type}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </>
            )}
          </CommandList>

          {/* Preview section */}
          <div className="border-t px-3 py-3">
            <div className="text-xs text-muted-foreground mb-1">Preview:</div>
            <code className="text-xs block bg-muted px-2 py-1 rounded">
              {generatePreview()}
            </code>
          </div>

          {/* Keyboard shortcuts */}
          <div className="border-t px-3 py-2 flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex gap-3">
              <span>
                <CommandShortcut>⌘↵</CommandShortcut> Insert
              </span>
              {filteredProps.optional.length > 0 && (
                <span>
                  <CommandShortcut>⌘A</CommandShortcut> Toggle all
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </CommandDialog>
  )
}
