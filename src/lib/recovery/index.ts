import { info, error as logError } from '@tauri-apps/plugin-log'
import { commands, type JsonValue } from '@/types'
import type { RecoveryData, CrashReport } from './types'

export type { RecoveryData, CrashReport }

/**
 * Save recovery data when a save operation fails
 */
export const saveRecoveryData = async (data: {
  currentFile: { path: string; name: string; collection: string } | null
  projectPath: string | null
  editorContent: string
  frontmatter: Record<string, unknown>
}) => {
  if (!data.currentFile) return

  const recoveryData: RecoveryData = {
    timestamp: new Date().toISOString(),
    originalFilePath: data.currentFile.path,
    projectPath: data.projectPath || '',
    editorContent: data.editorContent,
    frontmatter: data.frontmatter,
    fileName: data.currentFile.name,
    collection: data.currentFile.collection,
  }

  try {
    const result = await commands.saveRecoveryData(
      recoveryData as unknown as JsonValue
    )
    if (result.status === 'error') {
      await logError(`Failed to save recovery data: ${result.error}`)
      return
    }
    await info(`Recovery data saved for ${recoveryData.fileName}`)
  } catch (err) {
    await logError(`Failed to save recovery data: ${String(err)}`)
  }
}

/**
 * Save crash report for debugging critical failures
 */
export const saveCrashReport = async (
  error: Error,
  context: {
    currentFile?: string
    projectPath?: string
    action: string
  }
) => {
  const report: CrashReport = {
    timestamp: new Date().toISOString(),
    error: error.message,
    stack: error.stack,
    context,
    platform: navigator.platform,
  }

  try {
    const result = await commands.saveCrashReport(
      report as unknown as JsonValue
    )
    if (result.status === 'error') {
      await logError(`Failed to save crash report: ${result.error}`)
      return
    }
    await info('Crash report saved')
  } catch (err) {
    await logError(`Failed to save crash report: ${String(err)}`)
  }
}
