# Requirements: Support MDX Insertion of Framework Components

## Executive Summary

Extend the Component Builder Dialog (Cmd+/) to support insertion of React, Vue, and Svelte components in addition to currently supported .astro components. Users will be able to insert framework components into their MDX files with the same seamless experience: search, select, configure props, and insert with tab stops.

**Scope**: React (.tsx, .jsx), Vue (.vue), and Svelte (.svelte) support with framework badges in the component list.

## Background & Current State

### What Works Today (Astro Components Only)

The current system provides a two-step insertion flow:

1. **Discovery**: Rust backend (`src-tauri/src/commands/mdx_components.rs`) recursively scans the MDX components directory (default: `src/components/mdx`, configurable in project settings)
2. **Parsing**: Extracts component metadata from `.astro` files:
   - Component name from filename
   - Props from `interface Props` in frontmatter (between `---` separators)
   - Detects `<slot />` presence for children support
3. **Selection**: User searches/selects component in dialog
4. **Configuration**: User toggles optional props on/off
5. **Insertion**: Generates JSX snippet with tab stops and inserts at cursor

**Key Technical Facts:**
- Backend: `scan_mdx_components` Rust command (mdx_components.rs:35-95)
- Prop parsing: TypeScript AST via SWC parser (mdx_components.rs:146-172)
- **Subdirectories already supported** ✓ - recursive `WalkDir` with no depth limit
- File filtering: Hardcoded to `.astro` extension only (mdx_components.rs:62)
- Security: Path traversal protection for all file operations
- Frontend: Framework-agnostic - uses generic `MdxComponent` interface

### The Good News

**MDX insertion syntax is identical across all frameworks** - it's just JSX!

```jsx
// All frameworks use the same syntax
<Alert variant="warning" />
<Alert variant="warning">Content here</Alert>
```

This means no changes needed to `snippet-builder.ts` or `insertSnippet.ts`.

## The Challenge: Framework-Specific Prop Parsing

Each framework defines component props differently:

### Astro (.astro) - Current Implementation ✓
```astro
---
interface Props {
  variant: 'info' | 'warning'
  message?: string
}
---
<div>{message}</div>
<slot />
```

### React/Preact (.tsx, .jsx)
```typescript
// Pattern 1: Inline types (most common)
function Button({ variant, size }: {
  variant: 'primary' | 'secondary'
  size?: 'sm' | 'md'
}) { ... }

// Pattern 2: Separate interface
interface ButtonProps {
  variant: 'primary' | 'secondary'
  size?: 'sm' | 'md'
}
function Button({ variant, size }: ButtonProps) { ... }

// Pattern 3: React.FC (legacy)
const Button: React.FC<ButtonProps> = ({ variant, size }) => { ... }
```

**Implementation Decision**: Parse common patterns only (inline types, simple interfaces). Skip complex patterns like `React.ComponentProps<'div'> & VariantProps<...>` for MVP.

### Vue (.vue)
```vue
<script setup lang="ts">
// Composition API (modern)
const props = defineProps<{
  variant: 'info' | 'warning'
  message?: string
}>()
</script>

<template>
  <div>{{ message }}</div>
  <slot />
</template>
```

**Implementation Decision**: Support Composition API `defineProps<{...}>()` pattern. Options API can be added later if needed.

### Svelte (.svelte)
```svelte
<script lang="ts">
  export let variant: 'info' | 'warning'
  export let message: string | undefined = undefined
</script>

<div>{message}</div>
<slot />
```

**Implementation Decision**: Parse `export let` statements with TypeScript type annotations.

## Implementation Plan

### Phase 1: Backend - Rust Changes

**File**: `src-tauri/src/commands/mdx_components.rs`

#### 1.1 Add Framework Detection

```rust
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "lowercase")]
enum ComponentFramework {
    Astro,
    React,
    Vue,
    Svelte,
}

fn detect_framework(path: &Path) -> ComponentFramework {
    match path.extension().and_then(|s| s.to_str()) {
        Some("astro") => ComponentFramework::Astro,
        Some("tsx" | "jsx") => ComponentFramework::React,
        Some("vue") => ComponentFramework::Vue,
        Some("svelte") => ComponentFramework::Svelte,
        _ => ComponentFramework::Astro, // fallback
    }
}
```

#### 1.2 Update File Filtering (line 62)

```rust
// Current: Only .astro
if path.extension().and_then(|s| s.to_str()) != Some("astro")

// New: Support multiple extensions
let ext = path.extension().and_then(|s| s.to_str());
if !matches!(ext, Some("astro" | "tsx" | "jsx" | "vue" | "svelte"))
```

#### 1.3 Add Framework Field to MdxComponent Model

**File**: `src-tauri/src/models/mdx_component.rs`

```rust
pub struct MdxComponent {
    pub name: String,
    pub file_path: String,
    pub props: Vec<PropInfo>,
    pub has_slot: bool,
    pub description: Option<String>,
    pub framework: ComponentFramework, // NEW
}
```

#### 1.4 Implement Framework-Specific Parsers

**Main dispatcher** (modify `scan_mdx_components`):
```rust
let framework = detect_framework(&path);
let component = match framework {
    ComponentFramework::Astro => parse_astro_component(&path)?,
    ComponentFramework::React => parse_react_component(&path)?,
    ComponentFramework::Vue => parse_vue_component(&path)?,
    ComponentFramework::Svelte => parse_svelte_component(&path)?,
};
```

**New functions to implement**:

1. **`parse_react_component()`** (~100 lines)
   - Parse file as TypeScript AST using SWC (already in use)
   - Find function/arrow function declarations
   - Look for type annotations on first parameter:
     - Inline: `({ prop }: { prop: Type })` → extract inline type object
     - Interface: `({ prop }: PropsInterface)` → find interface definition
   - Extract prop names, types, optional flags (`?`)
   - Detect `children` prop → set `has_slot = true`
   - If parsing fails: Return component with empty props array

2. **`parse_vue_component()`** (~80 lines)
   - Split file into sections (`<script>`, `<template>`)
   - Parse `<script>` section for `defineProps<{ ... }>()`
   - Use regex or simple TypeScript parsing to extract type object
   - Extract prop names, types, optional flags
   - Search `<template>` section for `<slot>` or `<slot />` → set `has_slot = true`
   - If parsing fails: Return component with empty props array

3. **`parse_svelte_component()`** (~80 lines)
   - Parse `<script>` section
   - Find all `export let propName: Type` statements
   - Extract prop names and types
   - Detect optional by checking for `= defaultValue` or `| undefined`
   - Search markup for `<slot>` or `<slot />` → set `has_slot = true`
   - If parsing fails: Return component with empty props array

**Graceful Degradation Strategy**: If any parser fails (malformed component, unsupported pattern), return the component with:
- Extracted name from filename
- Empty props array (`[]`)
- `has_slot: false`
- Framework type

This allows users to see and insert the component, even if props weren't detected. They can manually add props after insertion.

### Phase 2: Frontend - TypeScript Changes

#### 2.1 Update TypeScript Interface

**File**: `src/hooks/queries/useMdxComponentsQuery.ts`

```typescript
export interface MdxComponent {
  name: string
  file_path: string
  props: PropInfo[]
  has_slot: boolean
  description?: string | null
  framework: 'astro' | 'react' | 'vue' | 'svelte' // NEW
}
```

#### 2.2 Create Framework Icon Component

**New File**: `src/components/icons/FrameworkIcon.tsx`

Create a reusable component with inline SVG icons for each framework:

```tsx
interface FrameworkIconProps {
  framework: 'astro' | 'react' | 'vue' | 'svelte'
  className?: string
}

export function FrameworkIcon({ framework, className = "h-3 w-3" }: FrameworkIconProps) {
  const icons = {
    react: (
      <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M14.23 12.004a2.236 2.236 0 0 1-2.235 2.236 2.236 2.236 0 0 1-2.236-2.236 2.236 2.236 0 0 1 2.235-2.236 2.236 2.236 0 0 1 2.236 2.236zm2.648-10.69c-1.346 0-3.107.96-4.888 2.622-1.78-1.653-3.542-2.602-4.887-2.602-.41 0-.783.093-1.106.278-1.375.793-1.683 3.264-.973 6.365C1.98 8.917 0 10.42 0 12.004c0 1.59 1.99 3.097 5.043 4.03-.704 3.113-.39 5.588.988 6.38.32.187.69.275 1.102.275 1.345 0 3.107-.96 4.888-2.624 1.78 1.654 3.542 2.603 4.887 2.603.41 0 .783-.09 1.106-.275 1.374-.792 1.683-3.263.973-6.365C22.02 15.096 24 13.59 24 12.004c0-1.59-1.99-3.097-5.043-4.032.704-3.11.39-5.587-.988-6.38-.318-.184-.688-.277-1.092-.278zm-.005 1.09v.006c.225 0 .406.044.558.127.666.382.955 1.835.73 3.704-.054.46-.142.945-.25 1.44-.96-.236-2.006-.417-3.107-.534-.66-.905-1.345-1.727-2.035-2.447 1.592-1.48 3.087-2.292 4.105-2.295zm-9.77.02c1.012 0 2.514.808 4.11 2.28-.686.72-1.37 1.537-2.02 2.442-1.107.117-2.154.298-3.113.538-.112-.49-.195-.970-.254-1.42-.23-1.868.054-3.32.714-3.707.19-.09.4-.127.563-.132zm4.882 3.05c.455.468.91.992 1.36 1.564-.44-.02-.89-.034-1.345-.034-.46 0-.915.01-1.36.034.44-.572.895-1.096 1.345-1.565zM12 8.1c.74 0 1.477.034 2.202.093.406.582.802 1.203 1.183 1.86.372.64.71 1.29 1.018 1.946-.308.655-.646 1.31-1.013 1.95-.38.66-.773 1.288-1.18 1.87-.728.063-1.466.098-2.21.098-.74 0-1.477-.035-2.202-.093-.406-.582-.802-1.204-1.183-1.86-.372-.64-.71-1.29-1.018-1.946.303-.657.646-1.313 1.013-1.954.38-.66.773-1.286 1.18-1.868.728-.064 1.466-.098 2.21-.098zm-3.635.254c-.24.377-.48.763-.704 1.16-.225.39-.435.782-.635 1.174-.265-.656-.49-1.31-.676-1.947.64-.15 1.315-.283 2.015-.386zm7.26 0c.695.103 1.365.23 2.006.387-.18.632-.405 1.282-.66 1.933-.2-.39-.41-.783-.64-1.174-.225-.392-.465-.774-.705-1.146zm3.063.675c.484.15.944.317 1.375.498 1.732.74 2.852 1.708 2.852 2.476-.005.768-1.125 1.74-2.857 2.475-.42.18-.88.342-1.355.493-.28-.958-.646-1.956-1.1-2.98.45-1.017.81-2.01 1.085-2.964zm-13.395.004c.278.96.645 1.957 1.1 2.98-.45 1.017-.812 2.01-1.086 2.964-.484-.15-.944-.318-1.37-.5-1.732-.737-2.852-1.706-2.852-2.474 0-.768 1.12-1.742 2.852-2.476.42-.18.88-.342 1.356-.494zm11.678 4.28c.265.657.49 1.312.676 1.948-.64.157-1.316.29-2.016.39.24-.375.48-.762.705-1.158.225-.39.435-.788.636-1.18zm-9.945.02c.2.392.41.783.64 1.175.23.39.465.772.705 1.143-.695-.102-1.365-.23-2.006-.386.18-.63.406-1.282.66-1.933zM17.92 16.32c.112.493.2.968.254 1.423.23 1.868-.054 3.32-.714 3.708-.147.09-.338.128-.563.128-1.012 0-2.514-.807-4.11-2.28.686-.72 1.37-1.536 2.02-2.44 1.107-.118 2.154-.3 3.113-.54zm-11.83.01c.96.234 2.006.415 3.107.532.66.905 1.345 1.727 2.035 2.446-1.595 1.483-3.092 2.295-4.11 2.295-.22-.005-.406-.05-.553-.132-.666-.38-.955-1.834-.73-3.703.054-.46.142-.944.25-1.438zm4.56.64c.44.02.89.034 1.345.034.46 0 .915-.01 1.36-.034-.44.572-.895 1.095-1.345 1.565-.455-.47-.91-.993-1.36-1.565z"/>
      </svg>
    ),
    vue: (
      <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M24 1.61h-4.68l-7.32 12.64L4.68 1.61H0L12 22.39 24 1.61M18.92 1.61h-3.73L12 7.44l-3.19-5.83H5.08l6.92 12.02 6.92-12.02z"/>
      </svg>
    ),
    svelte: (
      <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M10.354 21.125a4.44 4.44 0 0 1-4.765-1.767 4.109 4.109 0 0 1-.703-3.107 3.898 3.898 0 0 1 .134-.522l.105-.321.287.21a7.21 7.21 0 0 0 2.186 1.092l.208.063-.02.208a1.253 1.253 0 0 0 .226.83 1.337 1.337 0 0 0 1.435.533 1.231 1.231 0 0 0 .343-.15l5.59-3.562a1.164 1.164 0 0 0 .524-.778 1.242 1.242 0 0 0-.211-.937 1.338 1.338 0 0 0-1.435-.533 1.23 1.23 0 0 0-.343.15l-2.133 1.36a4.078 4.078 0 0 1-1.135.499 4.44 4.44 0 0 1-4.765-1.766 4.108 4.108 0 0 1-.702-3.108 3.855 3.855 0 0 1 1.742-2.582l5.589-3.563a4.072 4.072 0 0 1 1.135-.499 4.44 4.44 0 0 1 4.765 1.767 4.109 4.109 0 0 1 .703 3.107 3.943 3.943 0 0 1-.134.522l-.105.321-.286-.21a7.204 7.204 0 0 0-2.187-1.093l-.208-.063.02-.207a1.255 1.255 0 0 0-.226-.831 1.337 1.337 0 0 0-1.435-.532 1.231 1.231 0 0 0-.343.15L8.62 9.368a1.162 1.162 0 0 0-.524.778 1.24 1.24 0 0 0 .211.937 1.338 1.338 0 0 0 1.435.533 1.235 1.235 0 0 0 .344-.15l2.132-1.36a4.067 4.067 0 0 1 1.135-.499 4.44 4.44 0 0 1 4.765 1.767 4.109 4.109 0 0 1 .703 3.107 3.857 3.857 0 0 1-1.742 2.583l-5.589 3.562a4.072 4.072 0 0 1-1.135.499z"/>
      </svg>
    ),
    astro: (
      <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M16.074 16.86c-.72.616-2.157.95-3.123.95-1.022 0-1.71-.304-2.292-.98l-3.74 6.043c-.253.397-.623.625-1.042.625-.738 0-1.337-.589-1.337-1.315 0-.143.023-.287.082-.43l6.854-16.767c.117-.285.293-.476.513-.608.22-.132.477-.199.752-.199.275 0 .532.067.752.199.22.132.396.323.513.608l6.854 16.767c.059.143.082.287.082.43 0 .726-.599 1.315-1.337 1.315-.42 0-.79-.228-1.042-.625l-3.74-6.043zm-.635-5.785L12 3.59l-3.439 7.485h6.878z"/>
      </svg>
    ),
  }

  return icons[framework]
}
```

**Rationale**: Lucide doesn't have framework-specific brand logos. Using inline SVG paths keeps the bundle small and ensures the icons always render correctly. The component is placed in a shared `icons/` directory so it can be reused elsewhere in the application (e.g., file lists, settings, project info).

#### 2.3 Add Framework Badges to Component List

**File**: `src/components/component-builder/ComponentBuilderDialog.tsx` (lines 190-210)

Import the FrameworkIcon component and update the CommandItem:

```tsx
import { FrameworkIcon } from '../icons/FrameworkIcon'

// ... in the component list:
<CommandItem
  key={component.name}
  value={component.name}
  onSelect={() => selectComponent(component)}
  className="cursor-pointer"
>
  <div className="flex flex-col">
    <div className="flex items-center gap-2">
      <span>{component.name}</span>
      <Badge variant="outline" className="text-xs flex items-center gap-1">
        <FrameworkIcon framework={component.framework} />
        {component.framework}
      </Badge>
    </div>
    {component.description && (
      <span className="text-xs text-muted-foreground">
        {component.description}
      </span>
    )}
    <span className="text-xs text-muted-foreground">
      {component.props.length === 0
        ? 'No props detected'
        : `${component.props.length} props`}
      {component.has_slot && ' + slot'}
    </span>
  </div>
</CommandItem>
```

**Optional Enhancement - Colored Badges**:

Add framework-specific colors to badges for better visual distinction:

```tsx
const frameworkColors = {
  astro: 'text-orange-600 dark:text-orange-400',
  react: 'text-blue-600 dark:text-blue-400',
  vue: 'text-green-600 dark:text-green-400',
  svelte: 'text-red-600 dark:text-red-400',
}

<Badge
  variant="outline"
  className={cn("text-xs flex items-center gap-1", frameworkColors[component.framework])}
>
  <FrameworkIcon framework={component.framework} />
  {component.framework}
</Badge>
```

### Phase 3: Children/Slot Detection Strategy

**Framework-specific approach**:

- **Astro**: Check for `<slot />` in markup (current implementation ✓)
- **React/Preact/SolidJS**: Check for `children` prop in type definition
  - Standard React pattern: `children?: ReactNode`
  - Alternative: `children?: JSX.Element`
- **Vue**: Check for `<slot>` or `<slot />` in `<template>` section
- **Svelte**: Check for `<slot>` or `<slot />` in markup

**Recommendation**: Use prop-based detection for React (check `children` prop) and markup-based detection for Vue/Svelte (search for `<slot>`). This is consistent with framework conventions and what developers expect.

### Phase 4: Testing Strategy

#### Unit Tests (Rust)

Create test fixtures in `src-tauri/src/commands/mdx_components.rs`:

```rust
#[cfg(test)]
mod tests {
    #[test]
    fn test_parse_react_inline_types() {
        // Test: function Button({ variant }: { variant: string }) {}
    }

    #[test]
    fn test_parse_react_interface() {
        // Test: interface Props { variant: string }
    }

    #[test]
    fn test_parse_react_optional_props() {
        // Test: { variant?: string }
    }

    #[test]
    fn test_parse_react_children() {
        // Test: { children?: ReactNode } → has_slot = true
    }

    #[test]
    fn test_parse_vue_define_props() {
        // Test: defineProps<{ variant: string }>()
    }

    #[test]
    fn test_parse_vue_slot_detection() {
        // Test: <slot /> in template
    }

    #[test]
    fn test_parse_svelte_export_let() {
        // Test: export let variant: string
    }

    #[test]
    fn test_scan_mixed_components() {
        // Test: Directory with .astro, .tsx, .vue, .svelte files
        // Verify all are detected with correct frameworks
    }

    #[test]
    fn test_graceful_degradation() {
        // Test: Malformed component returns empty props
    }
}
```

#### Integration Testing

Manual testing with real Astro project:
1. Create test fixtures: `src/components/mdx/test/Button.tsx`, `Alert.vue`, `Card.svelte`
2. Open project in Astro Editor
3. Open MDX file, press Cmd+/
4. Verify all components appear with correct framework badges
5. Select each component type and verify props are detected
6. Test insertion and tab stop navigation
7. Test components with children/slots

### Implementation Order

**Week 1-2: React Support**
1. Add framework detection enum and file filtering
2. Implement `parse_react_component()` for inline types and simple interfaces
3. Add unit tests for React parser
4. Add `framework` field to models (Rust + TypeScript)
5. Test with real React components

**Week 3: Vue Support**
1. Implement `parse_vue_component()` for Composition API
2. Add unit tests for Vue parser
3. Test with real Vue components

**Week 4: Svelte Support + UI Polish**
1. Implement `parse_svelte_component()`
2. Add unit tests for Svelte parser
3. Add framework badges to UI
4. Test with real Svelte components
5. End-to-end testing with mixed component types

## Technical Architecture

### Data Flow

```
User presses Cmd+/ in MDX file
       ↓
ComponentBuilderDialog opens
       ↓
useMdxComponentsQuery hook
       ↓
Tauri invoke('scan_mdx_components')
       ↓
Rust: Walk directory recursively
       ↓
For each file: detect_framework() → parse_{framework}_component()
       ↓
Return MdxComponent[] with framework field
       ↓
Frontend displays components with badges
       ↓
User selects component → configure step
       ↓
User toggles props → insert
       ↓
snippet-builder.ts generates JSX
       ↓
insertSnippet() inserts into CodeMirror editor
```

### Security Considerations

- Maintain existing path traversal protection (`validate_project_path`)
- All file operations stay within project bounds
- No execution of component code - only static AST parsing
- SWC parser is memory-safe (Rust)

### Performance Considerations

- **Caching**: 5-minute query cache already in place (useMdxComponentsQuery.ts:38)
- **Invalidation**: File watcher invalidates cache on changes
- **Parsing overhead**: SWC is fast (~10-50ms per file on M1 Mac)
- **Expected load**: Most projects have 10-50 MDX components
- **Optimization opportunity**: Could lazy-parse (only when component selected), but likely unnecessary for MVP

## Risks & Mitigation

### Risk 1: Parser Complexity
**Impact**: Parsers may not handle all prop patterns correctly

**Mitigation**:
- Start with common patterns only (80% coverage)
- Graceful degradation: Show component with empty props if parsing fails
- Users can still insert and manually add props
- Comprehensive test suite for supported patterns

### Risk 2: Framework API Changes
**Impact**: Future framework versions may change prop definition syntax

**Mitigation**:
- Document supported patterns in user-facing docs
- Parser updates can be released independently
- Users can report unsupported patterns as enhancement requests

### Risk 3: Performance with Large Libraries
**Impact**: Scanning 100+ components could be slow

**Mitigation**:
- Existing 5-minute cache handles this
- File watcher ensures fresh data without re-scanning
- Can add lazy parsing if needed (unlikely)

### Risk 4: False Negatives in Prop Detection
**Impact**: Parser might miss props or get types wrong

**Mitigation**:
- Test with real-world components (shadcn/ui, popular libraries)
- Show "No props detected" for failed parsing
- User can still insert component manually
- Iterate based on user feedback

## Success Criteria

### Must Have ✓
- [x] React/TSX components (.tsx, .jsx) appear in component list
- [x] Vue components (.vue) appear in component list
- [x] Svelte components (.svelte) appear in component list
- [x] Props extracted from common patterns (inline types, simple interfaces, defineProps, export let)
- [x] Children/slot support detected correctly for each framework
- [x] Framework badges with icons displayed in component list
- [x] Tab stops and prop toggling work correctly
- [x] No breaking changes to existing Astro component support
- [x] Subdirectory support works for all component types
- [x] Graceful degradation: Components with parsing errors shown with "No props detected"

### Should Have
- [x] Comprehensive test coverage for all parsers
- [ ] Documentation of supported prop patterns per framework
- [ ] User feedback mechanism for unsupported patterns

### Nice to Have
- [ ] Colored framework badges (currently optional in implementation - can add colored variants)
- [ ] Support for complex TypeScript patterns (intersection types, React.ComponentProps)
- [ ] Options API support for Vue
- [ ] SolidJS support (.tsx with Solid-specific patterns)
- [ ] Performance optimizations (lazy parsing, virtualized list for 100+ components)

## Code Estimate

**Rust Backend**:
- Framework detection: ~30 lines
- React parser: ~100-120 lines
- Vue parser: ~80-100 lines
- Svelte parser: ~80-100 lines
- Tests: ~200-300 lines
- **Total**: ~500-650 lines

**TypeScript Frontend**:
- Interface update: ~5 lines
- FrameworkIcon component: ~60 lines (inline SVGs)
- Badge UI updates: ~20-25 lines
- **Total**: ~85-90 lines

**Overall**: ~585-740 lines of new code

## Files to Modify

### Backend (Rust)
- `src-tauri/src/commands/mdx_components.rs` - Main implementation
- `src-tauri/src/models/mdx_component.rs` - Add framework field
- `src-tauri/Cargo.toml` - Ensure SWC dependencies (likely no change needed)

### Frontend (TypeScript)
- `src/hooks/queries/useMdxComponentsQuery.ts` - Update interface
- `src/components/icons/FrameworkIcon.tsx` - New file with inline SVG icons (reusable)
- `src/components/component-builder/ComponentBuilderDialog.tsx` - Import and use FrameworkIcon in badges

### Tests
- `src-tauri/src/commands/mdx_components.rs` - Comprehensive unit tests

## Next Steps

1. ✓ Review and finalize requirements
2. Begin React parser implementation
3. Add React-specific tests
4. Test with real React components from project
5. Iterate to Vue parser
6. Iterate to Svelte parser
7. Add UI badges
8. Comprehensive end-to-end testing
9. Update user documentation

---

**Document Version**: 2.0 - Finalized with decisions
**Last Updated**: Implementation-ready version
