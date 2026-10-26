import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useCommandContext } from '../../hooks/commands/useCommandContext'
import { useEditorActions } from '../../hooks/editor/useEditorActions'
import { useTheme } from '../../lib/theme-provider'
import { createAgentApi } from '../../lib/agent-bridge/api'

/**
 * Dev-only: installs `window.__ae` (see `lib/agent-bridge/api.ts`) for the
 * agent bridge CLI, `bun run app`. Layout renders it only when
 * `import.meta.env.DEV`.
 */
export function AgentBridge() {
  const queryClient = useQueryClient()
  const context = useCommandContext()
  const { theme, setTheme } = useTheme()
  const { openFileByPath } = useEditorActions()

  // The API is created once, so it reads the latest hook values through a ref
  const latest = useRef({ context, theme, setTheme, openFileByPath })
  useEffect(() => {
    latest.current = { context, theme, setTheme, openFileByPath }
  })

  useEffect(() => {
    window.__ae = createAgentApi({
      queryClient,
      getCommandContext: () => latest.current.context,
      getTheme: () => latest.current.theme,
      setTheme: theme => latest.current.setTheme(theme),
      openFileByPath: path => latest.current.openFileByPath(path),
    })
    return () => {
      delete window.__ae
    }
  }, [queryClient])

  return null
}
