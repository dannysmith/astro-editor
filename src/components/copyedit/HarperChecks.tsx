import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useHarperStore } from '../../store/harperStore'
import { useProjectStore } from '../../store/projectStore'
import {
  CHECK_COLOURS,
  HARPER_CHECKS,
  readCopyedit,
  setCheck,
} from '../../lib/editor/extensions/harper'
import { FieldLabel } from '../ui/field'
import { Spinner } from '../ui/spinner'
import { Switch } from '../ui/switch'

/**
 * The Copyedit tab's switches for Harper's checks, each with a dot in the
 * colour its issues are shown in. They're global settings; the dialect and
 * dictionary are in Preferences.
 */
export const HarperChecks: React.FC = () => {
  const checks = useProjectStore(
    useShallow(state => readCopyedit(state.globalSettings).checks)
  )
  const status = useHarperStore(state => state.status)
  const id = React.useId()

  return (
    <section className="space-y-3">
      {status === 'loading' && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Spinner className="size-3" /> Starting checks…
        </p>
      )}
      {status === 'error' && (
        <p className="text-xs text-destructive">
          Checks couldn’t run. Switch a check off and on to try again.
        </p>
      )}
      {HARPER_CHECKS.map(({ id: check, label }) => (
        <div key={check} className="flex items-center justify-between gap-3">
          <FieldLabel
            htmlFor={`${id}-${check}`}
            className="flex items-center gap-2"
          >
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: CHECK_COLOURS[check] }}
            />
            {label}
          </FieldLabel>
          <Switch
            id={`${id}-${check}`}
            checked={checks[check]}
            onCheckedChange={on => setCheck(check, on)}
          />
        </div>
      ))}
    </section>
  )
}
