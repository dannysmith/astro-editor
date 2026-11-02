import type { ReactNode } from 'react'

/** Alert, a fixture component with a named export */
export function Alert({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div role="alert">
      <strong>{title}</strong>
      {children}
    </div>
  )
}
