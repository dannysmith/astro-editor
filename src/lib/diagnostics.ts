/**
 * Diagnostic utilities for logging and error reporting
 */

import { commands } from '@/lib/bindings'

export interface DiagnosticContext {
  appVersion: string
  platform: string
  timestamp: string
}

let cachedContext: DiagnosticContext | null = null

/**
 * Get diagnostic context information (cached after first call)
 */
export async function getDiagnosticContext(): Promise<DiagnosticContext> {
  if (cachedContext) {
    return cachedContext
  }

  try {
    // Get app version from package.json via Tauri
    const versionResult = await commands.getAppVersion()
    const platformResult = await commands.getPlatformInfo()

    const appVersion =
      versionResult.status === 'ok' ? versionResult.data : 'unknown'
    const platform =
      platformResult.status === 'ok' ? platformResult.data : 'unknown'

    cachedContext = {
      appVersion,
      platform,
      timestamp: new Date().toISOString(),
    }

    return cachedContext
  } catch {
    // Fallback if Tauri commands fail
    cachedContext = {
      appVersion: 'unknown',
      platform:
        typeof navigator !== 'undefined' ? navigator.platform : 'unknown',
      timestamp: new Date().toISOString(),
    }

    return cachedContext
  }
}

/**
 * Format an error for logging with context
 */
export function formatErrorForLogging(
  tag: string,
  message: string,
  context?: {
    projectPath?: string
    step?: string
    error?: Error | string
  }
): string {
  let logMessage = `Astro Editor [${tag}] ${message}`

  if (context?.step) {
    logMessage += ` - Step: ${context.step}`
  }

  if (context?.projectPath) {
    logMessage += ` - Path: ${context.projectPath}`
  }

  if (context?.error) {
    const errorMsg =
      context.error instanceof Error ? context.error.message : context.error
    logMessage += ` - Error: ${errorMsg}`
  }

  return logMessage
}
