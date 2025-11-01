# Task: UI/UX Consistency Improvements

**Status:** Not prioritized
**Source:** UI-UX-REVIEW.md
**Estimated Effort:** 2-3 hours

## Overview

Address minor UI/UX inconsistencies identified in the comprehensive codebase review. Focus on using Tailwind v4 + shadcn/ui idioms properly, particularly for color system integration.

## Primary Tasks

### 1. Fix Heading Color Pattern (Issue #3)

**Problem:** Headings use explicit `text-gray-900 dark:text-white` overrides that were added to fix a dark mode bug where semantic tokens weren't working properly.

**Root Cause:** Either CSS variable configuration issue or semantic token not properly defined for dark mode.

**Goal:** Use semantic color tokens properly instead of manual overrides.

**Approach:**

1. Investigate why `text-foreground` wasn't working in dark mode originally
2. Fix CSS variable definitions if needed:
   ```css
   :root {
     --foreground: 0 0% 10%;
   }

   .dark {
     --foreground: 0 0% 90%;  /* Light text for dark mode */
   }
   ```
3. Consider adding `--heading` variable if headings need more contrast than body text:
   ```css
   :root {
     --heading: 0 0% 5%;      /* Darker than foreground */
   }

   .dark {
     --heading: 0 0% 98%;     /* Lighter than foreground */
   }
   ```
4. Replace all instances of `text-gray-900 dark:text-white` with semantic tokens
5. Test thoroughly in both light and dark modes

**Affected Files:**
- `src/components/preferences/panes/GeneralPane.tsx:28`
- `src/components/preferences/panes/ProjectSettingsPane.tsx`
- `src/components/preferences/panes/CollectionSettingsPane.tsx`
- Dialog headers and section titles (~3-4 files)

**Warning:** This may revert the original fix. Ensure the underlying CSS variable issue is properly resolved first.

---

### 2. Add Custom Utilities for Status Colors (Issue #1)

**Problem:** Using bracket notation `text-[var(--color-*)]` in 8 locations creates inconsistent pattern with rest of Tailwind usage.

**Goal:** Create proper Tailwind utilities for custom status colors following shadcn pattern.

**Implementation:**

Add to `src/App.css`:

```css
@layer utilities {
  /* Status text colors */
  .text-draft { color: hsl(var(--color-draft)); }
  .text-required { color: hsl(var(--color-required)); }
  .text-warning { color: hsl(var(--color-warning)); }

  /* Status background colors */
  .bg-draft { background-color: var(--color-draft-bg); }
  .bg-warning { background-color: var(--color-warning-bg); }
}
```

**Replace bracket notation:**

```tsx
// Before
<span className="text-[var(--color-required)]">*</span>
<div className="bg-[var(--color-draft-bg)]" />
<span className="text-[hsl(var(--color-draft))]" />

// After
<span className="text-required">*</span>
<div className="bg-draft" />
<span className="text-draft" />
```

**Affected Files:**
- `src/components/frontmatter/fields/FieldWrapper.tsx:48`
- `src/components/layout/LeftSidebar.tsx:273, 339, 352`
- `src/components/layout/StatusBar.tsx:33`
- `src/components/layout/Layout.tsx:77`
- `src/components/editor/MainEditor.tsx:23`
- `src/components/layout/UnifiedTitleBar.tsx:96`

**Impact:** More idiomatic Tailwind, better consistency, improved maintainability.

---

## Secondary Tasks (Quick Wins)

### 3. Standardize Button Icon Sizes (Issue #2)

**Problem:** Toolbar icon buttons use inconsistent sizes (`size-6` vs `size-7`).

**Solution:** Standardize all toolbar icon buttons to `size-7` (28px) for better touch targets.

**Pattern:**
```tsx
<Button
  variant="ghost"
  size="sm"
  className="size-7 p-0 [&_svg]:transform-gpu [&_svg]:scale-100"
>
  <Icon className="size-4" />
</Button>
```

**Affected Files:**
- `src/components/layout/LeftSidebar.tsx:282` - Update `size-6` to `size-7`
- `src/components/layout/UnifiedTitleBar.tsx` - Already correct at `size-7`

**Effort:** 5 minutes

---

### 4. Standardize Info Box Styling (Issue #4)

**Problem:** Similar informational sections use different background/border patterns.

**Solution:** Standardize to Pattern 1 (already used in GeneralPane):

```tsx
<div className="rounded-lg border bg-muted/50 p-4 mb-6">
  <h2 className="text-base font-semibold mb-1 text-gray-900 dark:text-white">
    {title}
  </h2>
  <p className="text-sm text-muted-foreground">
    {description}
  </p>
</div>
```

**Pattern provides:**
- Subtle visual separation
- Works well in both light and dark modes
- Consistent with existing canonical example

**Affected Files:** Search for info box patterns in preference panes and dialogs (~4-5 instances)

**Effort:** 15 minutes

---

### 5. Extract SettingsSection Component (Issue #5)

**Problem:** `SettingsSection` component is defined inline in `GeneralPane.tsx:22-35` but could be reused across all preference panes.

**Solution:** Extract to `src/components/preferences/SettingsSection.tsx`:

```tsx
import React from 'react'
import { Separator } from '@/components/ui/separator'
import { FieldGroup } from '@/components/ui/field'

interface SettingsSectionProps {
  title: string
  children: React.ReactNode
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  children
}) => (
  <div className="space-y-4">
    <div>
      <h3 className="text-lg font-medium text-foreground">
        {title}
      </h3>
      <Separator className="mt-2" />
    </div>
    <FieldGroup>{children}</FieldGroup>
  </div>
)
```

**Update imports in:**
- `src/components/preferences/panes/GeneralPane.tsx`
- `src/components/preferences/panes/ProjectSettingsPane.tsx`
- `src/components/preferences/panes/CollectionSettingsPane.tsx`

**Benefit:** DRY principle, consistent section styling, reusability.

**Effort:** 15 minutes

---

## Implementation Order

1. **Phase 1 (Core Color System)** - ~1 hour
   - Task #2: Add status color utilities (addresses 8 locations)
   - Task #1: Fix heading color pattern properly (addresses ~7 locations)
   - Test thoroughly in both light and dark modes

2. **Phase 2 (Quick Consistency Wins)** - ~30 minutes
   - Task #3: Standardize button sizes (2 files)
   - Task #4: Standardize info boxes (4-5 instances)

3. **Phase 3 (Component Extraction)** - ~30 minutes
   - Task #5: Extract SettingsSection component (3 files)

## Testing Checklist

After implementation:

- [ ] Test all affected components in light mode
- [ ] Test all affected components in dark mode
- [ ] Verify heading contrast is sufficient in both modes
- [ ] Verify status colors (draft, required, warning) display correctly
- [ ] Check button sizes are visually consistent
- [ ] Ensure info boxes have uniform appearance
- [ ] Run `pnpm run check:all`
- [ ] Visual regression check of preferences panes
- [ ] Visual regression check of editor UI

## Notes

- **Critical:** For Task #1, investigate the original dark mode bug before reverting. May need to fix CSS variables first.
- These are all low-risk, high-value improvements
- No architectural changes required
- All changes follow existing patterns more idiomatically
- Combined impact: cleaner code, better maintainability, consistent UX

## Reference

See `UI-UX-REVIEW.md` for complete analysis and additional context.
