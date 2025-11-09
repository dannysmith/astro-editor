# Form Patterns Guide

This guide covers form component patterns for frontmatter fields and settings/preferences interfaces.

## Table of Contents

- [Overview](#overview)
- [ShadCN Field Components](#shadcn-field-components)
- [Frontmatter Field Components](#frontmatter-field-components)
- [Settings and Preferences Forms](#settings-and-preferences-forms)
- [Component Organization](#component-organization)
- [Common Patterns](#common-patterns)

## Overview

The application uses two distinct patterns for form components:

1. **Frontmatter Fields**: Dynamic forms generated from Zod/JSON schemas with `FieldWrapper`
2. **Settings Forms**: Static preference forms using ShadCN Field components directly

Both approaches use the **Direct Store Pattern** to avoid infinite loops with React Hook Form.

## ShadCN Field Components

The app uses ShadCN's Field components for consistent form layouts:

```typescript
import {
  Field,           // Container with vertical/horizontal orientation
  FieldLabel,      // Label with required indicator support
  FieldContent,    // Wrapper for input + description
  FieldDescription, // Helper text below input
  FieldGroup,      // Group multiple fields
} from '@/components/ui/field'
```

### Basic Field Structure

```typescript
<Field>
  <FieldLabel>Field Name</FieldLabel>
  <FieldContent>
    <Input {...props} />
    <FieldDescription>
      Help text for the field
    </FieldDescription>
  </FieldContent>
</Field>
```

### Horizontal Layout

For toggles, switches, and checkboxes:

```typescript
<Field layout="horizontal">
  <FieldLabel>Enable Feature</FieldLabel>
  <FieldContent>
    <Switch {...props} />
  </FieldContent>
</Field>
```

## Frontmatter Field Components

### Direct Store Pattern (CRITICAL)

**Problem**: React Hook Form + Zustand causes infinite loops.

**Solution**: Components access store directly without callback props.

```typescript
// ✅ CORRECT: Direct store pattern with selector syntax
const StringField: React.FC<StringFieldProps> = ({
  name,
  label,
  required,
  field,
}) => {
  const value = useEditorStore(state => state.frontmatter[name])
  const updateFrontmatterField = useEditorStore(state => state.updateFrontmatterField)

  return (
    <FieldWrapper
      label={label}
      required={required}
      description={field?.description}
      defaultValue={field?.default}
      constraints={field?.constraints}
      currentValue={value}
    >
      <Input
        value={valueToString(value)}
        onChange={e => updateFrontmatterField(name, e.target.value)}
      />
    </FieldWrapper>
  )
}

// ❌ WRONG: Callback dependencies cause infinite loops
const BadField: React.FC<BadFieldProps> = ({
  name,
  value,
  onChange, // Don't pass callbacks as props!
}) => {
  return <Input value={value} onChange={onChange} />
}
```

### FieldWrapper Pattern

`FieldWrapper` provides consistent layout for frontmatter fields with automatic schema metadata integration:

**Features:**
- Automatic label/description/constraints rendering
- Required field indicators
- Default value display when field is empty
- Horizontal layout support for toggles/switches
- Schema metadata integration

**Props:**

```typescript
interface FieldWrapperProps {
  label: string
  required: boolean
  description?: string
  defaultValue?: unknown
  constraints?: FieldConstraints
  currentValue: unknown
  layout?: 'vertical' | 'horizontal'
  children: React.ReactNode
}
```

**Usage:**

```typescript
<FieldWrapper
  label="Title"
  required={true}
  description="The post title"
  defaultValue="Untitled"
  constraints={{ minLength: 3, maxLength: 100 }}
  currentValue={frontmatter.title}
>
  <Input value={frontmatter.title || ''} onChange={handleChange} />
</FieldWrapper>
```

### Field Component Examples

#### StringField

```typescript
const StringField: React.FC<StringFieldProps> = ({
  name,
  label,
  required,
  field,
}) => {
  const value = useEditorStore(state => state.frontmatter[name])
  const updateFrontmatterField = useEditorStore(state => state.updateFrontmatterField)

  return (
    <FieldWrapper
      label={label}
      required={required}
      description={field?.description}
      defaultValue={field?.default}
      constraints={field?.constraints}
      currentValue={value}
    >
      <Input
        value={valueToString(value)}
        onChange={e => updateFrontmatterField(name, e.target.value)}
        placeholder={field?.default ? String(field.default) : ''}
      />
    </FieldWrapper>
  )
}
```

#### TextareaField

```typescript
const TextareaField: React.FC<TextareaFieldProps> = ({
  name,
  label,
  required,
  field,
}) => {
  const value = useEditorStore(state => state.frontmatter[name])
  const updateFrontmatterField = useEditorStore(state => state.updateFrontmatterField)

  return (
    <FieldWrapper
      label={label}
      required={required}
      description={field?.description}
      defaultValue={field?.default}
      constraints={field?.constraints}
      currentValue={value}
    >
      <AutoExpandingTextarea
        value={valueToString(value)}
        onChange={e => updateFrontmatterField(name, e.target.value)}
        placeholder={field?.default ? String(field.default) : ''}
        minRows={3}
      />
    </FieldWrapper>
  )
}
```

#### BooleanField

```typescript
const BooleanField: React.FC<BooleanFieldProps> = ({
  name,
  label,
  required,
  field,
}) => {
  const value = useEditorStore(state => state.frontmatter[name])
  const updateFrontmatterField = useEditorStore(state => state.updateFrontmatterField)

  // Get value with schema default fallback
  const getBooleanValue = (): boolean => {
    if (value === undefined && field?.default !== undefined) {
      return Boolean(field.default)
    }
    return Boolean(value)
  }

  return (
    <FieldWrapper
      label={label}
      required={required}
      description={field?.description}
      defaultValue={field?.default}
      currentValue={value}
      layout="horizontal" // Horizontal layout for switches
    >
      <Switch
        checked={getBooleanValue()}
        onCheckedChange={checked => updateFrontmatterField(name, checked)}
      />
    </FieldWrapper>
  )
}
```

#### NumberField

```typescript
const NumberField: React.FC<NumberFieldProps> = ({
  name,
  label,
  required,
  field,
}) => {
  const value = useEditorStore(state => state.frontmatter[name])
  const updateFrontmatterField = useEditorStore(state => state.updateFrontmatterField)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value === '') {
      updateFrontmatterField(name, undefined)
      return
    }

    const numValue = parseFloat(value)
    if (!isNaN(numValue)) {
      updateFrontmatterField(name, numValue)
    }
  }

  return (
    <FieldWrapper
      label={label}
      required={required}
      description={field?.description}
      defaultValue={field?.default}
      constraints={field?.constraints}
      currentValue={value}
    >
      <Input
        type="number"
        value={value ?? ''}
        onChange={handleChange}
        min={field?.constraints?.min}
        max={field?.constraints?.max}
      />
    </FieldWrapper>
  )
}
```

#### DateField

```typescript
import { formatIsoDate } from '@/lib/dates'

const DateField: React.FC<DateFieldProps> = ({
  name,
  label,
  required,
  field,
}) => {
  const value = useEditorStore(state => state.frontmatter[name])
  const updateFrontmatterField = useEditorStore(state => state.updateFrontmatterField)

  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      updateFrontmatterField(name, formatIsoDate(date))
    } else {
      updateFrontmatterField(name, undefined)
    }
  }

  return (
    <FieldWrapper
      label={label}
      required={required}
      description={field?.description}
      defaultValue={field?.default}
      currentValue={value}
    >
      <DatePicker
        date={value ? new Date(value) : undefined}
        onSelect={handleDateChange}
      />
    </FieldWrapper>
  )
}
```

#### EnumField (Select Dropdown)

```typescript
const EnumField: React.FC<EnumFieldProps> = ({
  name,
  label,
  required,
  field,
}) => {
  const value = useEditorStore(state => state.frontmatter[name])
  const updateFrontmatterField = useEditorStore(state => state.updateFrontmatterField)

  if (!field?.enum) {
    return null
  }

  return (
    <FieldWrapper
      label={label}
      required={required}
      description={field?.description}
      defaultValue={field?.default}
      currentValue={value}
    >
      <Select
        value={valueToString(value)}
        onValueChange={val => updateFrontmatterField(name, val)}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select an option..." />
        </SelectTrigger>
        <SelectContent>
          {field.enum.map(option => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldWrapper>
  )
}
```

#### ArrayField (Tags)

```typescript
const ArrayField: React.FC<ArrayFieldProps> = ({
  name,
  label,
  required,
  field,
}) => {
  const value = useEditorStore(state => state.frontmatter[name])
  const updateFrontmatterField = useEditorStore(state => state.updateFrontmatterField)

  // Convert any value to string array
  const getArrayValue = (): string[] => {
    if (!value) return []
    if (Array.isArray(value)) {
      return value.map(v => String(v))
    }
    return [String(value)]
  }

  const handleTagsChange = (tags: string[]) => {
    updateFrontmatterField(name, tags)
  }

  return (
    <FieldWrapper
      label={label}
      required={required}
      description={field?.description}
      defaultValue={field?.default}
      currentValue={value}
    >
      <TagInput
        tags={getArrayValue()}
        onTagsChange={handleTagsChange}
        placeholder="Add tag..."
      />
    </FieldWrapper>
  )
}
```

#### FrontmatterField (Orchestrator)

```typescript
const FrontmatterField: React.FC<FrontmatterFieldProps> = ({
  name,
  field,
  required,
}) => {
  const label = field?.label || name

  // Route to appropriate field component based on type
  if (field?.type === 'string') {
    if (field.format === 'textarea') {
      return <TextareaField name={name} label={label} required={required} field={field} />
    }
    return <StringField name={name} label={label} required={required} field={field} />
  }

  if (field?.type === 'number' || field?.type === 'integer') {
    return <NumberField name={name} label={label} required={required} field={field} />
  }

  if (field?.type === 'boolean') {
    return <BooleanField name={name} label={label} required={required} field={field} />
  }

  if (field?.type === 'date') {
    return <DateField name={name} label={label} required={required} field={field} />
  }

  if (field?.type === 'enum') {
    return <EnumField name={name} label={label} required={required} field={field} />
  }

  if (field?.type === 'array') {
    return <ArrayField name={name} label={label} required={required} field={field} />
  }

  // Fallback to StringField
  return <StringField name={name} label={label} required={required} field={field} />
}
```

## Settings and Preferences Forms

For settings/preferences panes, use ShadCN Field components directly without FieldWrapper.

### Basic Settings Form

```typescript
const SettingsForm = () => {
  const { theme, setTheme } = usePreferences()

  return (
    <FieldGroup>
      <Field>
        <FieldLabel>Theme</FieldLabel>
        <FieldContent>
          <Select value={theme} onValueChange={setTheme}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
          <FieldDescription>
            Choose your preferred color theme
          </FieldDescription>
        </FieldContent>
      </Field>

      <Field>
        <FieldLabel>Auto-save Interval</FieldLabel>
        <FieldContent>
          <Input
            type="number"
            value={autoSaveInterval}
            onChange={e => setAutoSaveInterval(Number(e.target.value))}
            min={1000}
            max={10000}
            step={1000}
          />
          <FieldDescription>
            Time in milliseconds between auto-saves
          </FieldDescription>
        </FieldContent>
      </Field>

      <Field layout="horizontal">
        <FieldLabel>Enable Spell Check</FieldLabel>
        <FieldContent>
          <Switch
            checked={spellCheck}
            onCheckedChange={setSpellCheck}
          />
        </FieldContent>
      </Field>
    </FieldGroup>
  )
}
```

### Complex Input with Reset Button

For complex inputs (e.g., color pickers with reset buttons), use simple div containers with flex layout:

```typescript
<Field>
  <FieldLabel>Heading Color</FieldLabel>
  <FieldContent>
    <div className="flex items-center gap-2 w-fit">
      <input
        type="color"
        value={color}
        onChange={e => handleColorChange(e.target.value)}
        className="w-20 h-9 cursor-pointer rounded-md border border-input bg-transparent"
      />
      <Button variant="outline" size="sm" onClick={handleReset}>
        Reset
      </Button>
    </div>
    <FieldDescription>Choose the heading color</FieldDescription>
  </FieldContent>
</Field>
```

### Settings Pattern Guidelines

1. **Use FieldGroup** to group related settings sections
2. **Label First**: FieldLabel before FieldContent
3. **Description Last**: FieldDescription inside FieldContent, after the input
4. **Simple Containers**: For complex inputs, use simple div containers with flex layout
5. **Direct Updates**: Settings use hooks like `usePreferences()` which handle updates directly

## Component Organization

### Directory Structure

```
src/components/frontmatter/fields/
├── __tests__/           # Unit tests for complex logic
│   ├── ArrayField.test.tsx
│   ├── BooleanField.test.tsx
│   ├── FrontmatterField.test.tsx
│   ├── FieldWrapper.test.tsx
│   └── utils.test.tsx
├── FieldWrapper.tsx     # Wrapper using Field components
├── StringField.tsx      # Simple text input
├── TextareaField.tsx    # Multi-line text input
├── NumberField.tsx      # Numeric input with validation
├── BooleanField.tsx     # Switch with schema defaults
├── DateField.tsx        # Date picker integration
├── EnumField.tsx        # Select dropdown
├── ArrayField.tsx       # Tag input with validation
├── FrontmatterField.tsx # Orchestrator component
├── utils.ts             # Shared utility functions
└── index.ts             # Barrel exports
```

### Export Pattern

```typescript
// src/components/frontmatter/fields/index.ts
export { FieldWrapper } from './FieldWrapper'
export { StringField } from './StringField'
export { TextareaField } from './TextareaField'
export { NumberField } from './NumberField'
export { BooleanField } from './BooleanField'
export { DateField } from './DateField'
export { EnumField } from './EnumField'
export { ArrayField } from './ArrayField'
export { FrontmatterField } from './FrontmatterField'
export * from './utils'

export type { FieldWrapperProps } from './FieldWrapper'
export type { StringFieldProps } from './StringField'
// ... more type exports
```

## Common Patterns

### Value Conversion Utilities

```typescript
// utils.ts
export const valueToString = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  return String(value)
}

export const valueToNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined) return undefined
  const num = Number(value)
  return isNaN(num) ? undefined : num
}

export const valueToArray = (value: unknown): string[] => {
  if (!value) return []
  if (Array.isArray(value)) {
    return value.map(v => String(v))
  }
  return [String(value)]
}
```

### Constraint Display

```typescript
const ConstraintText: React.FC<{ constraints?: FieldConstraints }> = ({
  constraints,
}) => {
  if (!constraints) return null

  const parts: string[] = []

  if (constraints.minLength !== undefined) {
    parts.push(`Min length: ${constraints.minLength}`)
  }
  if (constraints.maxLength !== undefined) {
    parts.push(`Max length: ${constraints.maxLength}`)
  }
  if (constraints.pattern) {
    parts.push(`Pattern: ${constraints.pattern}`)
  }

  if (parts.length === 0) return null

  return (
    <span className="text-xs text-muted-foreground">
      {parts.join(', ')}
    </span>
  )
}
```

### Default Value Display

```typescript
const DefaultValueBadge: React.FC<{ defaultValue: unknown }> = ({
  defaultValue,
}) => {
  if (defaultValue === undefined) return null

  return (
    <span className="text-xs text-muted-foreground">
      Default: <code className="rounded bg-muted px-1">{String(defaultValue)}</code>
    </span>
  )
}
```

## Key Design Principles

1. **Single Responsibility**: Each field component handles one data type
2. **Direct Store Access**: No callback props, direct store updates
3. **Type Safety**: Proper TypeScript interfaces and validation
4. **Schema Integration**: Leverage Zod/JSON schema information for defaults and constraints
5. **Field Components**: Use FieldWrapper for frontmatter, Field components for settings
6. **Layout Support**: Use `layout="horizontal"` for toggles/switches
7. **Utility Separation**: Shared logic in utils.ts
8. **Consistent Patterns**: Follow established patterns across all field types

---

**Remember**: Always use the Direct Store Pattern to avoid infinite loops. Never pass callbacks as props to field components.
