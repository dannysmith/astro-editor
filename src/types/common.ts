// Common types used across the application

export interface BaseComponentProps {
  className?: string
}

export interface FieldProps extends BaseComponentProps {
  name: string
  label: string
  required?: boolean
}

/** Every property optional, at every depth: an update that only names what changed */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}
