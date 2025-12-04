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
 * Safe logging helpers that work in test environment
 */
export const safeLog = {
  info: async (message: string) => {
    try {
      const { info } = await import('@tauri-apps/plugin-log')
      await info(message)
    } catch {
      // Silently fail in test environment
    }
  },
  debug: async (message: string) => {
    try {
      const { debug } = await import('@tauri-apps/plugin-log')
      await debug(message)
    } catch {
      // Silently fail in test environment
    }
  },
  error: async (message: string) => {
    try {
      const { error } = await import('@tauri-apps/plugin-log')
      await error(message)
    } catch {
      // Silently fail in test environment
    }
  },
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
