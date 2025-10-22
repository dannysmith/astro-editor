# Task: Image Previews

## Part One - Image Previews in editor

### Original Requirements

In markdown or MDX files when there are image links in there (eg `![Screenshot 2025-09-20 at 22.12.43.png](/src/assets/articles/2025-10-22-screenshot-2025-09-20-at-2212.43.png)`) I want it to be possible to somehow preview these. Now I think the best way of making this work would be that when you mouse over an image and hold option it pops up some kind of overlay somehow which shows a small preview of the image. I want this to be done as simply as possible. I'm choosing option here because we currently use that to enable clicking on URLs. When you hold option you get a cursor point you can click it to open the URL. Now we need to be able to support image links that are inserted using MDX components or markdown links and we need to be able to support ideally images which are externally online from a URL and also which are local in the astro project.

I would suggest that to do this, we don't look specifically for image tags and things. We just look for any URLs at all, which are in the document, that end in an image extension. If they're remote, we go and get that image from the internet. If they're local, we get that image from disk and display it somehow. And that means probably building out full path to where the image is as machine.

I'm keen to do this in the simplest way possible.

### Implementation Approach (Decided)

**UI Location**: Bottom-right corner preview (300x300 max) - avoids CodeMirror complexity
**Preview Trigger**: Option/Alt + hover over image URL
**Detection Strategy**: Check any URL ending with image extension

### Progress - Foundation Complete ✅

**Phase 1: Path Resolution & Image Loading** (COMPLETED)

Implemented and tested the core infrastructure for loading images from various sources:

**1. Tauri Command: `resolve_image_path`**
- Location: `src-tauri/src/commands/files.rs:1012`
- Handles three path types:
  - Absolute from project root: `/src/assets/image.png`
  - Relative to current file: `./image.png` or `../images/image.png`
  - Remote URLs: `https://example.com/image.png`
- Security: Uses existing `validate_project_path` to prevent path traversal
- Returns validated absolute filesystem path

**2. Configuration Changes**
- `src-tauri/tauri.conf.json`: Added asset protocol with CSP
  - Enabled `assetProtocol` with scope `["**"]`
  - CSP allows `asset:` and `http://asset.localhost` in img-src
- `src-tauri/Cargo.toml`: Added `protocol-asset` feature to Tauri dependency

**3. Testing Results**
- ✅ Remote URLs work (direct HTTP/HTTPS)
- ✅ Absolute paths from project root work (`/src/assets/...`)
- ✅ Relative paths work (`./image.png` - resolves relative to current file)

**4. Documentation**
- Created `docs/developer/image-preview-implementation.md`
- Covers: Architecture, security, path resolution logic, configuration, integration plan

### Next Steps - UI Integration

**Phase 2: Image URL Detection** ✅ (COMPLETED)

Implemented comprehensive image URL detection:

**1. Functions Added to `src/lib/editor/urls/detection.ts`:**
- `isImageUrl(url: string): boolean` - Checks if URL ends with image extension
  - Handles query parameters and fragments correctly
  - Case-insensitive matching
  - Supports all common image formats (PNG, JPG, JPEG, GIF, WebP, SVG, BMP, ICO)

- `findImageUrlsInText(text: string, offset?: number): UrlMatch[]` - Finds all image URLs in text
  - Filters results from existing `findUrlsInText()` function
  - Works with both markdown images `![alt](url)` and plain image URLs
  - Returns positions for hover detection

**2. Test Coverage:**
- 11 new test cases covering all image URL scenarios
- All tests passing with 100% coverage of new functions

**3. Usage:**
```typescript
import { findImageUrlsInText, isImageUrl } from '@/lib/editor/urls/detection'

// Check if a URL is an image
isImageUrl('https://example.com/photo.jpg') // true
isImageUrl('https://example.com/page.html') // false

// Find all image URLs in text
const text = 'See ![screenshot](https://example.com/image.png) here'
const imageUrls = findImageUrlsInText(text)
// Returns: [{ url: 'https://example.com/image.png', from: 18, to: 48 }]
```

**Phase 3: Hover State Management** ✅ (COMPLETED)

Implemented hover tracking for image URLs when Alt key is pressed:

**1. Created `useImageHover` Hook** (`src/hooks/editor/useImageHover.ts`)
- Tracks mouse position over CodeMirror editor
- Detects when cursor is over an image URL (using `findImageUrlsInText`)
- Only active when Alt key is pressed
- Returns `HoveredImage` object with URL and position info, or null

**2. Hook Features:**
- Uses CodeMirror's `posAtCoords()` to map mouse position to document position
- Scans current line for image URLs using Phase 2's detection functions
- Auto-clears on Alt release or mouse leave
- Handles edge cases (out of bounds positions, no view instance)

**3. Integration:**
- Integrated into `Editor.tsx:67` via `useImageHover(viewRef.current, isAltPressed)`
- Exports `HoveredImage` type for use in preview component
- Temporary debug logging to console (to be removed)

**4. Return Type:**
```typescript
interface HoveredImage {
  url: string    // The image URL being hovered over
  from: number   // Start position in document
  to: number     // End position in document
}
```

**5. Testing:**
To test, run the app and:
1. Open a markdown file with image URLs
2. Hold Alt/Option key
3. Hover over an image URL
4. Check browser console - should log "Hovered image: [url]"

**Phase 4: ImagePreview React Component**
Create `src/components/editor/ImagePreview.tsx`:
```tsx
interface ImagePreviewProps {
  imageUrl: string | null  // The markdown URL to preview
  projectPath: string
  currentFilePath: string | null
  visible: boolean
}
```

Features needed:
- Fixed position bottom-right corner
- 300x300 max dimensions
- Smooth fade in/out (CSS transitions)
- Loading state (spinner)
- Error state (graceful failure message)
- Use `invoke('resolve_image_path')` then `convertFileSrc()`
- macOS aesthetic styling

**Phase 5: Wire Up to Editor**
1. Import ImagePreview in Editor.tsx
2. Pass hover state + Alt key state
3. Show preview when: Alt pressed + hovering over image URL
4. Hide preview when: Alt released OR mouse leaves URL

**Phase 6: Polish & Edge Cases**
- Debounce preview updates (avoid flickering on quick hover changes)
- Handle images that fail to load
- Consider caching resolved paths
- Test with various project structures
- Keyboard shortcut to toggle preview on/off (optional)

### Technical Notes for Continuation

**Existing Systems to Leverage:**
- Alt key detection: Already working in `Editor.tsx:88-131`
- URL detection: `src/lib/editor/urls/detection.ts` - `findUrlsInText()` function
- URL hover styling: CSS class `url-alt-hover` already applied when Alt pressed
- Path validation: `validate_project_path` in Rust prevents security issues

**Image Extensions:**
```typescript
// From src/lib/editor/dragdrop/fileProcessing.ts
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico']
```

**Asset Protocol Usage:**
```typescript
import { convertFileSrc } from '@tauri-apps/api/core'
import { invoke } from '@tauri-apps/api/core'

// 1. Resolve path
const absolutePath = await invoke<string>('resolve_image_path', {
  imagePath: '/src/assets/image.png',
  projectRoot: projectPath,
  currentFilePath: currentFile?.path || null,
})

// 2. Convert to asset URL
const assetUrl = convertFileSrc(absolutePath)

// 3. Use in img tag
<img src={assetUrl} />
```

**Error Handling:**
- Path not found: Show "Image not found" message
- Path outside project: Already prevented by validation
- Network error (remote): Show "Failed to load image"
- File read error: Show error message in preview

## Part Two - Support Astro image helper in content colelctions

Astro supports images in content collections. See here for the docs: https://docs.astro.build/en/guides/images/#images-in-content-collections

I would like to update the parser to recognize when we have an image field and rather than rendering a string component, I would like to render an image component which should have a shadcn file picker which allows the user to choose a file but also allows drag and drop into it.

Once a file has been chosen it should use the same mechanism to rename it and move it to the correct assets directory. This should be the same code that we currently use when files or images are dragged into the editor. And then ideally we should use the same underlying code to show a small preview of that image just below the picker. When we tried to implement this before, it got very complicated very quickly. I don't see why it should be that complicated to implement this.
