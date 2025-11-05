# Toast Notification System

## Overview

Asrro Editor uses a comprehensive toast notification system based on shadcn/ui's Sonner component. This system provides user-friendly notifications for successes, errors, warnings, and informational messages throughout the application.

## Architecture

### Core Components

1. **Theme Provider** (`src/lib/theme-provider.tsx`)
   - Custom theme provider that replaces `next-themes` for Tauri compatibility
   - Manages light/dark mode theming for toast notifications
   - Integrates with existing CSS variables system

2. **Toast Utility** (`src/lib/toast.ts`)
   - Centralized API for dispatching toast notifications
   - Type-safe wrapper around Sonner's toast functions
   - Provides consistent styling and duration defaults

3. **Sonner Component** (`src/components/ui/sonner.tsx`)
   - Customized shadcn/ui toast component
   - Positioned in bottom-right corner
   - Themed with CSS variables for consistency

4. **Rust Bridge** (`src/lib/rust-toast-bridge.ts`)
   - Event-driven system for Rust-to-frontend toast notifications
   - Enables backend operations to display user feedback

## Usage

### Frontend TypeScript

```typescript
import { toast } from '../../lib/toast'

// Basic notifications
toast.success('Operation completed successfully')
toast.error('Something went wrong')
toast.warning('Please check your input')
toast.info('New update available')

// With descriptions
toast.error('Save failed', {
  description: 'Could not write to file: Permission denied',
})

// With actions
toast.warning('Unsaved changes', {
  description: 'You have unsaved changes in your document',
  action: {
    label: 'Save',
    onClick: () => saveFile(),
  },
})

// Promise-based toasts for async operations
toast.promise(
  saveFileAsync(),
  {
    loading: 'Saving file...',
    success: 'File saved successfully',
    error: 'Failed to save file',
  }
)

// Loading toasts that can be updated
const loadingToast = toast.loading('Processing...')
// Later update it
toast.dismiss(loadingToast)
toast.success('Processing complete')
```

### Backend Rust Integration

The Rust backend can send toast notifications to the frontend using Tauri events:

```rust
use tauri::Manager;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RustToastEvent {
    r#type: String,
    message: String,
    description: Option<String>,
    duration: Option<u64>,
}

// In any Rust function with access to the app handle
pub fn send_toast_notification(app: &tauri::AppHandle, toast_type: &str, message: &str) -> Result<(), tauri::Error> {
    let toast_event = RustToastEvent {
        r#type: toast_type.to_string(),
        message: message.to_string(),
        description: None,
        duration: None,
    };

    app.emit("rust-toast", toast_event)?;
    Ok(())
}

// Usage examples
send_toast_notification(&app, "success", "File processed successfully")?;
send_toast_notification(&app, "error", "Failed to process file")?;
send_toast_notification(&app, "warning", "File watcher stopped unexpectedly")?;
```

## Toast Types and Styling

### Available Types

- **Success** (`toast.success`): Green theme, default 3s duration
- **Error** (`toast.error`): Red theme, 5s duration (longer for important errors)
- **Warning** (`toast.warning`): Yellow theme, 4s duration
- **Info** (`toast.info`): Blue theme, default 3s duration
- **Loading** (`toast.loading`): Spinner animation, manual dismiss
- **Promise** (`toast.promise`): Automatic state transitions

### Visual Design

- **Position**: Bottom-right corner
- **Theme**: Automatically matches light/dark mode
- **Animation**: Smooth slide-in from right
- **Dismiss**: Click to dismiss or auto-dismiss after duration
- **Actions**: Optional action buttons with custom callbacks

## Implementation Details

### Setup and Initialization

1. **App.tsx**: Theme provider wraps the entire application
2. **Layout.tsx**: Toaster component renders in main layout
3. **Store**: Error handling with appropriate toast notifications
4. **Rust Bridge**: Event listener initialized on app start

### Error Handling Strategy

The toast system is integrated throughout the application for comprehensive error reporting:

- **Project Operations**: Loading, scanning, file watching
- **File Operations**: Opening, saving, creating files
- **Validation**: Frontmatter validation errors
- **Recovery**: Save failures with recovery data notifications
- **Background Tasks**: File watcher status updates

### Performance Considerations

- **Toast Queue**: Sonner manages automatic queueing of multiple toasts
- **Memory Management**: Automatic cleanup of dismissed toasts
- **Event Listeners**: Proper cleanup in useEffect hooks
- **Debouncing**: Prevents spam from rapid operations

## Best Practices

### When to Use Toasts

✅ **Use toasts for:**
- Operation feedback (save, create, delete)
- Error notifications that need immediate attention
- Background process status updates
- Non-blocking informational messages

❌ **Don't use toasts for:**
- Critical errors that need user interaction (use dialogs)
- Validation errors on forms (use inline validation)
- Debugging messages (use console.log)
- Success feedback for instantaneous actions

### Message Guidelines

- **Be concise**: Keep messages under 50 characters
- **Be specific**: "File saved" vs "Operation completed"
- **Use descriptions**: For additional context without cluttering
- **Provide actions**: For recoverable errors or follow-up actions

### Error Handling Pattern

```typescript
try {
  await riskyOperation()
  toast.success('Operation completed successfully')
} catch (error) {
  toast.error('Operation failed', {
    description: error instanceof Error ? error.message : 'Unknown error occurred',
  })
  // Still log for debugging
  console.error('Operation failed:', error)
}
```

## Testing

### Manual Testing

1. **Theme Support**: Test in both light and dark modes
2. **Position**: Verify bottom-right positioning
3. **Stacking**: Multiple toasts should queue properly
4. **Actions**: Test action buttons and callbacks
5. **Auto-dismiss**: Verify timing for different toast types

### Automated Testing

```typescript
// Example test for toast integration
import { toast } from '../lib/toast'

test('should display error toast on save failure', async () => {
  const mockError = new Error('Save failed')
  jest.spyOn(toast, 'error')
  
  await expect(saveFile()).rejects.toThrow()
  expect(toast.error).toHaveBeenCalledWith('Save failed', {
    description: 'Save failed',
  })
})
```

## Troubleshooting

### Common Issues

1. **Toasts not appearing**: Check if Toaster component is rendered
2. **Theme not working**: Verify ThemeProvider is wrapping app
3. **Rust events not working**: Check event listener initialization
4. **Styling issues**: Verify CSS variables are defined

### Debug Tools

- **Console logging**: All toast actions log to console in development
- **React DevTools**: Inspect theme context and component state
- **Tauri DevTools**: Monitor Rust-to-frontend events

## Future Enhancements

### Planned Features

- **Persistent notifications**: For critical system alerts
- **Notification center**: History of recent notifications
- **Custom styling**: Per-toast custom themes
- **Sound notifications**: Audio feedback for important events
- **Keyboard shortcuts**: Dismiss with Escape key

### Integration Opportunities

- **Command palette**: Show recent notifications
- **Settings panel**: Configure notification preferences
- **Analytics**: Track notification engagement
- **Accessibility**: Screen reader support improvements

---

*This documentation reflects the current implementation as of the toast system setup. Update as features are added or modified.*
