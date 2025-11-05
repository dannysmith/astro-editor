# Code Review: 2025-10-24

This review focuses on identifying opportunities for code cleanup and abstraction to reduce complexity and improve maintainability.

## 1. `useCreateFile.ts`

This hook contains several helper functions that are not directly related to the hook's primary responsibility. Extracting these functions into a utility module will improve code organization and reusability.

### Recommendations

- **Extract `singularize` to `lib/utils.ts`**: This is a generic string utility that could be used elsewhere.
- **Extract `getDefaultValueForFieldType` to `lib/schema.ts`**: This function is tightly coupled with the schema definition and should be co-located with it.
- **Extract filename generation logic to a new `lib/files/file-utils.ts` module**: The logic for generating a unique filename is reusable and can be extracted into a dedicated function.

## 2. `useLayoutEventListeners.ts`

This hook has grown into a monolith that handles keyboard shortcuts, Tauri events, and DOM events. This makes it difficult to understand and maintain.

### Recommendations

- **Split the hook into smaller, more focused hooks**:
    - `useKeyboardShortcuts.ts`: Handles all `useHotkeys` calls.
    - `useTauriEventListeners.ts`: Handles all `listen` calls to Tauri events.
    - `useDOMEventListeners.ts`: Handles all `window.addEventListener` calls.
- **Abstract repetitive logic**:
    - The logic for toggling highlights is repeated for each part of speech. This can be abstracted into a single function that takes the part of speech as an argument.
    - The logic for handling menu format events is also repetitive. This can be abstracted into a single function that takes the command name as an argument.

---

I will now proceed with implementing these recommendations.
