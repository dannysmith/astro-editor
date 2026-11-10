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
import { DocsLink } from '../DocsLink'
import { DOCS_URLS } from '../../../lib/docs-urls'
// Matches `HeadingColor::default` in src-tauri/src/models/preferences.rs
const DEFAULT_HEADING_COLOR = { light: '#191919', dark: '#cccccc' }

const THEME_ITEMS = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
] as const

const FILE_TYPE_ITEMS = [
  { value: 'md', label: 'Markdown (.md)' },
  { value: 'mdx', label: 'MDX (.mdx)' },
] as const

const AUTO_SAVE_DELAY_ITEMS = [
  { value: '1', label: '1 second' },
  { value: '2', label: '2 seconds' },
  { value: '5', label: '5 seconds' },
  { value: '10', label: '10 seconds' },
]

export const GeneralPane: React.FC = () => {
  const { globalSettings, updateGlobal } = usePreferences()
  const { setTheme } = useTheme()
  // Inputs use htmlFor; select triggers are buttons, which htmlFor would click,
  // so they name themselves with aria-labelledby
  const id = React.useId()

  const handleThemeChange = useCallback(
    (value: 'light' | 'dark' | 'system' | null) => {
      if (!value) return
      setTheme(value)
      void updateGlobal({ general: { theme: value } })
    },
    [setTheme, updateGlobal]
  )

  const handleDefaultFileTypeChange = useCallback(
    (value: 'md' | 'mdx' | null) => {
      if (!value) return
      void updateGlobal({ general: { defaultFileType: value } })
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
      handleHeadingColorChange(mode, DEFAULT_HEADING_COLOR[mode])
    },
    [handleHeadingColorChange]
  )

  const handleAutoSaveDelayChange = useCallback(
    (value: string | null) => {
      if (!value) return
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
      <div className="mb-6 rounded-lg border bg-muted/50 p-4">
        <h2 className="mb-1 text-base font-semibold text-heading">
          Global Preferences
        </h2>
        <p className="text-sm text-muted-foreground">
          These apply to every project. A project's own settings are in Project
          Settings.
        </p>
      </div>

      <SettingsSection title="General">
        <Field>
          <FieldLabel htmlFor={`${id}-ide`}>IDE command</FieldLabel>
          <FieldContent>
            <PreferencesTextInput
              id={`${id}-ide`}
              value={globalSettings?.general?.ideCommand ?? ''}
              onCommit={value =>
                void updateGlobal({ general: { ideCommand: value } })
              }
              placeholder="code"
              className="max-w-md"
            />
            <FieldDescription>
              The command that opens your code editor, like <code>code</code> or{' '}
              <code>cursor</code>, or its full path, like{' '}
              <code>/usr/local/bin/nvim</code>.{' '}
              <DocsLink href={DOCS_URLS.ideIntegration}>Learn more</DocsLink>
            </FieldDescription>
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel id={`${id}-theme`}>Theme</FieldLabel>
          <FieldContent>
            <Select
              items={THEME_ITEMS}
              value={globalSettings?.general?.theme || 'system'}
              onValueChange={handleThemeChange}
            >
              <SelectTrigger aria-labelledby={`${id}-theme`}>
                <SelectValue placeholder="Select theme" />
              </SelectTrigger>
              <SelectContent>
                {THEME_ITEMS.map(item => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>
              System follows your Mac's appearance.
            </FieldDescription>
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel id={`${id}-file-type`}>New file type</FieldLabel>
          <FieldContent>
            <Select
              items={FILE_TYPE_ITEMS}
              value={globalSettings?.general?.defaultFileType || 'md'}
              onValueChange={handleDefaultFileTypeChange}
            >
              <SelectTrigger aria-labelledby={`${id}-file-type`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FILE_TYPE_ITEMS.map(item => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>
              For new files in every project. A project or collection can set
              its own in Project Settings.
            </FieldDescription>
          </FieldContent>
        </Field>
      </SettingsSection>

      <SettingsSection title="Appearance">
        <Field>
          <FieldLabel htmlFor={`${id}-heading-light`}>
            Heading colour in light mode
          </FieldLabel>
          <FieldContent>
            <div className="flex w-fit items-center gap-2">
              <input
                id={`${id}-heading-light`}
                type="color"
                value={
                  globalSettings?.appearance?.headingColor?.light ||
                  DEFAULT_HEADING_COLOR.light
                }
                onChange={e =>
                  handleHeadingColorChange('light', e.target.value)
                }
                className="h-9 w-20 cursor-pointer rounded-md border border-input bg-transparent"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleResetHeadingColor('light')}
              >
                Reset
              </Button>
            </div>{' '}
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel htmlFor={`${id}-heading-dark`}>
            Heading colour in dark mode
          </FieldLabel>
          <FieldContent>
            <div className="flex w-fit items-center gap-2">
              <input
                id={`${id}-heading-dark`}
                type="color"
                value={
                  globalSettings?.appearance?.headingColor?.dark ||
                  DEFAULT_HEADING_COLOR.dark
                }
                onChange={e => handleHeadingColorChange('dark', e.target.value)}
                className="h-9 w-20 cursor-pointer rounded-md border border-input bg-transparent"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleResetHeadingColor('dark')}
              >
                Reset
              </Button>
            </div>{' '}
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel htmlFor={`${id}-font-size`}>Editor font size</FieldLabel>
          <FieldContent>
            <div className="flex w-fit items-center gap-2">
              <Input
                id={`${id}-font-size`}
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
              The size of text in the editor. 18 by default.
            </FieldDescription>
          </FieldContent>
        </Field>
      </SettingsSection>

      <SettingsSection title="Editor">
        <Field>
          <FieldLabel id={`${id}-auto-save`}>Auto-save delay</FieldLabel>
          <FieldContent>
            <Select
              items={AUTO_SAVE_DELAY_ITEMS}
              value={String(globalSettings?.general?.autoSaveDelay || 2)}
              onValueChange={handleAutoSaveDelayChange}
            >
              <SelectTrigger aria-labelledby={`${id}-auto-save`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUTO_SAVE_DELAY_ITEMS.map(item => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>
              How long after you stop typing the file is saved. While you type,
              it's also saved every 10 seconds.
            </FieldDescription>
          </FieldContent>
        </Field>
      </SettingsSection>
    </div>
  )
}
