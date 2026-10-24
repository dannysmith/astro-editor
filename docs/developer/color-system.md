# Color System and Dark Mode

This document outlines the color system implementation in Astro Editor, including dark mode support and theming architecture.

## Overview

The app uses a hybrid approach combining:
- **CSS Variables** for semantic theme tokens (shadcn/ui system)
- **Tailwind Dark Mode Classes** for explicit light/dark styling where needed
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
  
  /* Status colors */
  --draft: hsl(37 99% 25%); /* orange-600 */
  --required: hsl(0 84% 60%); /* red-500 */
  --warning: hsl(45 93% 47%); /* yellow-500 */
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
  --draft: hsl(33 100% 70%); /* Lighter orange */
  --required: hsl(0 91% 71%); /* Lighter red */
  --warning: hsl(48 96% 80%); /* Lighter yellow */
}
```

## Tailwind Dark Mode Classes

For components where CSS variables don't provide sufficient control, we use Tailwind's `dark:` variant classes:

### Text Colors
- **Primary text**: `text-gray-900 dark:text-white`
- **Secondary text**: `text-gray-700 dark:text-gray-300`
- **Muted text**: Uses `text-muted-foreground` (CSS variable)

### When to Use Each Approach

**Use CSS Variables (`text-foreground`, `text-muted-foreground`) for:**
- shadcn/ui components
- Text that should automatically adapt to theme
- Description text, helper text

**Use Tailwind Dark Classes (`text-gray-900 dark:text-white`) for:**
- Form field labels and input text
- Component titles and headings
- Navigation elements
- Any text that doesn't render correctly with CSS variables

## Component Implementation

### Form Components
All form inputs and labels use explicit dark mode classes:

```tsx
// Input/Textarea components
className="text-gray-900 dark:text-white placeholder:text-muted-foreground"

// Select triggers (dropdowns)
className="text-gray-900 dark:text-white"

// Field labels
<label className="text-sm font-medium text-gray-900 dark:text-white">
  {label}
</label>
```

### Navigation Components
Sidebar and title bar elements use dark mode classes:

```tsx
// Collection titles, file names
<span className="font-medium text-gray-900 dark:text-white">
  {title}
</span>

// Icon buttons
<Button className="text-gray-700 dark:text-gray-300">
  <Icon />
</Button>
```

## Traffic Light Buttons

macOS-style window controls maintain consistent colors across both themes:

```css
/* Same colors in both light and dark mode */
.traffic-light-close {
  background: #ff5f57; /* Red */
  border-color: #e0443e;
}

.traffic-light-minimize {
  background: #ffbd2e; /* Yellow */
  border-color: #dea123;
}

.traffic-light-maximize {
  background: #28ca42; /* Green */
  border-color: #1aac29;
}
```

## Status Color System

Status tokens (`--draft`, `--draft-bg`, `--filter`, `--filter-bg`, `--required`, `--warning`, `--warning-bg`, plus `--heading`) are full colour values defined in `:root` and `.dark`, and mapped into Tailwind in `@theme inline` (`--color-draft: var(--draft)` etc.), so they work as normal utilities with variants and opacity modifiers.

Each token name means one colour for every utility (`text-`, `bg-`, `border-`), so strong colours and their background tints are separate tokens:

```tsx
// Draft label: strong colour
<span className="text-draft">Draft</span>

// Draft-filtered header: background tint, with a lighter hover
<div className="bg-draft-bg hover:bg-draft-bg/80">…</div>

// Required field
<span className="text-required">*</span>
```

Don't name a `:root` variable `--color-*`: that namespace belongs to `@theme`, and a clash silently breaks the generated utilities.

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
  color: var(--muted-foreground);
  opacity: 1;
}
```

Tokens are already full `hsl(...)` values, so use them as `var(--token)`. Wrapping one in `hsl(var(--token))` is invalid, and the browser silently drops the declaration.

Components use `placeholder:text-muted-foreground` in Tailwind classes.

## Best Practices

### 1. Consistency
- Use CSS variables for semantic colors when possible
- Use Tailwind dark classes only when CSS variables don't work
- Maintain consistent text color patterns across similar components

### 2. Accessibility
- Ensure sufficient contrast ratios (WCAG guidelines)
- Test both light and dark modes thoroughly
- Use semantic color names rather than literal colors

### 3. Maintenance
- Keep color definitions centralized in CSS variables
- Document any custom color usage
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
- CSS-only color system → Hybrid CSS variables + Tailwind classes
- Inconsistent text colors → Standardized text color patterns

This hybrid approach provides the flexibility needed for complex UI components while maintaining the benefits of a semantic color system.