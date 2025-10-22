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

**Phase 2: Image URL and Path Detection** ✅ (COMPLETED - ENHANCED)

Implemented syntax-agnostic image detection that finds ALL image paths/URLs regardless of context:

**1. Functions Added to `src/lib/editor/urls/detection.ts`:**

- `isImageUrl(urlOrPath: string): boolean` - Checks if URL/path ends with image extension
  - Handles query parameters and fragments correctly
  - Case-insensitive matching
  - Supports all common image formats (PNG, JPG, JPEG, GIF, WebP, SVG, BMP, ICO)

- `findImageUrlsAndPathsInText(text: string, offset?: number): UrlMatch[]` - Finds ALL image references
  - **Remote URLs**: `https://example.com/image.png`
  - **Relative paths**: `./image.png` or `../images/photo.jpg`
  - **Absolute paths**: `/src/assets/image.png`
  - Works across ANY syntax: markdown, HTML, MDX components, or plain text
  - Detects based on image extension only - syntax-agnostic approach

**2. Test Coverage:**

- 20 test cases covering all image detection scenarios
- All tests passing (458 total tests in project)
- Tests cover: remote URLs, relative paths, absolute paths, markdown, HTML, custom components, mixed content

**3. Usage:**

```typescript
import {
  findImageUrlsAndPathsInText,
  isImageUrl,
} from '@/lib/editor/urls/detection'

// Check if a URL/path is an image
isImageUrl('https://example.com/photo.jpg') // true
isImageUrl('./local.png') // true
isImageUrl('/assets/hero.webp') // true
isImageUrl('https://example.com/page.html') // false

// Find all image URLs/paths in text - works in ANY context
const text =
  'Remote: https://cdn.com/img.jpg, Local: ./test.png, Absolute: /assets/icon.svg'
const images = findImageUrlsAndPathsInText(text)
// Returns: [
//   { url: 'https://cdn.com/img.jpg', from: 8, to: 30 },
//   { url: './test.png', from: 39, to: 49 },
//   { url: '/assets/icon.svg', from: 61, to: 78 }
// ]
```

**4. Design Decision:**
Chose syntax-agnostic detection over parsing specific syntaxes (markdown/HTML/MDX) because:

- Works with any component type (Image, MyFancyImage, etc.)
- Future-proof - new syntaxes work automatically
- Simpler logic - just find paths ending with image extensions
- Consistent behavior everywhere

**Phase 3: Hover State Management** ✅ (COMPLETED)

Implemented hover tracking for image paths/URLs when Alt key is pressed:

**1. Created `useImageHover` Hook** (`src/hooks/editor/useImageHover.ts`)

- Tracks mouse position over CodeMirror editor
- Detects when cursor is over an image path/URL (using `findImageUrlsAndPathsInText`)
- Only active when Alt key is pressed
- Returns `HoveredImage` object with path/URL and position info, or null

**2. Hook Features:**

- Uses CodeMirror's `posAtCoords()` to map mouse position to document position
- Scans current line for image paths/URLs using Phase 2's detection function
- Works for remote URLs, relative paths, and absolute paths
- Auto-clears on Alt release or mouse leave
- Handles edge cases (out of bounds positions, no view instance)

**3. Integration:**

- Integrated into `Editor.tsx:67` via `useImageHover(viewRef.current, isAltPressed)`
- Exports `HoveredImage` type for use in preview component
- Temporary debug logging to console (to be removed)

**4. Return Type:**

```typescript
interface HoveredImage {
  url: string // The image URL being hovered over
  from: number // Start position in document
  to: number // End position in document
}
```

**5. Testing:**
To test, run the app and:

1. Open a markdown file with image URLs
2. Hold Alt/Option key
3. Hover over an image URL
4. Check browser console - should log "Hovered image: [url]"

**Test Article Created:**

- Location: `/test/dummy-astro-project/src/content/articles/2025-01-22-image-preview-test.md`
- Contains Lorem Ipsum text with 4 image types:
  - Absolute path: `![Styleguide Image](/src/assets/articles/styleguide-image.jpg)`
  - Relative path: `![Image Test](./imagetest.png)`
  - Remote URL: `![Danny's Avatar](https://danny.is/avatar.jpg)`
  - HTML img tag: `<img src="/src/assets/articles/styleguide-image.jpg" />`
- All referenced images exist and are ready for testing
- Article includes inline images, plain URLs, and mixed content scenarios

### Current Working Status

**What's Working Now (Phases 1-5):**

- ✅ **Phase 1**: Tauri command `resolve_image_path` handles all path types (remote, relative, absolute)
- ✅ **Phase 1**: Asset protocol configured and working
- ✅ **Phase 2**: Syntax-agnostic image detection (`isImageUrl`, `findImageUrlsAndPathsInText`)
- ✅ **Phase 2**: Detects images in markdown, HTML, MDX components, and plain text
- ✅ **Phase 3**: Hover tracking hook (`useImageHover`) integrated in Editor.tsx
- ✅ **Phase 4**: ImagePreview component with loading, error, and success states
- ✅ **Phase 4**: macOS aesthetic styling with backdrop blur and smooth animations
- ✅ **Phase 5**: Full integration into Editor.tsx with store data
- ✅ All tests passing (458 tests including 20 new image detection tests)
- ✅ TypeScript compilation passes

**Ready to Test (Full Feature):**

1. Run `pnpm run dev` and open test project
2. Open the test article at `/test/dummy-astro-project/src/content/articles/2025-01-22-image-preview-test.md`
3. Hold Alt/Option and hover over ANY image path/URL:
   - Remote URL: `https://danny.is/avatar.jpg`
   - Absolute path: `/src/assets/articles/styleguide-image.jpg`
   - Relative path: `./imagetest.png`
   - HTML img tag src attribute
4. Should see image preview appear in bottom-right corner with:
   - Loading spinner while resolving/loading
   - Image preview (max 300x300px) when loaded
   - Error message if image fails to load
   - Smooth fade in/out animation

**Phase 4: ImagePreview React Component** ✅ (COMPLETED)

Created production-ready preview component with full feature set:

**1. Component Created** (`src/components/editor/ImagePreview.tsx`)

- Props interface with `HoveredImage`, `projectPath`, `currentFilePath`
- Conditional rendering - only shows when `hoveredImage` is not null
- TypeScript with proper types throughout

**2. Path Resolution Logic:**

- **Remote URLs**: Used directly without resolution
- **Local paths**: Call `invoke('resolve_image_path')` then `convertFileSrc()`
- Handles all three path types from Phase 2

**3. Loading States:**

- **Idle**: No preview shown (opacity: 0)
- **Loading**: Animated spinner (24px, macOS-style)
- **Success**: Image displayed with smooth fade-in
- **Error**: Error message with red accent color

**4. Styling (macOS Aesthetic):**

- Fixed position bottom-right (24px from edges)
- Max dimensions: 300x300px
- Semi-transparent white background (rgba(255, 255, 255, 0.98))
- Backdrop blur effect (blur(10px))
- Subtle border and shadow
- Rounded corners (8px border-radius)
- Smooth 0.2s fade transition
- Object-fit: contain for images

**5. Error Handling:**

- Try-catch around path resolution
- onError handler for image load failures
- User-friendly error messages displayed in preview

**Phase 5: Editor Integration** ✅ (COMPLETED)

Successfully wired up ImagePreview to the editor:

**1. Store Integration:**

- Added `useProjectStore` import
- Get `projectPath` from store
- Get `currentFile` from `useEditorStore`

**2. Component Integration:**

- Imported `ImagePreview` component
- Added to JSX with conditional rendering (`{projectPath && ...}`)
- Passed three required props:
  - `hoveredImage` from `useImageHover` hook
  - `projectPath` from store
  - `currentFilePath` as `currentFile?.path || null`

**3. Cleanup:**

- Removed debug console.log effect
- Removed TODO comment

**4. Type Safety:**

- Conditional rendering handles null projectPath
- All TypeScript checks pass ✅
- All 458 tests pass ✅

**Phase 6: Polish & Edge Cases**

- Debounce preview updates (avoid flickering on quick hover changes)
- Handle images that fail to load

### Technical Notes for Continuation

**Existing Systems to Leverage:**

- Alt key detection: Already working in `Editor.tsx:88-131` via `isAltPressed` state
- Hover tracking: `useImageHover` hook returns `HoveredImage | null` at `Editor.tsx:67`
- URL detection: `findImageUrlsInText()` from `src/lib/editor/urls/detection.ts`
- URL hover styling: CSS class `url-alt-hover` already applied when Alt pressed
- Path validation: `validate_project_path` in Rust prevents security issues
- Store access: Use `useProjectStore` for `projectPath`, `useEditorStore` for `currentFile`

**Image Extensions:**

```typescript
// From src/lib/editor/dragdrop/fileProcessing.ts
const IMAGE_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.bmp',
  '.ico',
]
```

**Asset Protocol Usage (For Phase 4 Implementation):**

```typescript
import { convertFileSrc } from '@tauri-apps/api/core'
import { invoke } from '@tauri-apps/api/core'

// For remote URLs - use directly
if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
  return <img src={imageUrl} alt="Preview" />
}

// For local paths - resolve then convert
const absolutePath = await invoke<string>('resolve_image_path', {
  imagePath: imageUrl,              // e.g., '/src/assets/image.png' or './image.png'
  projectRoot: projectPath,         // from useProjectStore
  currentFilePath: currentFile?.path || null,  // from useEditorStore
})

// Convert to asset protocol URL
const assetUrl = convertFileSrc(absolutePath)

// Use in img tag
<img src={assetUrl} alt="Preview" className="max-w-[300px] max-h-[300px] object-contain" />
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
