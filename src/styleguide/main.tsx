/**
 * Dev-only styleguide: every UI component the app uses, in each state. Vite
 * serves it at http://localhost:1420/styleguide.html but only builds
 * index.html, so it never ships. `bun run app styleguide` screenshots it.
 */
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '../lib/query-client'
import { ThemeProvider } from '../lib/theme-provider'
import { Styleguide } from './Styleguide'
import '../App.css'
// Editor typography variables
import '../components/editor/Editor.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <QueryClientProvider client={queryClient}>
    {/* Its own storage key, so switching theme here doesn't change the app's */}
    <ThemeProvider storageKey="astro-editor-styleguide-theme">
      <Styleguide />
    </ThemeProvider>
  </QueryClientProvider>
)
