import {
  Command,
  commandDialogClassName,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../ui/command'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { useComponentBuilderStore } from '../../store/componentBuilderStore'
import { useMdxComponentsQuery } from '../../hooks/queries/useMdxComponentsQuery'
import { useProjectStore } from '../../store/projectStore'
import { useEffectiveSettings } from '../../hooks/settings/useEffectiveSettings'
import { ComponentForm } from './ComponentForm'
import { FrameworkBadge } from './FrameworkBadge'

/** Matches the search against component names only */
function filterByName(value: string, search: string) {
  return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
}

/**
 * MDX Component Builder Dialog
 * Pick a component, fill in its props, and insert it into the editor.
 * Escape on the form goes back to the list; on the list it closes.
 */
export function ComponentBuilderDialog() {
  const projectPath = useProjectStore(state => state.projectPath)
  const { pathOverrides } = useEffectiveSettings()
  const isOpen = useComponentBuilderStore(state => state.isOpen)
  const step = useComponentBuilderStore(state => state.step)
  const selectedComponent = useComponentBuilderStore(
    state => state.selectedComponent
  )
  const close = useComponentBuilderStore(state => state.close)
  const back = useComponentBuilderStore(state => state.back)
  const selectComponent = useComponentBuilderStore(
    state => state.selectComponent
  )

  const { data: components = [], isLoading } = useMdxComponentsQuery(
    projectPath,
    pathOverrides.mdxComponentsDirectory
  )

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open, details) => {
        if (open) return
        if (step === 'configure' && details.reason === 'escape-key') {
          back()
          return
        }
        close()
      }}
    >
      <DialogContent className="overflow-hidden p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Insert MDX Component</DialogTitle>
          <DialogDescription>
            Select a component and fill in its props
          </DialogDescription>
        </DialogHeader>

        {step === 'configure' && selectedComponent ? (
          <ComponentForm component={selectedComponent} />
        ) : (
          <Command className={commandDialogClassName} filter={filterByName}>
            <CommandInput placeholder="Search components..." autoFocus />
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
                        key={component.file_path}
                        value={component.name}
                        onSelect={() => selectComponent(component)}
                        className="cursor-pointer"
                      >
                        <div className="flex w-full items-center justify-between gap-2">
                          <div className="flex min-w-0 flex-col">
                            <span>{component.name}</span>
                            {component.description && (
                              <span className="truncate text-xs text-muted-foreground">
                                {component.description}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {component.props.length === 0
                                ? 'No props detected'
                                : `${component.props.length} props`}
                              {component.has_slot && ' + slot'}
                            </span>
                          </div>
                          <FrameworkBadge framework={component.framework} />
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        )}
      </DialogContent>
    </Dialog>
  )
}
