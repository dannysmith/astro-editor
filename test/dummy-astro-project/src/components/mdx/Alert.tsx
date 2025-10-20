// React component with inline types and children prop
export default function Alert({
  variant,
  title,
  children,
}: {
  variant: 'info' | 'warning' | 'error' | 'success'
  title?: string
  children?: React.ReactNode
}) {
  const variantStyles = {
    info: 'bg-blue-50 border-blue-200 text-blue-900',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    error: 'bg-red-50 border-red-200 text-red-900',
    success: 'bg-green-50 border-green-200 text-green-900',
  }

  return (
    <div className={`border-l-4 p-4 ${variantStyles[variant]}`}>
      {title && <h4 className="font-semibold mb-2">{title}</h4>}
      <div>{children}</div>
    </div>
  )
}
