import type { JsonValue } from '@/types'

export interface RecoveryData {
  timestamp: string
  originalFilePath: string
  projectPath: string
  editorContent: string
  frontmatter: Record<string, JsonValue>
  fileName: string
  collection: string
}

export interface CrashReport {
  timestamp: string
  error: string
  stack?: string
  context: {
    currentFile?: string
    projectPath?: string
    action: string
  }
  appVersion?: string
  platform: string
}
