import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { info, error } from '@tauri-apps/plugin-log'
import App from './App'
import { queryClient } from './lib/query-client'
import { getDiagnosticContext } from './lib/diagnostics'

// Log app startup with diagnostic context
getDiagnosticContext()
  .then(async ({ appVersion, platform }) => {
    await info(`Astro Editor v${appVersion} started on ${platform}`)
  })
  .catch(async err => {
    await error(`Astro Editor startup logging failed: ${err}`)
  })

// Global error handlers for JavaScript errors
window.addEventListener('error', event => {
  void error(
    `Astro Editor [JS_ERROR] ${(event.error as Error)?.message || event.message} at ${event.filename}:${event.lineno}`
  )
})

window.addEventListener('unhandledrejection', event => {
  void error(`Astro Editor [PROMISE_REJECTION] ${String(event.reason)}`)
})

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
)
