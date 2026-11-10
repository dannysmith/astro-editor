import React, { useState, useCallback, useEffect } from 'react'
import { commands } from '@/lib/bindings'
import { saveUnsavedEdits } from '@/lib/quit'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldContent,
} from '@/components/ui/field'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { getDiagnosticContext } from '../../../lib/diagnostics'
import { usePreferences } from '../../../hooks/usePreferences'
import { SettingsSection } from '../SettingsSection'
import { DocsLink } from '../DocsLink'
import { DOCS_URLS } from '../../../lib/docs-urls'

export const DebugPane: React.FC = () => {
  const [appVersion, setAppVersion] = useState<string>('...')
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [resetConfirmed, setResetConfirmed] = useState(false)
  const [resetting, setResetting] = useState(false)
  const { globalSettings } = usePreferences()

  // Derive preferences version directly from globalSettings
  const preferencesVersion = globalSettings?.version
    ? String(globalSettings.version)
    : '...'

  // Load diagnostic information on mount
  useEffect(() => {
    void getDiagnosticContext().then(context => {
      setAppVersion(context.appVersion)
    })
  }, [])

  const handleOpenPreferencesFolder = useCallback(() => {
    void (async () => {
      try {
        await commands.openPreferencesFolder()
      } catch {
        // Silent failure - user will see folder doesn't open
      }
    })()
  }, [])

  const handleResetAllPreferences = useCallback(() => {
    if (!resetConfirmed) {
      return
    }

    setResetting(true)
    void (async () => {
      // The reset restarts the app, so save first; a failed save has said why
      if (!(await saveUnsavedEdits())) {
        setResetting(false)
        return
      }
      try {
        await commands.resetAllPreferences()
        setResetDialogOpen(false)
        setResetConfirmed(false)
        // The app should reload automatically after reset
      } catch {
        // Reset failed - re-enable the button
        setResetting(false)
      }
    })()
  }, [resetConfirmed])

  return (
    <div className="space-y-6">
      <div className="mb-6 rounded-lg border bg-muted/50 p-4">
        <h2 className="mb-1 text-base font-semibold text-heading">Advanced</h2>
        <p className="text-sm text-muted-foreground">
          For troubleshooting. Resetting can't be undone.{' '}
          <DocsLink href={DOCS_URLS.advancedPreferences}>Learn more</DocsLink>
        </p>
      </div>

      <SettingsSection title="Version">
        <Field>
          <FieldLabel>Astro Editor</FieldLabel>
          <FieldContent>
            <div className="font-mono text-sm text-muted-foreground">
              {appVersion}
            </div>
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel>Preferences format</FieldLabel>
          <FieldContent>
            <div className="font-mono text-sm text-muted-foreground">
              {preferencesVersion}
            </div>
          </FieldContent>
        </Field>
      </SettingsSection>

      <SettingsSection title="Maintenance">
        <Field>
          <FieldLabel>Preferences folder</FieldLabel>
          <FieldContent>
            <Button variant="outline" onClick={handleOpenPreferencesFolder}>
              Open Preferences Folder
            </Button>
            <FieldDescription>
              Where your preferences and each project's settings are stored.
            </FieldDescription>
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel>Reset all preferences</FieldLabel>
          <FieldContent>
            <Button
              variant="destructive"
              onClick={() => setResetDialogOpen(true)}
            >
              Reset All Preferences
            </Button>
            <FieldDescription>
              Deletes your preferences and every project's settings. Your
              projects' files aren't touched.
            </FieldDescription>
          </FieldContent>
        </Field>
      </SettingsSection>

      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset All Preferences?</AlertDialogTitle>
            <AlertDialogDescription render={<div className="space-y-4" />}>
              <p className="text-sm">This deletes:</p>
              <ul className="list-disc space-y-1 pl-6 text-sm">
                <li>Your preferences</li>
                <li>Every project's settings</li>
                <li>The project list</li>
              </ul>
              <p className="text-sm">
                Astro Editor then restarts. Your projects' files aren't touched,
                and recovery files are kept.
              </p>
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="reset-confirm"
                  checked={resetConfirmed}
                  onCheckedChange={checked =>
                    setResetConfirmed(checked === true)
                  }
                />
                <label
                  htmlFor="reset-confirm"
                  className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  I understand this can't be undone
                </label>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setResetConfirmed(false)
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetAllPreferences}
              disabled={!resetConfirmed || resetting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {resetting ? 'Resetting…' : 'Reset All Preferences'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
