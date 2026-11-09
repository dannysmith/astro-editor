import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { todayIsoDate } from '../../lib/dates'
import {
  FILE_NAME_PATTERN_PRESETS,
  fileNameStem,
  parseFileNamePattern,
  patternHasTitle,
} from '../../lib/files/file-name-pattern'
import { ProblemNote, WithCode } from './Problems'

const EXAMPLE_TITLE = 'My Trip to the Lake'

/**
 * A collection's file name pattern: typed, or one of the presets, with
 * examples of the names it gives as you type. It's saved on blur, Enter or a
 * preset, and only when it's valid; emptied, it's unset.
 */
export function FileNamePatternInput({
  id,
  value,
  fileName,
  onChange,
}: {
  id: string
  value: string
  /** A file's full name, relative to its folder, from a name */
  fileName: (stem: string) => string
  onChange: (pattern: string | undefined) => void
}) {
  const [pattern, setPattern] = useState(value)
  const [prevValue, setPrevValue] = useState(value)
  const [date] = useState(() => new Date())
  if (value !== prevValue) {
    setPrevValue(value)
    setPattern(value)
  }

  const parsed = parseFileNamePattern(pattern)
  const commit = (next: string) => {
    if (!next.trim()) onChange(undefined)
    else if (next !== value && 'parts' in parseFileNamePattern(next)) {
      onChange(next)
    }
  }

  const untitled = fileNameStem(pattern, { title: '', date }) || todayIsoDate()
  const titled = fileNameStem(pattern, { title: EXAMPLE_TITLE, date })

  return (
    <div className="space-y-2">
      <Input
        id={id}
        value={pattern}
        spellCheck={false}
        aria-invalid={pattern.trim() !== '' && 'error' in parsed}
        onChange={e => setPattern(e.target.value)}
        onBlur={() => commit(pattern)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            commit(pattern)
            e.currentTarget.blur()
          }
        }}
      />
      <div className="flex flex-wrap gap-2">
        {FILE_NAME_PATTERN_PRESETS.map(preset => (
          <Button
            key={preset.pattern}
            variant={preset.pattern === pattern ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => {
              setPattern(preset.pattern)
              commit(preset.pattern)
            }}
          >
            {preset.label}
          </Button>
        ))}
      </div>
      {'error' in parsed ? (
        pattern.trim() !== '' && (
          <ProblemNote problem={{ level: 'error', message: parsed.error }} />
        )
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted-foreground">A new file</dt>
          <dd>
            <WithCode text={`\`${fileName(untitled)}\``} />
          </dd>
          {patternHasTitle(pattern) && (
            <>
              <dt className="text-muted-foreground">
                Titled “{EXAMPLE_TITLE}”
              </dt>
              <dd>
                <WithCode text={`\`${fileName(titled)}\``} />
              </dd>
            </>
          )}
        </dl>
      )}
    </div>
  )
}
