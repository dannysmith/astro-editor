import React from 'react'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import type { MdxComponent } from '@/types'
import { cn } from '@/lib/utils'
import { Button } from '../ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../ui/collapsible'
import { CommandShortcut } from '../ui/command'
import { Switch } from '../ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { FormField } from './FormField'
import {
  snippetInput,
  useComponentBuilderStore,
  type ClientDirective,
} from '../../store/componentBuilderStore'
import { buildPreview, insertsAsBlock } from '../../lib/editor/snippet-builder'
import { isOnEmptyLine } from '../../lib/editor/commands/insertSnippet'
import { FrameworkBadge } from './FrameworkBadge'
import { PropField } from './PropField'

/** The tag preview and the import line */
const codeBoxClassName =
  'block rounded bg-muted px-2 py-1.5 text-xs wrap-break-word whitespace-pre-wrap'

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
  const images = useComponentBuilderStore(state => state.images)
  const addImport = useComponentBuilderStore(state => state.addImport)
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
  const snippet = snippetInput(component, values, images, addImport)

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
        <code className={codeBoxClassName}>
          {buildPreview(
            snippet.component,
            snippet.values,
            clientDirective,
            block
          )}
        </code>
      </div>

      <ImportRow />

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

/**
 * Whether Insert adds imports for the component and its images, with a switch
 * to leave them out, or that the component is already imported. Expands to
 * show the lines. Hidden when there's no plan: the setting is off, or no
 * import could be worked out safely.
 */
function ImportRow() {
  const plan = useComponentBuilderStore(state => state.importPlan)
  const addImport = useComponentBuilderStore(state => state.addImport)
  const setAddImport = useComponentBuilderStore(state => state.setAddImport)
  if (!plan || (plan.added.length === 0 && !plan.existing)) return null

  const adds = plan.added.length > 0
  const label = adds
    ? plan.added.length > 1
      ? 'Add imports'
      : 'Add import'
    : 'Already imported'
  return (
    <Collapsible className="border-t px-4 py-2">
      <div className="flex min-h-7 items-center justify-between gap-2">
        <CollapsibleTrigger className="group flex items-center gap-1.5 rounded-sm text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
          <ChevronRight className="size-3.5 text-icon transition-transform group-data-panel-open:rotate-90" />
          {label}
        </CollapsibleTrigger>
        {adds && (
          <Switch
            checked={addImport}
            onCheckedChange={setAddImport}
            aria-label={label}
          />
        )}
      </div>
      <CollapsibleContent className="flex flex-col gap-1.5 py-1">
        {adds && (
          <code
            className={cn(
              codeBoxClassName,
              !addImport && 'text-muted-foreground'
            )}
          >
            {plan.added.join('\n')}
          </code>
        )}
        {/* The import that already has the component's name, labelled when
            there are imports to add above it */}
        {plan.existing && (
          <>
            {adds && (
              <span className="text-xs text-muted-foreground">
                Already imported
              </span>
            )}
            <code className={cn(codeBoxClassName, 'text-muted-foreground')}>
              {plan.existing}
            </code>
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
