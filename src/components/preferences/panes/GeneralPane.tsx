import React, { useCallback } from 'react'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldContent,
} from '@/components/ui/field'
import { usePreferences } from '../../../hooks/usePreferences'
import { useTheme } from '../../../lib/theme-provider'
import { useAvailableIdes } from '../../../hooks/useAvailableIdes'

const SettingsSection: React.FC<{
  title: string
  children: React.ReactNode
}> = ({ title, children }) => (
  <div className="space-y-4">
    <div>
      <h3 className="text-lg font-medium text-foreground">{title}</h3>
      <Separator className="mt-2" />
    </div>
    <FieldGroup>{children}</FieldGroup>
  </div>
)

export const GeneralPane: React.FC = () => {
  const { globalSettings, updateGlobal } = usePreferences()
  const { setTheme } = useTheme()
  const { data: availableIdes = [], isLoading: ideLoading } = useAvailableIdes()

  const handleIdeCommandChange = useCallback(
    (value: string) => {
      void updateGlobal({
        general: {
          ideCommand: value === 'none' ? '' : value,
          theme: globalSettings?.general?.theme || 'system',
          highlights: globalSettings?.general?.highlights || {
            nouns: true,
            verbs: true,
            adjectives: true,
            adverbs: true,
            conjunctions: true,
          },
          autoSaveDelay: globalSettings?.general?.autoSaveDelay || 2,
        },
        appearance: globalSettings?.appearance || {
          headingColor: {
            light: '#191919',
            dark: '#cccccc',
          },
        },
      })
    },
    [updateGlobal, globalSettings?.general, globalSettings?.appearance]
  )

  const handleThemeChange = useCallback(
    (value: 'light' | 'dark' | 'system') => {
      // Update the theme provider immediately for live preview
      setTheme(value)

      // Also save to global settings for persistence
      void updateGlobal({
        general: {
          ideCommand: globalSettings?.general?.ideCommand || '',
          theme: value,
          highlights: globalSettings?.general?.highlights || {
            nouns: true,
            verbs: true,
            adjectives: true,
            adverbs: true,
            conjunctions: true,
          },
          autoSaveDelay: globalSettings?.general?.autoSaveDelay || 2,
        },
        appearance: globalSettings?.appearance || {
          headingColor: {
            light: '#191919',
            dark: '#cccccc',
          },
        },
      })
    },
    [
      setTheme,
      updateGlobal,
      globalSettings?.general,
      globalSettings?.appearance,
    ]
  )

  const handleHeadingColorChange = useCallback(
    (mode: 'light' | 'dark', color: string) => {
      void updateGlobal({
        general: {
          ideCommand: globalSettings?.general?.ideCommand || '',
          theme: globalSettings?.general?.theme || 'system',
          highlights: globalSettings?.general?.highlights || {
            nouns: true,
            verbs: true,
            adjectives: true,
            adverbs: true,
            conjunctions: true,
          },
          autoSaveDelay: globalSettings?.general?.autoSaveDelay || 2,
        },
        appearance: {
          headingColor: {
            light: globalSettings?.appearance?.headingColor?.light || '#191919',
            dark: globalSettings?.appearance?.headingColor?.dark || '#cccccc',
            [mode]: color,
          },
        },
      })
    },
    [updateGlobal, globalSettings?.general, globalSettings?.appearance]
  )

  const handleResetHeadingColor = useCallback(
    (mode: 'light' | 'dark') => {
      const defaultColor = mode === 'light' ? '#191919' : '#cccccc'
      handleHeadingColorChange(mode, defaultColor)
    },
    [handleHeadingColorChange]
  )

  const handleAutoSaveDelayChange = useCallback(
    (value: string) => {
      void updateGlobal({
        general: {
          ideCommand: globalSettings?.general?.ideCommand || '',
          theme: globalSettings?.general?.theme || 'system',
          highlights: globalSettings?.general?.highlights || {
            nouns: true,
            verbs: true,
            adjectives: true,
            adverbs: true,
            conjunctions: true,
          },
          autoSaveDelay: parseInt(value, 10),
        },
        appearance: globalSettings?.appearance || {
          headingColor: {
            light: '#191919',
            dark: '#cccccc',
          },
        },
      })
    },
    [updateGlobal, globalSettings?.general, globalSettings?.appearance]
  )

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-muted/50 p-4 mb-6">
        <h2 className="text-base font-semibold mb-1">Global Settings</h2>
        <p className="text-sm text-muted-foreground">
          These settings apply across all projects and are stored globally on
          your system.
        </p>
      </div>

      <SettingsSection title="General">
        <Field>
          <FieldLabel>IDE Command</FieldLabel>
          <FieldContent>
            <Select
              value={globalSettings?.general?.ideCommand || 'none'}
              onValueChange={handleIdeCommandChange}
              disabled={ideLoading}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={ideLoading ? 'Loading...' : 'Select IDE'}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {availableIdes.map(ide => {
                  const labels: Record<string, string> = {
                    code: 'Visual Studio Code (code)',
                    cursor: 'Cursor (cursor)',
                    subl: 'Sublime Text (subl)',
                    vim: 'Vim (vim)',
                    nvim: 'Neovim (nvim)',
                    emacs: 'Emacs (emacs)',
                  }
                  return (
                    <SelectItem key={ide} value={ide}>
                      {labels[ide] || `${ide} (${ide})`}
                    </SelectItem>
                  )
                })}
                {availableIdes.length === 0 && !ideLoading && (
                  <SelectItem value="" disabled>
                    No IDEs detected
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            <FieldDescription>
              Choose your preferred IDE for opening files and projects
            </FieldDescription>
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel>Theme</FieldLabel>
          <FieldContent>
            <Select
              value={globalSettings?.general?.theme || 'system'}
              onValueChange={handleThemeChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
            <FieldDescription>
              Choose your preferred color theme
            </FieldDescription>
          </FieldContent>
        </Field>
      </SettingsSection>

      <SettingsSection title="Appearance">
        <Field>
          <FieldLabel>Heading Color (Light Mode)</FieldLabel>
          <FieldContent>
            <div className="flex items-center gap-2 w-fit">
              <input
                type="color"
                value={
                  globalSettings?.appearance?.headingColor?.light || '#191919'
                }
                onChange={e =>
                  handleHeadingColorChange('light', e.target.value)
                }
                className="w-20 h-9 cursor-pointer rounded-md border border-input bg-transparent"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleResetHeadingColor('light')}
              >
                Reset
              </Button>
            </div>
            <FieldDescription>
              Choose the color for markdown headings in light mode
            </FieldDescription>
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel>Heading Color (Dark Mode)</FieldLabel>
          <FieldContent>
            <div className="flex items-center gap-2 w-fit">
              <input
                type="color"
                value={
                  globalSettings?.appearance?.headingColor?.dark || '#cccccc'
                }
                onChange={e => handleHeadingColorChange('dark', e.target.value)}
                className="w-20 h-9 cursor-pointer rounded-md border border-input bg-transparent"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleResetHeadingColor('dark')}
              >
                Reset
              </Button>
            </div>
            <FieldDescription>
              Choose the color for markdown headings in dark mode
            </FieldDescription>
          </FieldContent>
        </Field>
      </SettingsSection>

      <SettingsSection title="Editor">
        <Field>
          <FieldLabel>Auto Save Delay</FieldLabel>
          <FieldContent>
            <Select
              value={String(globalSettings?.general?.autoSaveDelay || 2)}
              onValueChange={handleAutoSaveDelayChange}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 second</SelectItem>
                <SelectItem value="2">2 seconds</SelectItem>
                <SelectItem value="5">5 seconds</SelectItem>
                <SelectItem value="10">10 seconds</SelectItem>
              </SelectContent>
            </Select>
            <FieldDescription>
              Time in seconds before auto-saving changes
            </FieldDescription>
          </FieldContent>
        </Field>
      </SettingsSection>
    </div>
  )
}
