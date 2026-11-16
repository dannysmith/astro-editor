import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useHarperStore } from '../../store/harperStore'
import { useProjectStore } from '../../store/projectStore'
import {
  HARPER_CHECKS,
  readCopyedit,
  setCheck,
  type HarperCheck,
} from '../../lib/editor/extensions/harper'
import { FieldLabel } from '../ui/field'
import { Spinner } from '../ui/spinner'
import { Switch } from '../ui/switch'

/** Each check's colour, matching its underline in the editor */
export const CHECK_COLOURS: Record<HarperCheck, string> = {
  spelling: 'bg-(--editor-color-red)',
  grammar: 'bg-(--editor-color-blue)',
  style: 'bg-(--editor-color-green)',
}

/**
 * The Copyedit tab's switches for Harper's checks. They're global settings;
 * the dialect and dictionary are in Preferences.
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
            onCheckedChange={on => setCheck(check, on)}
          />
        </div>
      ))}
    </section>
  )
}
