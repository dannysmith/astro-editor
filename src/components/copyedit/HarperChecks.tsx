import React from 'react'
import { useHarperStore } from '../../store/harperStore'
import {
  HARPER_CHECKS,
  HARPER_DIALECTS,
  type HarperCheck,
  type HarperDialect,
} from '../../lib/editor/extensions/harper'
import { FieldLabel } from '../ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { Spinner } from '../ui/spinner'
import { Switch } from '../ui/switch'

/** Each check's colour, matching its underline in the editor */
export const CHECK_COLOURS: Record<HarperCheck, string> = {
  spelling: 'bg-(--editor-color-red)',
  grammar: 'bg-(--editor-color-blue)',
  style: 'bg-(--editor-color-green)',
}

const DIALECT_ITEMS = HARPER_DIALECTS.map(dialect => ({
  value: dialect,
  label: `${dialect} English`,
}))

/** The Copyedit tab's switches for Harper's checks, and its dialect */
export const HarperChecks: React.FC = () => {
  const checks = useHarperStore(state => state.checks)
  const dialect = useHarperStore(state => state.dialect)
  const status = useHarperStore(state => state.status)
  const id = React.useId()

  return (
    <section className="space-y-3">
      {status === 'loading' && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Spinner className="size-3" /> Starting Harper
        </p>
      )}
      {status === 'error' && (
        <p className="text-xs text-destructive">Harper didn’t start</p>
      )}
      {HARPER_CHECKS.map(({ id: check, label }) => (
        <div key={check} className="flex items-center justify-between gap-3">
          <FieldLabel
            htmlFor={`${id}-${check}`}
            className="flex items-center gap-2"
          >
            <span className={`size-2 rounded-full ${CHECK_COLOURS[check]}`} />
            {label}
          </FieldLabel>
          <Switch
            id={`${id}-${check}`}
            checked={checks[check]}
            onCheckedChange={on =>
              useHarperStore.getState().setCheck(check, on)
            }
          />
        </div>
      ))}
      <Select
        items={DIALECT_ITEMS}
        value={dialect}
        onValueChange={(value: HarperDialect | null) => {
          if (value) useHarperStore.getState().setDialect(value)
        }}
      >
        <SelectTrigger size="sm" className="w-full" aria-label="Dialect">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DIALECT_ITEMS.map(item => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </section>
  )
}
