# UI Patterns

## Overview

This guide documents common UI patterns and best practices specific to Astro Editor. It serves as a reference for consistent component implementation across the application and provides solutions to common rendering and styling challenges.

As we discover new patterns and solutions, they should be documented here to ensure consistency and prevent duplicate problem-solving.

## shadcn/ui Usage

Astro Editor uses [shadcn/ui](https://ui.shadcn.com/) as the foundation for UI components. shadcn/ui provides unstyled, accessible components built on [Radix UI](https://www.radix-ui.com/) that we customize to match our design system.

### Component Location

shadcn/ui components live in `src/components/ui/` and are imported throughout the application:

```typescript
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
```

### Customization Pattern

We customize shadcn/ui components using Tailwind classes and CSS variables:

```typescript
// Base component from shadcn/ui
<Button variant="ghost" size="sm">
  Click me
</Button>

// Customized with additional classes
<Button
  variant="ghost"
  size="sm"
  className="size-7 p-0 hover:bg-accent"
>
  <Save className="size-4" />
</Button>
```

### Key shadcn/ui Components We Use

| Component | Purpose | Location |
|-----------|---------|----------|
| Button | Actions, toolbar buttons | `ui/button.tsx` |
| Input | Text fields in forms | `ui/input.tsx` |
| Dialog | Modal dialogs (preferences, alerts) | `ui/dialog.tsx` |
| Select | Dropdown selectors | `ui/select.tsx` |
| Checkbox | Boolean toggles in forms | `ui/checkbox.tsx` |
| Textarea | Multi-line text input | `ui/textarea.tsx` |
| Separator | Visual dividers | `ui/separator.tsx` |
| ScrollArea | Custom scrollbars | `ui/scroll-area.tsx` |

## Icon Button Patterns

### Standard Icon Button Style

All icon-only buttons in the application follow this consistent pattern:

```tsx
<Button
  onClick={handleAction}
  variant="ghost"
  size="sm"
  className="size-7 p-0"
  title="Button Description"
>
  <IconComponent className="size-4" />
</Button>
```

**Key classes**:
- `size-7`: 28px × 28px button (consistent with toolbar height)
- `p-0`: Remove default padding (icon fills button)
- `variant="ghost"`: Transparent background, subtle hover
- `size="sm"`: Small button variant
- Icon: `size-4` (16px × 16px) for visual balance

**Accessibility**:
- Always include `title` attribute for tooltips
- Use semantic `<Button>` element (not `<div>` with click handler)
- Ensure proper ARIA labels if title isn't sufficient

### SVG Icon Positioning Fix (CRITICAL)

**Problem**: SVG icons in buttons experience a 1-pixel shift when the `disabled` attribute is applied. This is a known issue with shadcn/ui buttons and browser rendering differences.

**Visual Impact**: Icons appear to "jump" slightly when a button becomes disabled, creating a jarring visual artifact.

**Solution**: Always apply the CSS transform fix for ALL icon buttons (not just disabled ones):

```tsx
<Button
  onClick={handleSave}
  disabled={!isDirty}
  variant="ghost"
  size="sm"
  className="size-7 p-0 [&_svg]:transform-gpu [&_svg]:scale-100"
  title="Save File"
>
  <Save className="size-4" />
</Button>
```

**Explanation of Fix**:

```css
/* Applied via className */
[&_svg]:transform-gpu   /* Enables GPU acceleration for SVG rendering */
[&_svg]:scale-100       /* Applies transform: scale(1) to stabilize positioning */
```

**Why This Works**:
1. `transform-gpu` forces GPU rendering, which handles SVG positioning more consistently
2. `scale(1)` creates a transform context that stabilizes the SVG's coordinate system
3. Applying the transform in both enabled and disabled states prevents the shift
4. The transform is a no-op visually (scale of 1 = no change) but fixes the rendering bug

**When to Apply**:
- ✅ **Always apply to icon buttons** - Even if not disabled, prevents future issues
- ✅ Apply to all buttons in toolbars
- ✅ Apply to all icon-only action buttons
- ❌ Not needed for text buttons without icons
- ❌ Not needed for buttons with icon + text (shift less noticeable)

**Real Examples from Astro Editor**:

```tsx
// UnifiedTitleBar.tsx - Save button
<Button
  onClick={() => globalCommandRegistry.execute('save-file')}
  disabled={!isDirty}
  variant="ghost"
  size="sm"
  className="size-7 p-0 [&_svg]:transform-gpu [&_svg]:scale-100"
  title="Save File (⌘S)"
>
  <Save className="size-4" />
</Button>

// UnifiedTitleBar.tsx - Sidebar toggle
<Button
  onClick={() => globalCommandRegistry.execute('toggle-sidebar')}
  variant="ghost"
  size="sm"
  className="size-7 p-0 [&_svg]:transform-gpu [&_svg]:scale-100"
  title="Toggle Sidebar (⌘1)"
>
  <PanelLeft className="size-4" />
</Button>

// UnifiedTitleBar.tsx - New file button (conditionally disabled)
<Button
  onClick={() => globalCommandRegistry.execute('create-new-file')}
  disabled={!selectedCollection}
  variant="ghost"
  size="sm"
  className="size-7 p-0 [&_svg]:transform-gpu [&_svg]:scale-100"
  title="New File (⌘N)"
>
  <Plus className="size-4" />
</Button>
```

### Icon Button State Variations

#### Toggle State Buttons

For buttons that represent toggleable state, change the icon to reflect current state:

```tsx
<Button
  onClick={handleToggleSidebar}
  variant="ghost"
  size="sm"
  className="size-7 p-0 [&_svg]:transform-gpu [&_svg]:scale-100"
  title={sidebarVisible ? 'Hide Sidebar' : 'Show Sidebar'}
>
  {sidebarVisible ? (
    <PanelLeftClose className="size-4" />
  ) : (
    <PanelLeftOpen className="size-4" />
  )}
</Button>
```

#### Loading State Buttons

Show loading spinner while async operations execute:

```tsx
<Button
  onClick={handleSave}
  disabled={isSaving}
  variant="ghost"
  size="sm"
  className="size-7 p-0 [&_svg]:transform-gpu [&_svg]:scale-100"
  title={isSaving ? 'Saving...' : 'Save File'}
>
  {isSaving ? (
    <Loader2 className="size-4 animate-spin" />
  ) : (
    <Save className="size-4" />
  )}
</Button>
```

#### Destructive Action Buttons

Use `variant="destructive"` for dangerous operations:

```tsx
<Button
  onClick={handleDelete}
  variant="destructive"
  size="sm"
  className="size-7 p-0 [&_svg]:transform-gpu [&_svg]:scale-100"
  title="Delete File"
>
  <Trash2 className="size-4" />
</Button>
```

## Layout Patterns

### Toolbar Layout

Standard toolbar pattern for consistent spacing and alignment:

```tsx
<div className="flex h-12 items-center justify-between border-b px-4">
  {/* Left section */}
  <div className="flex items-center gap-2">
    <Button>Action 1</Button>
    <Separator orientation="vertical" className="h-6" />
    <Button>Action 2</Button>
  </div>

  {/* Center section (optional) */}
  <div className="flex items-center gap-2">
    <span>Title</span>
  </div>

  {/* Right section */}
  <div className="flex items-center gap-2">
    <Button>Action 3</Button>
    <Button>Action 4</Button>
  </div>
</div>
```

**Key patterns**:
- Fixed height: `h-12` (48px standard toolbar height)
- Horizontal padding: `px-4` (consistent with app)
- Gap between items: `gap-2` (8px)
- Items centered vertically: `items-center`

### Panel Visibility Pattern

Use CSS classes instead of conditional rendering to preserve state:

```tsx
// ✅ GOOD: Preserves panel state when toggled
<ResizablePanel
  className={cn(
    'border-r bg-background',
    !frontmatterPanelVisible && 'hidden'
  )}
>
  <FrontmatterPanel />
</ResizablePanel>

// ❌ BAD: Unmounts component, loses state
{frontmatterPanelVisible && (
  <ResizablePanel>
    <FrontmatterPanel />
  </ResizablePanel>
)}
```

**Why**: Stateful components (like ResizablePanel) lose their state when unmounted. Using CSS `hidden` class keeps component mounted but invisible.

## Form Patterns

### Direct Store Pattern (CRITICAL)

**Background**: React Hook Form + Zustand causes infinite render loops in our architecture.

**Solution**: Components access store directly without callback props.

```tsx
// ✅ CORRECT: Direct store access
const StringField: React.FC<StringFieldProps> = ({
  name,
  label,
  required,
}) => {
  const { frontmatter, updateFrontmatterField } = useEditorStore()

  return (
    <FieldWrapper label={label} required={required}>
      <Input
        value={frontmatter[name] || ''}
        onChange={e => updateFrontmatterField(name, e.target.value)}
      />
    </FieldWrapper>
  )
}

// ❌ WRONG: Callback prop pattern causes loops
const BadField: React.FC<{ onChange: (value: string) => void }> = ({
  onChange,
}) => {
  return <Input onChange={e => onChange(e.target.value)} />
}
```

📖 **See [form-patterns.md](./form-patterns.md) for comprehensive form implementation guidance**

### Field Wrapper Pattern

Consistent field labeling across all form inputs:

```tsx
<FieldWrapper label="Title" required={true}>
  <Input value={title} onChange={handleChange} />
</FieldWrapper>
```

The `FieldWrapper` component:
- Displays label with required indicator
- Provides consistent spacing
- Handles help text/descriptions
- Manages error states

## Animation Patterns

### Hover Animations

Subtle hover effects for interactive elements:

```tsx
<Button className="transition-colors hover:bg-accent hover:text-accent-foreground">
  Hover me
</Button>
```

### Focus Animations

Accessibility-focused visual feedback:

```tsx
<Input className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
```

### Loading Spinners

Consistent loading indicators:

```tsx
import { Loader2 } from 'lucide-react'

<Loader2 className="size-4 animate-spin" />
```

## Color and Theming Patterns

### Using CSS Variables

Astro Editor uses CSS variables for theming:

```tsx
// ✅ GOOD: Uses theme variables
<div className="bg-background text-foreground">
  Content
</div>

// ❌ BAD: Hardcoded colors
<div className="bg-white text-black">
  Content
</div>
```

**Available CSS variables**:
- `--background`: Main background
- `--foreground`: Main text color
- `--accent`: Accent color (hover states)
- `--muted`: Muted backgrounds
- `--border`: Border colors
- See [color-system.md](./color-system.md) for complete list

### Dark Mode Support

All components automatically support dark mode via CSS variables:

```tsx
// No special handling needed - colors adjust automatically
<div className="bg-background border border-border">
  This works in both light and dark mode
</div>
```

## Accessibility Patterns

### Keyboard Navigation

Ensure all interactive elements are keyboard accessible:

```tsx
// ✅ GOOD: Native button with keyboard support
<Button onClick={handleClick}>
  Action
</Button>

// ❌ BAD: Div with click handler, no keyboard support
<div onClick={handleClick}>
  Action
</div>
```

### ARIA Labels

Provide descriptive labels for screen readers:

```tsx
<Button
  onClick={handleClose}
  aria-label="Close dialog"
>
  <X className="size-4" />
</Button>
```

### Focus Management

Manage focus for dialogs and modals:

```tsx
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    {/* Focus automatically moves to dialog when opened */}
    <DialogTitle>Preferences</DialogTitle>
    <DialogDescription>
      Configure your editor settings
    </DialogDescription>
  </DialogContent>
</Dialog>
```

## Performance Patterns

### Memoization

Use React.memo for expensive components:

```tsx
import { memo } from 'react'

export const ExpensiveComponent = memo(({ data }) => {
  // Heavy rendering logic
  return <div>{/* ... */}</div>
})
```

### Avoiding Re-renders

Use CSS for visibility instead of conditional rendering:

```tsx
// ✅ GOOD: No re-render when toggled
<div className={cn('panel', !visible && 'hidden')}>
  <ExpensiveComponent />
</div>

// ❌ BAD: Re-renders every toggle
{visible && <ExpensiveComponent />}
```

📖 **See [performance-patterns.md](./performance-patterns.md) for comprehensive performance optimization**

## Future Pattern Sections

As the application grows, consider documenting these patterns:

### Dialog Patterns
- Standard dialog layouts
- Confirmation dialogs
- Form dialogs
- Multi-step wizards

### Menu Patterns
- Context menus
- Dropdown menus
- Command menus

### Toast Notification Patterns
- Success/error/info variants
- Action toasts
- Persistent notifications

### Loading State Patterns
- Skeleton screens
- Progress indicators
- Suspense boundaries

### Error State Patterns
- Error boundaries
- Empty states
- Fallback UI

## Quick Reference

### Icon Button Template

```tsx
<Button
  onClick={handleAction}
  disabled={!isAvailable}
  variant="ghost"
  size="sm"
  className="size-7 p-0 [&_svg]:transform-gpu [&_svg]:scale-100"
  title="Action Description (⌘K)"
>
  <IconComponent className="size-4" />
</Button>
```

### Form Field Template

```tsx
const { frontmatter, updateFrontmatterField } = useEditorStore()

<FieldWrapper label="Field Name" required={true}>
  <Input
    value={frontmatter[name] || ''}
    onChange={e => updateFrontmatterField(name, e.target.value)}
  />
</FieldWrapper>
```

### Toolbar Section Template

```tsx
<div className="flex h-12 items-center justify-between border-b px-4">
  <div className="flex items-center gap-2">
    {/* Left buttons */}
  </div>
  <div className="flex items-center gap-2">
    {/* Right buttons */}
  </div>
</div>
```

## Related Documentation

- [architecture-guide.md](./architecture-guide.md) - Component organization patterns
- [form-patterns.md](./form-patterns.md) - Comprehensive form implementation guide
- [color-system.md](./color-system.md) - Color tokens and theming
- [performance-patterns.md](./performance-patterns.md) - Performance optimization

---

**Remember**: Consistency is key. When implementing new UI features, check this guide first for established patterns. If you discover a new pattern or solution, document it here for future reference.
