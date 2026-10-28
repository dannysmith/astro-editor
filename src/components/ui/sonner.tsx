import { useTheme } from '../../lib/theme-provider'
import { Toaster as Sonner, ToasterProps } from 'sonner'

// Uses the app's own theme provider, not the next-themes package shadcn's
// version imports. Re-running `shadcn add sonner` would bring next-themes back.
// Show toasts with `toast` from @/lib/toast, not from sonner directly.

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme()

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      position="bottom-right"
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
        } as React.CSSProperties
      }
      toastOptions={{
        style: {
          background: 'var(--popover)',
          color: 'var(--popover-foreground)',
          border: '1px solid var(--border)',
        },
        className: 'group toast',
      }}
      {...props}
    />
  )
}

export { Toaster }
