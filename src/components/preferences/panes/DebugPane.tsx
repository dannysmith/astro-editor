import React, { useState, useCallback, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
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

export const DebugPane: React.FC = () => {
  const [appVersion, setAppVersion] = useState<string>('...')
  const [preferencesVersion, setPreferencesVersion] = useState<string>('...')
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [resetConfirmed, setResetConfirmed] = useState(false)
  const [resetting, setResetting] = useState(false)
  const { globalSettings } = usePreferences()

  // Load diagnostic information on mount
  useEffect(() => {
    void getDiagnosticContext().then(context => {
      setAppVersion(context.appVersion)
    })

    if (globalSettings?.version) {
      setPreferencesVersion(String(globalSettings.version))
    }
  }, [globalSettings?.version])

  const handleOpenPreferencesFolder = useCallback(() => {
    void (async () => {
      try {
        await invoke('open_preferences_folder')
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
      try {
        await invoke('reset_all_preferences')
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
      <div className="rounded-lg border bg-muted/50 p-4 mb-6">
        <h2 className="text-base font-semibold mb-1 text-heading">
          Advanced Settings
        </h2>
        <p className="text-sm text-muted-foreground">
          Developer and diagnostic tools. Use with caution.
        </p>
      </div>

      <SettingsSection title="Version Information">
        <Field>
          <FieldLabel>Application Version</FieldLabel>
          <FieldContent>
            <div className="text-sm text-muted-foreground font-mono">
              {appVersion}
            </div>
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel>Preferences Version</FieldLabel>
          <FieldContent>
            <div className="text-sm text-muted-foreground font-mono">
              {preferencesVersion}
            </div>
          </FieldContent>
        </Field>
      </SettingsSection>

      <SettingsSection title="Maintenance">
        <Field>
          <FieldLabel>Preferences Folder</FieldLabel>
          <FieldContent>
            <Button variant="outline" onClick={handleOpenPreferencesFolder}>
              Open Preferences Folder
            </Button>
            <FieldDescription>
              Opens the folder where all preferences and settings are stored
            </FieldDescription>
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel>Reset All Preferences</FieldLabel>
          <FieldContent>
            <Button
              variant="destructive"
              onClick={() => setResetDialogOpen(true)}
            >
              Reset All Preferences
            </Button>
            <FieldDescription>
              Permanently delete all settings and restore defaults
            </FieldDescription>
          </FieldContent>
        </Field>
      </SettingsSection>

      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset All Preferences?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p className="text-sm">
                  ⚠️ Warning: This will permanently delete:
                </p>
                <ul className="text-sm list-disc pl-6 space-y-1">
                  <li>All global preferences</li>
                  <li>All project-specific settings</li>
                  <li>Project registry and recent projects list</li>
                </ul>
                <p className="text-sm">
                  The app will restart with default settings.
                  <br />
                  Your actual project files will not be affected.
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
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    I understand this cannot be undone
                  </label>
                </div>
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
              {resetting ? 'Resetting...' : 'Reset All Preferences'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
