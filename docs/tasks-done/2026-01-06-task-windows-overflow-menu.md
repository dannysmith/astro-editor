# Windows Overflow Menu

Add a three-dot overflow menu to the Windows title bar, providing access to key app functions that macOS users get via the native menu bar.

## Context

- macOS has a system menu bar (File, Edit, View) separate from the window
- Windows with `decorations: false` has no menu bar
- Windows users need a way to discover and access app functions
- Keep it minimal to match the app's distraction-free aesthetic

## Implementation

### 1. Create `WindowsMenu.tsx`

Location: `src/components/layout/unified-title-bar/WindowsMenu.tsx`

Use shadcn `DropdownMenu` components (already available). Trigger with `MoreHorizontal` icon from lucide-react.

**Menu items** (based on native menu, excluding window controls):

```
Open Project...     Ctrl+Shift+O
New File            Ctrl+N
Save                Ctrl+S
─────────────────────────────
Toggle Sidebar      Ctrl+1
Toggle Frontmatter  Ctrl+2
Enter Full Screen   F11
─────────────────────────────
Preferences...      Ctrl+,
Check for Updates...
About Astro Editor
─────────────────────────────
Exit
```

### 2. Execute Actions

**Important:** The `globalCommandRegistry` only contains editor commands (toggleBold, formatHeading, etc.), not app-level commands. App-level actions use Tauri events, which `useMenuEvents.ts` listens to. This matches how the native macOS menu works.

**Emit Tauri events for app-level actions:**

```tsx
import { emit } from '@tauri-apps/api/event'

// File operations
onClick={() => emit('menu-open-project')}
onClick={() => emit('menu-new-file')}
onClick={() => emit('menu-save')}

// View operations
onClick={() => emit('menu-toggle-sidebar')}
onClick={() => emit('menu-toggle-frontmatter')}

// App operations
onClick={() => emit('menu-preferences')}
onClick={() => emit('menu-check-updates')}
```

**Use Tauri APIs directly for window/app operations:**

```tsx
import { getCurrentWindow } from '@tauri-apps/api/window'
import { exit } from '@tauri-apps/plugin-process'
import { message } from '@tauri-apps/plugin-dialog'

// Fullscreen toggle (not just enter)
onClick={async () => {
  const window = getCurrentWindow()
  const isFullscreen = await window.isFullscreen()
  await window.setFullscreen(!isFullscreen)
}}

// About dialog (matches Rust implementation)
onClick={async () => {
  await message(
    'Astro Editor\nVersion X.X.X\n\nA native markdown editor for Astro content collections.\n\nBuilt with Tauri and React.',
    { title: 'About Astro Editor', kind: 'info' }
  )
}}

// Exit app
onClick={() => exit(0)}
```

**Note:** For the About dialog version string, either hardcode or fetch from Tauri's `app.getVersion()` API.

**Why this approach:**
- Matches native menu implementation exactly
- Single source of truth - `useMenuEvents.ts` handles all app actions
- Easy to add new items using the established event pattern

### 3. Add to Windows title bar

In `UnifiedTitleBarWindows.tsx`, add menu before the window controls:

```tsx
export const UnifiedTitleBarWindows: React.FC = () => {
  return <TitleBarToolbar rightSlot={<><WindowsMenu /><WindowsControls /></>} />
}
```

### 4. Handle disabled states

Use `isAvailable()` from commands or check store state:

```tsx
const currentFile = useEditorStore(state => state.currentFile)
const isDirty = useEditorStore(state => state.isDirty)
const selectedCollection = useProjectStore(state => state.selectedCollection)

<DropdownMenuItem disabled={!selectedCollection}>New File</DropdownMenuItem>
<DropdownMenuItem disabled={!currentFile || !isDirty}>Save</DropdownMenuItem>
```

## Notes

- Skip format commands (Bold, Italic, Headings) for simplicity - users have keyboard shortcuts
- Use `DropdownMenuShortcut` to show keyboard shortcuts
- Match existing button styling in title bar

## Gotchas to Watch

1. **Event names must match exactly** - Verified: `menu-open-project`, `menu-new-file`, `menu-save`, `menu-toggle-sidebar`, `menu-toggle-frontmatter`, `menu-preferences`, `menu-check-updates`
2. **Plugins required** - `@tauri-apps/plugin-process` (exit) and `@tauri-apps/plugin-dialog` (about) are both installed
