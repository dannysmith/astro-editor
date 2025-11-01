# Task: Layout Refactor

## Current Architecture Analysis

Our main application structure currently has unnecessary complexity with nested ResizablePanelGroups and duplicate components. The primary issue is that the right sidebar (FrontmatterPanel) is nested inside a ResizablePanel rather than being a sibling to the left sidebar and main editor.

## Refactor Plan

### Phase 1: Three-Panel Architecture & Component Naming

**Goal:** Implement a clean three-panel layout where left sidebar, main editor, and right sidebar are siblings.

1. **Rename Sidebar to LeftSidebar** for consistency:
   - Rename `src/components/sidebar/Sidebar.tsx` → `LeftSidebar.tsx`
   - Update all imports across the codebase
   - This creates symmetry with the new RightSidebar

2. **Update Layout.tsx structure:**

   ```tsx
   <Layout>
     <UnifiedTitleBar />
     <div className="flex-1 flex flex-col">
       <ResizablePanelGroup direction="horizontal" className="flex-1">
         <ResizablePanel>
           {' '}
           {/* Left */}
           <LeftSidebar />
         </ResizablePanel>
         <ResizableHandle />
         <ResizablePanel>
           {' '}
           {/* Center */}
           <MainEditor />
         </ResizablePanel>
         <ResizableHandle />
         <ResizablePanel>
           {' '}
           {/* Right */}
           <RightSidebar>
             <FrontmatterPanel />
           </RightSidebar>
         </ResizablePanel>
       </ResizablePanelGroup>
       <StatusBar />
     </div>
     {/* Floating components */}
   </Layout>
   ```

3. **Remove EditorAreaWithFrontmatter** - This component becomes obsolete with the new structure.

4. **Create RightSidebar component** at `src/components/layout/RightSidebar.tsx`:
   - Wrapper component for future extensibility (tabs, multiple panels)
   - Handles its own styling and layout concerns
   - Props: `children: React.ReactNode`

5. **Move StatusBar outside MainEditor**:
   - StatusBar should be a sibling to the ResizablePanelGroup
   - This makes it span the full width consistently
   - MainEditor becomes purely about editor content

6. **Directory Structure Refactor**:
   ```
   src/components/
   ├── layout/
   │   ├── Layout.tsx
   │   ├── LeftSidebar.tsx (moved from sidebar/)
   │   ├── RightSidebar.tsx (new)
   │   ├── MainEditor.tsx
   │   ├── StatusBar.tsx
   │   ├── UnifiedTitleBar.tsx
   │   └── index.ts
   ├── file-browser/ (renamed from sidebar/)
   │   └── [file browser specific components]
   └── frontmatter/
       └── [frontmatter specific components]
   ```

   - Move Sidebar.tsx to layout/LeftSidebar.tsx
   - Rename sidebar/ directory to file-browser/ for clarity
   - All layout components now live together

### Phase 2: Clean Up Duplicate Components

1. **Remove ComponentBuilderDialog from App.tsx** - It's already rendered in Layout.tsx
2. **Keep the separation of main.tsx and App.tsx** - This follows React best practices for provider hierarchy

### Phase 3: Extract Event Listeners

1. **Create custom hook** `src/hooks/useLayoutEventListeners.ts`:
   - Extract all 350+ lines of event listeners from Layout.tsx
   - Group related listeners (menu events, keyboard shortcuts, etc.)
   - Return necessary handlers and state

2. **Update Layout.tsx** to use the new hook:
   ```tsx
   const { preferencesOpen, setPreferencesOpen } = useLayoutEventListeners()
   ```

### Phase 4: Optimize Wrapper Elements & Layout Structure

1. **Audit wrapper divs** in Layout.tsx:
   - Replace with Fragments where no styling/refs needed
   - Keep structural divs that provide layout boundaries
   - Consolidate styles where possible

2. **Visibility handling improvements**:
   - Use CSS classes for show/hide instead of conditional rendering
   - Apply to ResizablePanel and ResizableHandle consistently
   - Pattern: `className={visible ? '' : 'hidden'}`

3. **Simplify root structure**:
   - Remove unnecessary nested divs in Layout root
   - Consolidate rounded-xl and overflow-hidden to a single element
   - Consider if we need the font-sans class (likely already in App.css)

4. **Extract layout constants**:
   - Create `src/lib/layout-constants.ts` for panel sizes:
     ```tsx
     export const LAYOUT_SIZES = {
       leftSidebar: { default: 20, min: 15, max: 35 },
       rightSidebar: { default: 25, min: 20, max: 40 },
       mainEditor: { default: 55, min: 40 },
     }
     ```

### Phase 5: Polish and Testing

1. **Update panel sizing logic**:
   - Adjust defaultSize, minSize, maxSize for three-panel layout
   - Ensure panels behave correctly when sidebars are hidden
   - Test on various screen sizes

2. **Verify state management**:
   - Ensure all stores continue to work correctly
   - Test keyboard shortcuts and menu commands
   - Verify auto-save and file operations

3. **Performance validation**:
   - Check for unnecessary re-renders
   - Ensure memoization is preserved where needed
   - Test with many files open

## Implementation Steps

1. **Start with Phase 1** - Implement three-panel architecture
2. **Test thoroughly** before proceeding
3. **Implement Phase 2 & 3** - These can be done in parallel
4. **Implement Phase 4** - Wrapper optimization
5. **Complete Phase 5** - Final testing and adjustments

## Key Decisions

- ✅ **Keep main.tsx and App.tsx separate** - Better separation of concerns
- ✅ **Create RightSidebar wrapper** - Future extensibility for tabs
- ✅ **Keep MainEditor component** - Good abstraction for editor/welcome logic
- ✅ **Use three-panel ResizablePanelGroup** - Cleaner, more logical structure
- ✅ **Extract event listeners to hook** - Reduces Layout.tsx complexity

## Testing Checklist

- [ ] All keyboard shortcuts work (Cmd+1, Cmd+2, Cmd+S, etc.)
- [ ] Menu commands function correctly
- [ ] Sidebar visibility toggles work
- [ ] Resizing panels works smoothly
- [ ] File operations (open, save, close) work
- [ ] Auto-save continues to function
- [ ] Component Builder Dialog opens correctly
- [ ] Preferences dialog opens and closes
- [ ] Toast notifications appear
- [ ] Focus mode and typewriter mode work

## Additional Improvements Identified - DO NOT IMPLEMENT YET

1. **Consider Layout Provider Pattern**:
   - Create `LayoutProvider` to manage layout-specific state
   - Move panel visibility states from UIStore to layout context
   - This keeps layout concerns isolated

2. **Floating Components Organization**:
   - Create `src/components/layout/FloatingComponents.tsx`:
     ```tsx
     export const FloatingComponents = () => (
       <>
         <CommandPalette />
         <ComponentBuilderDialog />
         <PreferencesDialog />
         <Toaster />
       </>
     )
     ```
   - This declutters Layout.tsx further

3. **Panel State Persistence**:
   - Consider storing panel sizes in localStorage
   - Restore user's preferred layout on app start
   - Add to project settings or global preferences

4. **Keyboard Navigation Between Panels**:
   - Add Cmd+[ and Cmd+] to cycle focus between panels
   - Consider Cmd+0 to focus editor (VS Code pattern)

5. **Panel Collapse Animation**:
   - Instead of instant hide/show, consider smooth width transitions
   - Use CSS transitions on panel width changes
   - Provides better visual feedback

## Benefits

1. **Simpler mental model** - Three sibling panels instead of nested structure
2. **Better performance** - Fewer nested components
3. **Easier maintenance** - Clear component responsibilities
4. **Future extensibility** - RightSidebar ready for tabs/multiple views
5. **Cleaner code** - ~40% reduction in Layout.tsx complexity
6. **Consistent naming** - LeftSidebar/RightSidebar symmetry
7. **Better organization** - Layout components grouped together
