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

1. **Image Detection** (`src/lib/editor/urls/detection.ts`)
   - **Syntax-agnostic approach**: Detects ANY path/URL ending with image extension
   - Works across markdown, HTML, MDX components, and plain text
   - Three path types detected:
     - Remote URLs: `https://example.com/image.png`
     - Relative paths: `./image.png` or `../images/photo.jpg`
     - Absolute paths: `/src/assets/image.png`
   - Key functions:
     - `isImageUrl(urlOrPath: string): boolean` - Checks if path ends with image extension
     - `findImageUrlsAndPathsInText(text: string, offset?: number): UrlMatch[]` - Finds all image paths

2. **Hover Tracking** (`src/hooks/editor/useImageHover.ts`)
   - Monitors mouse position when Alt key is pressed
   - Uses CodeMirror's `posAtCoords()` to map screen position to document position
   - Scans current line for image paths using `findImageUrlsAndPathsInText()`
   - Returns `HoveredImage` object with path/URL and position info

3. **Path Resolution** (React component - Phase 4)
   - For remote URLs: Use directly
   - For local paths: Call `resolve_image_path` command with:
     - Image path from detection
     - Project root from store
     - Current file path from store
   - Get back validated absolute path

4. **Asset Protocol Conversion**
   ```typescript
   import { convertFileSrc } from '@tauri-apps/api/core'
   const assetUrl = convertFileSrc(absolutePath)
   ```

5. **Display**
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

## Testing

### Automated Tests

Location: `src/lib/editor/urls/detection.test.ts`

**Coverage**: 20 test cases covering all image detection scenarios

**Test categories**:
- Remote URLs with various extensions
- Relative paths (`./ `and `../`)
- Absolute paths from project root
- Images in markdown syntax
- Images in HTML img tags
- Images in custom components
- Mixed content scenarios
- Case-insensitive extension matching
- Query parameters in URLs
- Position offset calculations

**All tests passing**: 458 total tests in project

### Manual Testing

**Test Article**: `/test/dummy-astro-project/src/content/articles/2025-01-22-image-preview-test.md`

Contains:
- Remote URL: `https://danny.is/avatar.jpg`
- Absolute path: `/src/assets/articles/styleguide-image.jpg`
- Relative path: `./imagetest.png`
- HTML img tag: `<img src="/src/assets/articles/styleguide-image.jpg" />`
- Mixed content with inline images

**Manual Testing Steps** (Current - Phase 3):

1. Run `pnpm run dev` and open dummy project
2. Open the test article
3. Hold Alt/Option key
4. Hover over any image path/URL
5. Check browser console for: `"Hovered image: [path/url]"`
6. Verify works for ALL image types (remote, relative, absolute)

**Expected Behavior** (Phase 4 - Preview UI):
- Image preview appears in bottom-right corner
- Max 300x300px dimensions
- Smooth fade in/out animation
- Loading state while resolving/loading
- Error state if image fails to load

## Implementation Status

### Completed (Phases 1-3)

✅ **Phase 1: Path Resolution & Image Loading**
- Tauri command `resolve_image_path` (src-tauri/src/commands/files.rs:1012)
- Asset protocol configuration in tauri.conf.json
- Security via `validate_project_path`
- Tested with all three path types

✅ **Phase 2: Image Detection**
- Syntax-agnostic detection in `src/lib/editor/urls/detection.ts`
- `findImageUrlsAndPathsInText()` finds ALL image paths regardless of syntax
- 20 automated tests covering all scenarios
- Works with markdown, HTML, MDX components, plain text

✅ **Phase 3: Hover State Management**
- `useImageHover` hook in `src/hooks/editor/useImageHover.ts`
- Integrated into Editor.tsx
- Tracks mouse position when Alt is pressed
- Returns hovered image path/URL with position info

### Remaining (Phases 4-6)

**Phase 4: ImagePreview React Component** (NEXT)
- Create `src/components/editor/ImagePreview.tsx`
- Fixed position bottom-right corner
- 300x300px max dimensions
- Smooth fade in/out animation
- macOS aesthetic styling
- Loading and error states

**Phase 5: Wire Up to Editor**
- Import ImagePreview in Editor.tsx
- Pass `hoveredImage` from useImageHover hook
- Pass `projectPath` and `currentFile.path` from stores
- Show preview when `hoveredImage !== null`
- Remove debug console.log

**Phase 6: Polish & Edge Cases**
- Debounce preview updates
- Handle image load failures
- Consider path caching
- Test with various project structures
- Optional: keyboard shortcut to toggle preview

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
