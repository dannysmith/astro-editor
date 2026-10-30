import React from 'react'
import { ArrowLeft } from 'lucide-react'
import type { MdxComponent } from '@/types'
import { Button } from '../ui/button'
import { CommandShortcut } from '../ui/command'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { FormField } from './FormField'
import {
  useComponentBuilderStore,
  type ClientDirective,
} from '../../store/componentBuilderStore'
import { buildPreview, insertsAsBlock } from '../../lib/editor/snippet-builder'
import { isOnEmptyLine } from '../../lib/editor/commands/insertSnippet'
import { FrameworkBadge } from './FrameworkBadge'
import { PropField } from './PropField'

const clientDirectiveOptions: { value: ClientDirective; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'client:idle', label: 'client:idle (recommended)' },
  { value: 'client:load', label: 'client:load' },
  { value: 'client:visible', label: 'client:visible' },
  { value: 'client:media', label: 'client:media' },
  { value: 'client:only', label: 'client:only' },
]

/**
 * The component builder's second step: a field for each of the component's
 * props, a live preview of the tag, and Insert. Cmd+Enter inserts; Escape
 * (handled by the dialog) goes back to the component list.
 */
export function ComponentForm({ component }: { component: MdxComponent }) {
  const values = useComponentBuilderStore(state => state.values)
  const clientDirective = useComponentBuilderStore(
    state => state.clientDirective
  )
  const setClientDirective = useComponentBuilderStore(
    state => state.setClientDirective
  )
  const insert = useComponentBuilderStore(state => state.insert)
  const back = useComponentBuilderStore(state => state.back)
  const fieldsRef = React.useRef<HTMLDivElement>(null)
  const insertRef = React.useRef<HTMLButtonElement>(null)
  const directiveLabelId = `${React.useId()}-label`

  // Start in the first field, or on Insert when there are none. The list's
  // search input, which had focus, is gone.
  React.useEffect(() => {
    const target =
      fieldsRef.current?.querySelector<HTMLElement>(
        'input, textarea, button'
      ) ?? insertRef.current
    target?.focus()
  }, [component])

  const isFrameworkComponent = component.framework !== 'astro'
  // Matches how insert() will lay the component out at the cursor
  const editorView = useComponentBuilderStore(state => state.editorView)
  const block = insertsAsBlock(
    component,
    editorView ? isOnEmptyLine(editorView) : false
  )

  return (
    <div
      className="flex max-h-[80vh] flex-col"
      onKeyDown={e => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault()
          insert()
        }
      }}
    >
      <div className="flex items-start gap-2 border-b py-3 pr-12 pl-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={back}
          aria-label="Back to components"
        >
          <ArrowLeft />
        </Button>
        <div className="flex min-w-0 flex-1 flex-col gap-1 pt-1.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm">&lt;{component.name}&gt;</span>
            <FrameworkBadge framework={component.framework} />
          </div>
          {component.description && (
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {component.description}
            </p>
          )}
        </div>
      </div>

      <div
        ref={fieldsRef}
        className="flex min-h-0 flex-col gap-4 overflow-y-auto px-4 py-4"
      >
        {component.props.length === 0 && (
          <p className="text-sm text-muted-foreground">
            This component has no props.
          </p>
        )}
        {component.props.map(prop => (
          <PropField key={prop.name} prop={prop} />
        ))}
        {isFrameworkComponent && (
          <FormField
            label="Client directive"
            labelId={directiveLabelId}
            description="When the component's JavaScript loads in the browser"
          >
            <Select
              items={clientDirectiveOptions}
              value={clientDirective}
              onValueChange={value => value && setClientDirective(value)}
            >
              <SelectTrigger
                aria-labelledby={directiveLabelId}
                className="w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {clientDirectiveOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        )}
      </div>

      <div className="border-t px-4 py-3">
        <code className="block rounded bg-muted px-2 py-1.5 text-xs wrap-break-word whitespace-pre-wrap">
          {buildPreview(component, values, clientDirective, block)}
        </code>
      </div>

      <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
        <div className="flex gap-3">
          <span>
            <CommandShortcut>⌘↵</CommandShortcut> Insert
          </span>
          <span>
            <CommandShortcut>esc</CommandShortcut> Back
          </span>
        </div>
        <Button ref={insertRef} size="sm" onClick={insert}>
          Insert
        </Button>
      </div>
    </div>
  )
}
