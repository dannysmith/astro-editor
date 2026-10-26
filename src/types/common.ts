// Common types used across the application

export interface BaseComponentProps {
  className?: string
}

export interface FieldProps extends BaseComponentProps {
  name: string
  label: string
  required?: boolean
}

export interface InputFieldProps extends FieldProps {
  placeholder?: string
  value?: string
  onChange?: (value: string) => void
}

export interface SelectFieldProps extends FieldProps {
  options: string[]
  value?: string
  onChange?: (value: string | undefined) => void
}

// Common patterns for form field handling
export type FieldValue =
  | string
  | number
  | boolean
  | Date
  | string[]
  | undefined
  | null

// File system related types
export interface FileSystemEntry {
  path: string
  name: string
  lastModified?: number
}

// Common event handler types
export type ClickHandler = () => void
export type ChangeHandler<T = string> = (value: T) => void

// UI state types
export interface PanelVisibility {
  sidebarVisible: boolean
  frontmatterPanelVisible: boolean
}

// Collection-related types extending store types
export interface CollectionMeta {
  fieldCount: number
  hasSchema: boolean
}
