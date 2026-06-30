# Color System and Dark Mode

This document outlines the color system implementation in Astro Editor, including dark mode support and theming architecture.

## Overview

The app uses a hybrid approach combining:
- **CSS Variables** for semantic theme tokens (shadcn/ui system)
- **Semantic Tailwind utilities** generated from CSS variables
- **Custom Status Colors** for draft indicators and validation states

## CSS Variables (Primary System)

### Root Variables (Light Mode)
```css
:root {
  /* Core colors */
  --background: hsl(0 0% 100%);
  --foreground: hsl(0 0% 10%);
  --card: hsl(0 0% 100%);
  --card-foreground: hsl(0 0% 10%);
  
  /* UI colors */
  --muted: hsl(0 0% 96%);
  --muted-foreground: hsl(0 0% 45%);
  --accent: hsl(0 0% 96%);
  --accent-foreground: hsl(0 0% 10%);
  --overlay: hsl(0 0% 0% / 0.5);
  --titlebar-background: hsl(0 0% 98%);
  
  /* Status colors */
  --color-draft: 37 99% 25%; /* orange-600 */
  --color-required: 0 84% 60%; /* red-500 */
  --color-warning: 45 93% 47%; /* yellow-500 */
  --color-active: 217 91% 60%;
}
```

### Dark Mode Variables
```css
.dark {
  /* Neutral greys (not blue-tinted) */
  --background: hsl(0 0% 7%);
  --foreground: hsl(0 0% 90%);
  --card: hsl(0 0% 9%);
  --muted: hsl(0 0% 12%);
  --muted-foreground: hsl(0 0% 60%);
  
  /* Adjusted status colors for dark mode */
  --color-draft: 33 100% 70%; /* Lighter orange */
  --color-required: 0 91% 71%; /* Lighter red */
  --color-warning: 48 96% 80%; /* Lighter yellow */
  --color-active: 213 94% 68%;
}
```

## Semantic Tailwind Utilities

Tailwind v4 exposes theme variables from `@theme inline`, so components should use semantic utilities instead of literal color utilities:

### Text Colors
- **Primary text**: `text-foreground`
- **Secondary text/icons**: `text-muted-foreground`
- **Muted text**: Uses `text-muted-foreground` (CSS variable)
- **Active toolbar state**: `text-active`

### When to Use Each Approach

**Use CSS Variables (`text-foreground`, `text-muted-foreground`) for:**
- shadcn/ui components
- Text that should automatically adapt to theme
- Description text, helper text
- Overlay, title bar, and window chrome colors

**Use explicit `dark:` classes only when:**
- The color is intentionally not part of the theme token system
- A third-party component cannot consume CSS variables correctly
- The exception is documented near the usage

## Component Implementation

### Form Components
All form controls use semantic text and placeholder tokens:

```tsx
// Input/Textarea components
className="text-foreground placeholder:text-muted-foreground"

// Select triggers (dropdowns)
className="text-foreground"

// Field labels
<label className="text-sm font-medium text-foreground">
  {label}
</label>
```

### Navigation Components
Sidebar and title bar elements use semantic tokens:

```tsx
// Collection titles, file names
<span className="font-medium text-foreground">
  {title}
</span>

// Icon buttons
<Button className="text-muted-foreground">
  <Icon />
</Button>
```

## Traffic Light Buttons

macOS-style window controls maintain consistent colors across both themes:

```css
.traffic-light-close {
  background: var(--traffic-light-close);
  border-color: var(--traffic-light-close-border);
}
```

The literal macOS colors live only in `App.css` token declarations. Usage sites should reference the `--traffic-light-*` variables.

## Status Color System

### Draft Indicators
```css
/* Light mode */
--color-draft: 37 99% 25%; /* orange-600 */
--color-draft-bg: 33 100% 96%; /* orange-50 */

/* Dark mode */
--color-draft: 33 100% 70%; /* Lighter orange */
--color-draft-bg: 33 100% 8%; /* Dark orange background */
```

### Required Field Indicators
```css
/* Light mode */
--color-required: 0 84% 60%; /* red-500 */

/* Dark mode */
--color-required: 0 91% 71%; /* Lighter red */
```

### Usage in Components
```tsx
// Draft indicator
<span className="text-draft">(Draft)</span>

// Required field
<span className="text-required">*</span>
```

## Theme Provider Integration

The app uses a React context for theme management with seamless integration between the theme provider and preferences system:

```tsx
// Theme Provider supports: 'light' | 'dark' | 'system'
<ThemeProvider defaultTheme="system" storageKey="astro-editor-theme">
  <App />
</ThemeProvider>
```

### Theme Synchronization

1. **Initial Load**: Theme preference from global settings syncs to theme provider
2. **Immediate Updates**: Theme changes in preferences update instantly (no reload required)
3. **System Integration**: Automatic detection of OS theme changes when set to 'system'
4. **Persistence**: Themes save to both localStorage and global settings

### Implementation Details

```tsx
// Preferences dialog updates both systems
const handleThemeChange = (value: 'light' | 'dark' | 'system') => {
  setTheme(value) // Immediate theme provider update
  updateGlobal({ general: { theme: value } }) // Settings persistence
}

// Layout component syncs on app load
useEffect(() => {
  const storedTheme = globalSettings?.general?.theme
  if (storedTheme) {
    setTheme(storedTheme)
  }
}, [globalSettings?.general?.theme, setTheme])
```

### System Theme Detection

The theme provider automatically listens for OS theme changes:

```tsx
// Responds to OS dark/light mode changes
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
mediaQuery.addEventListener('change', handleSystemThemeChange)
```

## Placeholder Text

Standardized across all input components:

```css
::placeholder {
  color: hsl(var(--muted-foreground));
  opacity: 1;
}
```

Components use `placeholder:text-muted-foreground` in Tailwind classes.

## Best Practices

### 1. Consistency
- Use CSS variables for semantic colors when possible
- Use generated semantic utilities (`text-foreground`, `bg-warning`) instead of literal palette utilities
- Use Tailwind dark classes only when CSS variables don't work, and document why
- Maintain consistent text color patterns across similar components

### 2. Accessibility
- Ensure sufficient contrast ratios (WCAG guidelines)
- Test both light and dark modes thoroughly
- Use semantic color names rather than literal colors

### 3. Maintenance
- Keep color definitions centralized in CSS variables
- Document any custom color usage
- Add new semantic variables before adding component-level color literals
- Test with system theme changes

## Color Testing

To verify dark mode implementation:

1. **Manual Testing**: Toggle between light/dark modes in preferences
2. **System Integration**: Test with OS theme changes
3. **Component Coverage**: Ensure all text is visible in both modes
4. **Form Fields**: Verify input text, labels, and placeholders work correctly

## Migration Notes

During the dark mode implementation, we moved from:
- Blue-tinted backgrounds → Neutral grey backgrounds
- CSS-only color system → CSS variables exposed through semantic Tailwind utilities
- Inconsistent text colors → Standardized text color patterns

This approach keeps future theme work focused on swapping token values rather than editing component classes.
