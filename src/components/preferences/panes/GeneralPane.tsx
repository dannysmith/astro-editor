import React, { useCallback } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldContent,
} from '@/components/ui/field'
import { usePreferences } from '../../../hooks/usePreferences'
import { useTheme } from '../../../lib/theme-provider'
import { SettingsSection } from '../SettingsSection'
import { PreferencesTextInput } from '../PreferencesTextInput'

export const GeneralPane: React.FC = () => {
  const { globalSettings, updateGlobal } = usePreferences()
  const { setTheme } = useTheme()

  const handleThemeChange = useCallback(
    (value: 'light' | 'dark' | 'system') => {
      setTheme(value)
      void updateGlobal({ general: { theme: value } })
    },
    [setTheme, updateGlobal]
  )

  const handleDefaultFileTypeChange = useCallback(
    (value: string) => {
      void updateGlobal({ general: { defaultFileType: value as 'md' | 'mdx' } })
    },
    [updateGlobal]
  )

  const handleHeadingColorChange = useCallback(
    (mode: 'light' | 'dark', color: string) => {
      void updateGlobal({ appearance: { headingColor: { [mode]: color } } })
    },
    [updateGlobal]
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
      void updateGlobal({ general: { autoSaveDelay: parseInt(value, 10) } })
    },
    [updateGlobal]
  )

  const DEFAULT_EDITOR_BASE_FONT_SIZE = 18

  const handleEditorBaseFontSizeChange = useCallback(
    (value: string) => {
      const parsed = parseInt(value, 10)
      if (isNaN(parsed)) return
      const size = Math.max(1, Math.min(30, parsed))
      void updateGlobal({ appearance: { editorBaseFontSize: size } })
    },
    [updateGlobal]
  )

  const handleResetEditorBaseFontSize = useCallback(() => {
    handleEditorBaseFontSizeChange(String(DEFAULT_EDITOR_BASE_FONT_SIZE))
  }, [handleEditorBaseFontSizeChange])

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-muted/50 p-4 mb-6">
        <h2 className="text-base font-semibold mb-1 text-heading">
          Global Settings
        </h2>
        <p className="text-sm text-muted-foreground">
          These settings apply across all projects and are stored globally on
          your system.
        </p>
      </div>

      <SettingsSection title="General">
        <Field>
          <FieldLabel>IDE Command</FieldLabel>
          <FieldContent>
            <PreferencesTextInput
              value={globalSettings?.general?.ideCommand ?? ''}
              onCommit={value =>
                void updateGlobal({ general: { ideCommand: value } })
              }
              placeholder="e.g., code, cursor, /usr/local/bin/nvim"
              className="max-w-md"
            />
            <FieldDescription>
              The command to launch your editor. Use <code>code</code> or{' '}
              <code>cursor</code> if installed in a standard location, or
              provide the full path (e.g., <code>/usr/local/bin/nvim</code>).
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

        <Field>
          <FieldLabel>Default File Type for New Files</FieldLabel>
          <FieldContent>
            <Select
              value={globalSettings?.general?.defaultFileType || 'md'}
              onValueChange={handleDefaultFileTypeChange}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="md">Markdown (.md)</SelectItem>
                <SelectItem value="mdx">MDX (.mdx)</SelectItem>
              </SelectContent>
            </Select>
            <FieldDescription>
              File type used when creating new files across all projects
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

        <Field>
          <FieldLabel>Editor Font Size</FieldLabel>
          <FieldContent>
            <div className="flex items-center gap-2 w-fit">
              <Input
                type="number"
                min={1}
                max={30}
                value={
                  globalSettings?.appearance?.editorBaseFontSize ??
                  DEFAULT_EDITOR_BASE_FONT_SIZE
                }
                onChange={e => handleEditorBaseFontSizeChange(e.target.value)}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">px</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetEditorBaseFontSize}
              >
                Reset
              </Button>
            </div>
            <FieldDescription>
              Base font size for editor text (default: 18)
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
