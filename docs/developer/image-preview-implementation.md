# Image Preview Implementation

## Overview

Shows image previews in bottom-right corner when hovering over image paths/URLs with Alt key held. Works across markdown, HTML, MDX components, and plain text using syntax-agnostic detection.

**Key Files**:
- `src/components/editor/ImagePreview.tsx` - Preview component
- `src/hooks/editor/useImageHover.ts` - Hover tracking
- `src/lib/editor/urls/detection.ts` - Image detection
- `src-tauri/src/commands/files.rs:1012` - `resolve_image_path` command
- `src/components/editor/Editor.tsx:251-257` - Integration

## Path Resolution

The system handles three path types:

### 1. Remote URLs
```
https://example.com/image.png
```
Used directly without resolution.

### 2. Absolute Paths (from project root)
```
/src/assets/articles/image.png
```
Resolution logic:
- Strip leading `/`
- Join with project root
- Validate with `validate_project_path`
- Return absolute filesystem path

### 3. Relative Paths
```
./image.png
../images/photo.jpg
```
Resolution logic:
- Get directory of current file
- Resolve path relative to that directory
- Validate with `validate_project_path`
- Return absolute filesystem path

### Tauri Command

```rust
pub async fn resolve_image_path(
    image_path: String,
    project_root: String,
    current_file_path: Option<String>,
) -> Result<String, String>
```

Returns validated absolute filesystem path. Security enforced by `validate_project_path` to prevent traversal attacks.

### Frontend Usage

```typescript
// For remote URLs - use directly
if (path.startsWith('http://') || path.startsWith('https://')) {
  setImageUrl(path)
  return
}

// For local paths - resolve then convert
const absolutePath = await invoke<string>('resolve_image_path', {
  imagePath: path,
  projectRoot: projectPath,
  currentFilePath,
})

// Convert to asset protocol URL
const assetUrl = convertFileSrc(absolutePath)
```

## Architecture

### Image Detection

**Strategy**: Syntax-agnostic regex detection. Finds any path/URL ending with image extension, regardless of surrounding syntax.

```typescript
// From src/lib/editor/urls/detection.ts
export function findImageUrlsAndPathsInText(
  text: string,
  offset?: number
): UrlMatch[]
```

Works with:
- Markdown: `![alt](./image.png)`
- HTML: `<img src="/src/assets/image.jpg" />`
- MDX: `<Image src="https://example.com/photo.png" />`
- Plain text: Any path ending with `.png`, `.jpg`, etc.

### Component Flow

1. **Hover Tracking** (`useImageHover.ts`)
   - Listens for mousemove when Alt pressed
   - Uses CodeMirror's `posAtCoords()` to map mouse → document position
   - Scans current line for image paths
   - Returns `HoveredImage { url, from, to }` or null

2. **Preview Component** (`ImagePreview.tsx`)
   - Receives `hoveredImage`, `projectPath`, `currentFilePath`
   - Resolves local paths via `resolve_image_path` command
   - Converts to asset protocol URL via `convertFileSrc()`
   - Manages loading states: idle → loading → success/error

3. **Integration** (`Editor.tsx`)
   - Gets `hoveredImage` from `useImageHover(viewRef.current, isAltPressed)`
   - Passes to `ImagePreview` component with store data
   - Conditional render: only shows when `projectPath` available

### Why Editor.tsx?

ImagePreview lives in Editor.tsx (not MainEditor.tsx) because:
- Tight coupling with `viewRef` (CodeMirror EditorView instance)
- Semantically part of editing experience
- First React UI component integrated with editor
- Moving up would break encapsulation

## Performance Patterns

### 1. Specific Store Selectors
```typescript
// ✅ Only subscribe to path changes
const currentFilePath = useEditorStore(state => state.currentFile?.path)

// ❌ Would subscribe to all file property changes
const currentFile = useEditorStore(state => state.currentFile)
```

### 2. Conditional State Updates (Prevents re-renders on mousemove)
```typescript
setHoveredImage(prev => {
  if (prev?.url === hoveredUrl.url) {
    return prev // Same URL, don't create new object
  }
  return { url: hoveredUrl.url, from: hoveredUrl.from, to: hoveredUrl.to }
})
```

### 3. URL Caching (Prevents re-fetching same image)
```typescript
const prevUrlRef = React.useRef<string | null>(null)

if (hoveredImage.url === prevUrlRef.current) {
  return // Don't reload, just position changed
}
```

### 4. Optimized Dependencies
```typescript
// Only re-run when URL changes, not position
useEffect(() => {
  // ...
}, [hoveredImage?.url, projectPath, currentFilePath])
```

### 5. Strategic Memoization
```typescript
export const ImagePreview = React.memo(ImagePreviewComponent)
```

These patterns prevent:
- Unnecessary re-renders on mousemove
- Re-fetching images when hovering over same URL
- Render cascades from store updates

## Error Handling

**Strategy**: Silent failure for better UX.

```typescript
if (!hoveredImage || loadingState === 'error') {
  return null // Don't render anything
}
```

**Rationale**: Image preview is an optional enhancement. Errors shouldn't interrupt writing flow.

**Scenarios**:
- Local file not found → No preview
- Path resolution fails → No preview
- Image load fails → No preview
- Remote URL unreachable → Browser's default broken image icon (provides feedback)

## Security

- **Path Validation**: All paths validated by `validate_project_path` in Rust
- **Project Boundary**: Paths must be within project root
- **Asset Protocol**: Tauri's secure file access via `convertFileSrc()`
- **No Path Traversal**: `../../../etc/passwd` rejected by validation

## Configuration

### Tauri (`src-tauri/tauri.conf.json`)
```json
{
  "app": {
    "security": {
      "csp": "img-src 'self' asset: http://asset.localhost data:;",
      "assetProtocol": {
        "enable": true,
        "scope": ["**"]
      }
    }
  }
}
```

### Cargo (`src-tauri/Cargo.toml`)
```toml
tauri = { version = "2", features = ["protocol-asset"] }
```
