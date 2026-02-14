import React, { useState } from 'react'
import { Input } from '@/components/ui/input'

interface PreferencesTextInputProps extends Omit<
  React.ComponentProps<typeof Input>,
  'value' | 'onChange'
> {
  value: string
  onCommit: (value: string) => void
}

/**
 * Text input for preferences that maintains local state during typing
 * and only commits to the store on blur.
 *
 * This prevents cursor jumping caused by async store updates (disk writes).
 * Uses React's "adjusting state during render" pattern to sync from store
 * when external changes occur.
 */
export const PreferencesTextInput: React.FC<PreferencesTextInputProps> = ({
  value: storeValue,
  onCommit,
  ...inputProps
}) => {
  const [localValue, setLocalValue] = useState(storeValue)
  const [prevStoreValue, setPrevStoreValue] = useState(storeValue)

  // Sync from store when it changes externally (e.g., initial load, reset)
  if (storeValue !== prevStoreValue) {
    setPrevStoreValue(storeValue)
    setLocalValue(storeValue)
  }

  const commitIfChanged = () => {
    if (localValue !== storeValue) {
      onCommit(localValue)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitIfChanged()
      e.currentTarget.blur()
    }
  }

  return (
    <Input
      {...inputProps}
      value={localValue}
      onChange={e => setLocalValue(e.target.value)}
      onBlur={commitIfChanged}
      onKeyDown={handleKeyDown}
    />
  )
}
