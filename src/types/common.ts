// Common types used across the application

export interface BaseComponentProps {
  className?: string
}

export interface FieldProps extends BaseComponentProps {
  name: string
  label: string
  required?: boolean
}
