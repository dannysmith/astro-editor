# Task: Distractionless mode

## Simpler requirements

This functionality should only happen when both sidebar and front matter panel are hidden.
If a user is typing in the editor window and they type, say, 4 characters, we should set some state which says we are in distractionless mode. When we are in distractionless mode, the unified title bar and the status bar should have their opacity set to zero. If not, they should be normal. Whenever a user mouses over the status bar or the unified title bar, we should change that state so that we are back into normal mode. This means it will stay in normal mode until the user starts typing. When they've typed four characters, it will put it back into distractionless mode again. It should be that simple to do this.

We need to take care not to cause re-renders and other problems like that when doing this.

## Original Requirements

This feature should only happen when both sidebars are closed And Only parts of the layout visible are the unified title bar, Editor and status bar.

When in this state, we've already re-styled the status bar and title bar to make them subtle. We've removed The background and made the borders transparent etc.

When a user had both sidebars hidden and they begin typing in the editor, the whole unified title bar and status bar should become invisible.
When a user moves their mouse over the unified title bar or status bar, both should reappear together and then stay there (as per normal) until they start typing again in the editor.

They should always be shown if either of the sidebars are shown.
Once a user has moused over and they've been shown, they should not disappear again if the user mouses away. They should be back in their normal state and they should only disappear again once the user has typed, so this whole thing's triggered again right?

The actual components shouldn't be removed. In other words, I should still be able to click on the title bar at the very top and be able to drag the window around. That should be possible because it should have reappeared when I move my mouse there.

I think the easiest way to do this is simply to set their opacity to zero? It's extremely important that no functionality at all is changed here. A previous attempt to solve this problem added a lot of complexity and listeners, and problems with rendering and state management. It seems to me the only state we need to store here Is whether or not the bars are currently visible. Then we need to listen for typing in the editor And set that state. The user moving their mouse over the status bar or the top should simply reset that state to its default. It would probably be good UX if we only actually set that state when the user had typed more than 3-4 characters in the editor in a short space of time. That way we won't be constantly showing and hiding this when the user is just making very quick one-character edits.

We need to think carefully about how the content is actually hidden by this state because there is potential that if the content is hidden with display:none or similar, it's not going to receive any updates it gets from elsewhere in the application when state is changed etc. This could affect things like auto-save, Toggling on and off Focus Mode via the Command Palette (which updates the button in the toolbar etc) and potentially in the future certain other things.

An attempt to solve this problem before we tried to use `isDirty` To know whether we were typing or not, which was a terrible approach because that exists only to deal with saving.

In terms of animation, I think it is suitable for the first effort here to simply have them disappear, but then we can use some CSS to have them fade away. I don't want them to slide up or down at all Because that would require moving them rather than simply making them invisible.

## Technical Implementation Plan

### Overview

We'll implement distraction-free mode by adding opacity-based hiding for the UnifiedTitleBar and StatusBar when:

1. Both sidebars are closed
2. User types in the editor (after 3-4 characters)
3. Bars reappear on mouse hover and remain visible until typing resumes

### Step-by-Step Implementation

#### 1. Add UI Store State and Logic

**File:** `src/store/uiStore.ts`

- Add new state: `distractionFreeBarsHidden: boolean` (default: false)
- Add action: `handleTypingInEditor: () => void`
  - This action checks if both panels are hidden internally
  - Only sets `distractionFreeBarsHidden: true` if conditions are met
- Add action: `setDistractionFreeBarsHidden: (hidden: boolean) => void`
  - Direct setter for mouse hover events

#### 2. Add Typing Detection to Editor

**File:** `src/components/editor/Editor.tsx`

- Create a character counter that tracks consecutive characters typed
- In the existing `EditorView.updateListener`:
  - Increment counter on each character typed
  - When counter reaches 4 characters, call a UI store action
  - Reset counter after triggering or if user stops typing for 500ms
- The editor simply reports "user is typing" - it doesn't know about sidebars

#### 3. Add Mouse Hover Detection

**Files:** `src/components/layout/UnifiedTitleBar.tsx` and `src/components/layout/StatusBar.tsx`

- Add `onMouseEnter` handlers to the root elements
- When hovered and `distractionFreeBarsHidden` is true:
  - Call `setDistractionFreeBarsHidden(false)`
  - This reveals both bars simultaneously

#### 4. Apply Opacity-Based Hiding

**Files:** `src/components/layout/UnifiedTitleBar.tsx` and `src/components/layout/StatusBar.tsx`

- Add conditional styling based on `distractionFreeBarsHidden` state:
  ```tsx
  className={cn(
    // existing classes...
    distractionFreeBarsHidden && bothPanelsHidden && 'opacity-0 transition-opacity duration-300'
  )}
  ```
- The `transition-opacity duration-300` provides smooth fade in/out

#### 5. Handle Sidebar State Changes

**File:** `src/store/uiStore.ts`

- When either sidebar is toggled to visible:
  - Automatically set `distractionFreeBarsHidden: false`
- This ensures bars always show when sidebars are open

#### 6. Handle Edge Cases

- **Window Dragging:** The title bar remains functional even when opacity is 0
- **Auto-save:** Continues working as opacity doesn't affect functionality
- **Command Palette:** Can still toggle focus mode as the button remains clickable
- **Keyboard Shortcuts:** All shortcuts continue working

### Implementation Details

#### Character Counting Logic (Editor)

```typescript
let typingCharCount = 0
let typingResetTimeout: number | null = null

// In updateListener
if (update.docChanged && !isProgrammaticUpdate.current) {
  typingCharCount++

  // Clear existing timeout
  if (typingResetTimeout) clearTimeout(typingResetTimeout)

  // Reset counter after 500ms of no typing
  typingResetTimeout = window.setTimeout(() => {
    typingCharCount = 0
  }, 500)

  // Hide bars after 4 characters
  if (typingCharCount >= 4) {
    useUIStore.getState().handleTypingInEditor()
    typingCharCount = 0
  }
}
```

#### UI Store Logic

```typescript
// In uiStore.ts
handleTypingInEditor: () => {
  const { sidebarVisible, frontmatterPanelVisible } = get()
  if (!sidebarVisible && !frontmatterPanelVisible) {
    set({ distractionFreeBarsHidden: true })
  }
}
```

#### CSS Transition

The opacity transition ensures smooth visual feedback:

- Fade out: 300ms when hiding
- Fade in: 300ms when showing on hover

### Testing Checklist

1. Close both sidebars
2. Type 4+ characters quickly → bars should fade out
3. Move mouse over title bar area → bars should fade in
4. Move mouse away → bars should remain visible
5. Type again → bars should fade out after 4 characters
6. Open a sidebar → bars should appear and stay visible
7. Test window dragging with invisible title bar
8. Verify auto-save continues working
9. Test all keyboard shortcuts work with bars hidden

### Potential Problems and Considerations

#### React-Specific Concerns

1. **Mouse Events on Opacity-0 Elements**: Elements with `opacity: 0` still receive mouse events, which is what we want. However, we need to ensure the hover detection works reliably across all browsers.

2. **Re-render Performance**: Every character typed will trigger a state update in the UI store. We should monitor if this causes performance issues, though it should be minimal since only the bars re-render.

3. **Event Listener Cleanup**: The typing detection timeout needs proper cleanup when the editor unmounts to avoid memory leaks.

#### UX Edge Cases

1. **Simultaneous Actions**: If user types and immediately moves mouse to title bar, there might be a brief flicker. The 300ms transition should minimize this.

2. **Command Palette Interaction**: When command palette opens (Cmd+K), bars should probably reappear. We may need to add: `distractionFreeBarsHidden: false` when command palette opens.

3. **Focus Loss**: If editor loses focus (e.g., user switches apps), the character counter should reset. Currently handled by the 500ms timeout, but may need explicit blur handling.

4. **Rapid Sidebar Toggling**: If user rapidly toggles sidebars while typing, the state management should handle this gracefully (current design should work).

#### Technical Considerations

1. **Character vs Change Detection**: We're counting characters, but CodeMirror's `docChanged` fires for any change (including deletions). This means backspacing counts toward the 4-character threshold, which might be unexpected.

2. **Programmatic Updates**: The `isProgrammaticUpdate` check prevents auto-save from triggering bar hiding, but we should verify this works for all programmatic changes (e.g., format commands).

3. **Window Dragging Discovery**: Users might not discover they can still drag the window when the title bar is invisible. This is acceptable for v1 as mouse hover reveals it.

#### Implementation Notes

- Start with the simplest implementation and add complexity only if needed
- The opacity approach is correct - maintains all functionality while hiding UI
- State is minimal and contained within UI store
- No need for complex event systems or listeners beyond what's proposed
