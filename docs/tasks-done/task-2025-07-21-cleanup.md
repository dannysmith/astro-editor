# Task: Cleanup

## Remove Obsolete "Slash Command" Feature

The codebase currently contains a partially implemented feature for component insertion triggered by a `/` (slash) command. This approach has been superseded by the "Component Builder Dialog" and must be removed.

**Removal Plan:**

The following files and logic, introduced in commits `8f8ddbac` and `3e6d4f9b`, must be removed or reverted:

1.  **Delete Frontend Files:**
    - `src/lib/editor/mdx-completion.ts`: The core CodeMirror extension for the slash command.
    - `src/store/mdxComponentsStore.test.ts`: The test file for the related store.

2.  **Modify Editor Setup:**
    - **File:** `src/hooks/editor/useEditorSetup.ts`
    - **Action:** Remove the logic that conditionally adds the `mdxComponentCompletion()` extension for `.mdx` files.

3.  **Modify `useAppStore`:**
    - **File:** `src/store/index.ts`
    - **Action:** Remove the `loadMdxComponents` call from the `setProject` action. This will also involve removing the `mdxComponents` state and the `loadMdxComponents` action itself from the main app store, as this logic is now managed by `mdxComponentsStore`.

4.  **Retain but Isolate `mdxComponentsStore`:**
    - **File:** `src/store/mdxComponentsStore.ts`
    - **Action:** This store is still needed for the new approach to hold the component data. However, ensure it is no longer coupled to the main `useAppStore`'s project loading lifecycle. It should be a standalone store that is populated once and then read by the Component Builder.

## 2 Standardize Keyboard Shortcuts

It is critical to establish a single, robust pattern for handling keyboard shortcuts. The current implementation in `src/components/Layout/Layout.tsx` uses a manual approach that lacks cross-platform support. We will adopt `react-hotkeys-hook` as the standard.

**Implementation Plan:**

1.  **Install Dependency:**
    - Run `npm install react-hotkeys-hook`.

2.  **Refactor `Layout.tsx`:**
    - Open `src/components/Layout/Layout.tsx`.
    - Import `useHotkeys` from `react-hotkeys-hook`.
    - Remove the entire `useEffect` hook that contains the `handleKeyDown` function and the `switch (e.key)` statement.
    - Replace it with a series of declarative `useHotkeys` calls for each global shortcut (`mod+s`, `mod+1`, `mod+2`, `mod+n`, `mod+w`, `mod+,`).
    - Use the `mod` key to ensure cross-platform (`Cmd`/`Ctrl`) compatibility.

Completing these pre-tasks will establish a clean, maintainable, and architecturally sound foundation for the Component Builder.
