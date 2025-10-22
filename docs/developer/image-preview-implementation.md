# Image Preview Implementation

## Overview

Implementation of image preview functionality for markdown/MDX files, showing image previews when hovering over image URLs with the Option/Alt key held.

## Architecture

### Path Resolution Strategy

The system supports three types of image paths:

#### 1. Absolute Paths (from project root)
- **Format**: `/src/assets/articles/image.png`
- **Resolution**: Strip leading `/`, join with project root
- **Use case**: Most common in Astro projects

#### 2. Relative Paths
- **Format**: `./image.png` or `../images/image.png`
- **Resolution**: Resolve relative to current file's directory
- **Use case**: Images in same directory as content file

#### 3. Remote URLs
- **Format**: `https://example.com/image.png`
- **Resolution**: Use directly, no path resolution needed
- **Use case**: External images

### Components

#### Tauri Command: `resolve_image_path`

Location: `src-tauri/src/commands/files.rs`

```rust
pub async fn resolve_image_path(
    image_path: String,
    project_root: String,
    current_file_path: Option<String>,
) -> Result<String, String>
```

**Purpose**: Converts markdown image paths to absolute filesystem paths

**Logic**:
1. If path starts with `/` → treat as absolute from project root
2. If path starts with `./` or `../` → resolve relative to current file (requires `current_file_path`)
3. Otherwise → try as absolute from project root
4. Validate path is within project bounds
5. Check file exists
6. Return absolute path

**Security**: Uses existing `validate_project_path` to prevent path traversal attacks

#### Frontend Flow

1. **URL Detection** (`src/lib/editor/urls/detection.ts`)
   - Existing system detects URLs in markdown
   - Supports both `![alt](url)` and plain URLs
   - Filter for image extensions (`.png`, `.jpg`, etc.)

2. **Path Resolution** (React component)
   - Call `resolve_image_path` command with:
     - Image path from markdown
     - Project root from store
     - Current file path from store
   - Get back validated absolute path

3. **Asset Protocol Conversion**
   ```typescript
   import { convertFileSrc } from '@tauri-apps/api/core'
   const assetUrl = convertFileSrc(absolutePath)
   ```

4. **Display**
   - Use `assetUrl` in `<img src={assetUrl} />`
   - Tauri asset protocol handles loading from filesystem

### Configuration

#### Tauri Config (`src-tauri/tauri.conf.json`)

```json
{
  "app": {
    "security": {
      "csp": "default-src 'self' ipc: http://ipc.localhost; img-src 'self' asset: http://asset.localhost data:; style-src 'self' 'unsafe-inline'",
      "assetProtocol": {
        "enable": true,
        "scope": ["**"]
      }
    }
  }
}
```

**Key points**:
- CSP allows `asset:` and `http://asset.localhost` in img-src
- Asset protocol enabled with broad scope (`**`)
- Also allows `data:` URIs for inline images

#### Cargo.toml

```toml
tauri = { version = "2", features = ["macos-private-api", "protocol-asset"] }
```

**Required**: Must include `protocol-asset` feature when asset protocol is enabled

## Testing Plan

### Test Component

Location: `src/components/ImagePreviewTest.tsx`

Temporary test component for validating functionality before integration.

**Features**:
- Manual path input
- Shows resolved absolute path
- Shows asset protocol URL
- Displays image preview (300x300 max)
- Error handling and display
- Quick test buttons for common scenarios

**Test Cases**:

1. **Remote URLs**
   - Input: `https://picsum.photos/400/300`
   - Expected: Direct display without resolution

2. **Absolute from project root**
   - Input: `/src/assets/articles/example.png`
   - Expected: Resolved to full path, displayed via asset protocol

3. **Relative paths**
   - Input: `./example.png`
   - Expected: Resolved relative to current file (requires file open)

### Manual Testing Steps

1. **Setup**:
   - Run `pnpm run dev`
   - Open an Astro project
   - Open a markdown/MDX file

2. **Test Remote Image**:
   - Click "Remote URL" test button
   - Verify image loads
   - Check console for asset URL format

3. **Test Local Absolute Path**:
   - Find an image in project's assets directory
   - Enter path like `/src/assets/image.png`
   - Verify resolution and display

4. **Test Relative Path**:
   - With a file open, try `./image.png`
   - Verify it resolves relative to open file's directory

5. **Test Error Handling**:
   - Try non-existent path
   - Try path outside project
   - Verify appropriate error messages

## Integration Plan

Once testing is complete:

1. **Remove test component** from Layout.tsx
2. **Create ImagePreview component** for production use
   - Position: Fixed bottom-right corner
   - Size: 300x300 max
   - Animation: Smooth fade in/out
   - Style: Match macOS aesthetic

3. **Extend URL detection** to identify image URLs
   - Check URL ends with image extension
   - Filter in detection.ts or create new imageDetection.ts

4. **Add hover tracking** in Editor.tsx
   - Track hovered image URL when Alt pressed
   - Clear on Alt release or mouse leave

5. **Wire up preview component**
   - Show when hovered image URL exists
   - Hide on Alt release or URL change
   - Handle loading and error states

## Security Considerations

- **Path traversal**: Prevented by `validate_project_path`
- **Scope restriction**: Asset protocol scope set to `**` for flexibility
  - Consider tightening to specific directories if needed
- **File existence check**: Prevents probing filesystem
- **Project boundary**: All paths validated within project root

## Performance Considerations

- **Asset protocol**: More efficient than base64 encoding
- **Path resolution**: Minimal overhead, runs in Rust
- **Caching**: Browser caches asset:// URLs
- **Debouncing**: Consider debouncing preview updates if needed

## Future Enhancements

### Part Two: Astro image() helper in content collections
- Parse Astro image fields in schema
- Render file picker component
- Support drag & drop
- Show preview after selection
- Use same path resolution logic

### Additional improvements
- Cache resolved paths to avoid re-resolution
- Support more image formats (WebP, AVIF)
- Add image dimensions to preview
- Show loading spinner
- Keyboard shortcut to toggle preview
