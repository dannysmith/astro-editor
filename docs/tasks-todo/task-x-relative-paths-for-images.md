# Task: Use relative paths for images and files in editor and frontmatter

https://github.com/dannysmith/astro-editor/issues/53

Images and files dragged into the editor and images added via the frontmatter panel currently work like this:

1. The file/image is copied to a subfolder of the configured assets directory named after the relevant content collection, and renamed to include today's date and remove spaces etc. (Except for frontmatter uploads where the image is already somewhere in the astro project)
2. The resultant markdown tag or frontmatter field is generated as an **absolute path relative to the Astro project root**.

So an `image.png` added to a file in an `articles` collection will generate a path like `/src/assets/articles/2025-01-01-image.png`, assuming no project or collection-specific path overrides are in place.

## The Feature

Supporting "absolute paths" from the project root requires some setup in Astro sites, especially if you want markdown image tags to render Astro's [`<Image />`](https://docs.astro.build/en/guides/images/#image-) component in MDX files.

Even if you don't, by default Astro [expects](https://docs.astro.build/en/guides/images/#image-) you to use **relative paths to images** (unless they're in `/public`).

Ergo: we should be inserting **relative** paths to these files, not absolute paths relative to the project root.

## The Problem

Astro Editor is intentionally designed to ignore as much as possible about the structure of Astro sites because as a minimalist content editor it only needs to care about:

1. Where to find content collections content and schema config (usually `src/content`).
2. Where to find components intended for use in MDX files.
3. Where to put images & files "uploaded" to the editor (usually `src/assets/[collection]`).

All of which are **totally independent** from each other. The file browser, editor and frontmatter features (1) don't care where MDX components or assets live beyond knowing a simple path to each, which is all configurable in the settings. And the code which adds images dragged into the editor doesn't care about the structure of the current content collection – it just needs to know the current collection name and a path to the right "assets" directory.

Supporting relative paths for assets **requires Astro Editor to understand and care about the directory structure of Astro sites**, at lest as far as the relative relationship between content directories and the location of their assets. I don't like this because:

1. The file structure of an Astro site is a **Coder Mode** concern. As a **Writer Mode** tool, Astro Editor should not depend on coder-mode implementation details.
2. Relative paths are poor UX when you don't have the project's file tree to hand, which you obviously don't in Astro Editor.
3. For Astro sites using any sort of [custom image component](https://github.com/dannysmith/dannyis-astro/blob/main/src/components/mdx/BasicImage.astro), relative paths are probably gonna be harder to handle reliably, in which cae users might prefer the current absolute paths.

## Potential Solutions

1. JFDI – We know the path of the current file and the path of the asset, both relative to the project root. So we can easily calculate the relative path and insert that. Since all path overrides are absolute (relative to project root) this should Just Work. I guess we could add a per-project setting to choose between absolute or relative paths for assets.
2. Do nothing.

## Similar Problem?

There's a kinda similar issue with the Component Builder, which inserts `.astro` (and Vue/React/Svelte) components into MDX files. For these to work, they need to be imported immediately below the frontmatter. While this would be somewhat trivial to do, it doesn't feel like a _writer mode_ concern (and doing it well _reliably_ might not be so trivial).

---

## Technical Analysis (2025-11-05)

### Astro Documentation Confirms the Need

I reviewed Astro's official docs via Context7. Key findings:

**Astro's default expectation for images in markdown:**

```markdown
<!-- Relative to current file -->

![](./image.png)
![](../../assets/stars.png)

## <!-- Frontmatter (also relative to file) -->

## cover: "./firstpostcover.jpeg" # resolves to src/content/blog/firstblogcover.jpeg
```

**Absolute paths (starting with `/`) are only for:**

- Public folder: `/images/public-cat.jpg`
- NOT for `src/` assets

**Conclusion:** The task premise is correct. Astro expects relative paths by default. Our current absolute-from-project-root approach requires custom configuration.

### Current Implementation Analysis

**Where paths are generated (2 locations):**

1. **Editor drag-and-drop** (`src/lib/editor/dragdrop/fileProcessing.ts:72-84`)
   - Calls `processFileToAssets()` with `copyStrategy: 'always'`
   - Formats as: `![filename](/src/assets/articles/2025-01-01-image.png)`

2. **Frontmatter image field** (`src/components/frontmatter/fields/ImageField.tsx:55-64`)
   - Calls `processFileToAssets()` with `copyStrategy: 'only-if-outside-project'`
   - Updates frontmatter: `/src/assets/articles/2025-01-01-image.png`

**Shared logic** (`src/lib/files/fileProcessing.ts:20-87`):

- Calls Rust command `copy_file_to_assets` or `copy_file_to_assets_with_override`
- Rust returns path like `src/assets/blog/2025-01-01-image.png`
- TypeScript normalizes to `/src/assets/blog/2025-01-01-image.png` (line 78-80)

**Critical data we have available:**

- ✅ Current file path: `currentFile.path` (absolute filesystem path)
- ✅ Asset path: returned from Rust (relative to project root)
- ✅ Project path: `projectPath`

### Implementation Options

#### Option 1: Calculate Relative Paths in Rust (Recommended)

**Approach:**

1. Add `current_file_path` parameter to `copy_file_to_assets*` commands
2. Add `pathdiff` crate (or implement manually) to calculate relative paths
3. Return relative path instead of project-root-relative path

**Example:**

- Current file: `/project/src/content/articles/2025/my-post.md`
- Asset copied to: `/project/src/assets/articles/2025-01-01-image.png`
- Calculate: `../../../assets/articles/2025-01-01-image.png`

**Changes needed:**

- `src-tauri/Cargo.toml`: Add `pathdiff = "0.2"` dependency
- `src-tauri/src/commands/files.rs`:
  - Add `current_file_path: String` param to both copy commands
  - Calculate relative path from file's directory to asset
- `src/lib/files/fileProcessing.ts`:
  - Pass `currentFile.path` to Rust command
  - Remove leading slash normalization (line 78-80)
- `src/lib/editor/dragdrop/fileProcessing.ts`:
  - Pass `currentFile.path` through to `processFileToAssets`
- `src/components/frontmatter/fields/ImageField.tsx`:
  - Pass `currentFile.path` through to `processFileToAssets`

**Rust implementation sketch:**

```rust
use pathdiff::diff_paths;

// Get directory containing the current markdown file
let current_file_dir = Path::new(&current_file_path)
    .parent()
    .ok_or("Invalid current file path")?;

// Get the asset's full path
let asset_full_path = validated_project_root.join(&relative_path);

// Calculate relative path from file dir to asset
let relative_to_file = diff_paths(&asset_full_path, current_file_dir)
    .ok_or("Could not calculate relative path")?;

// Convert to string with forward slashes
let path_string = relative_to_file
    .to_string_lossy()
    .replace('\\', "/");
```

#### Option 2: Add Path Style Setting

Add a per-project setting: `imagePathStyle: "relative" | "absolute"`

**Pros:**

- Supports users who have configured Astro for absolute paths
- Backwards compatible
- Gives users control

**Cons:**

- More complex
- Default should be "relative" to match Astro
- Extra UI in settings

**Implementation:** Same as Option 1, plus:

- Add setting to project preferences schema
- Conditional logic in Rust to return either style

#### Option 3: Do Nothing

Keep current absolute-path behavior.

**Pros:**

- No work required
- No breaking changes

**Cons:**

- Poor default experience for Astro users
- Requires custom configuration in every Astro project
- Doesn't align with Astro's conventions

### Difficulty Assessment: **LOW-MEDIUM**

**Low complexity factors:**

- ✅ Core algorithm is straightforward (path calculation)
- ✅ We have all necessary data (`currentFile.path`, asset path)
- ✅ Changes are localized to ~4 files
- ✅ `pathdiff` crate is well-tested, or we can implement manually

**Medium complexity factors:**

- ⚠️ Need to pass `currentFile.path` through multiple layers
- ⚠️ Must handle edge cases (see Gotchas below)
- ⚠️ Requires testing across different directory structures
- ⚠️ Breaking change for existing users (though they're likely already adapting)

**Estimated work:** 2-4 hours including testing

### Key Gotchas and Edge Cases

#### 1. **Need Current File Path (Not Just Collection)**

Currently, Rust commands receive:

- `project_path` ✅
- `collection` name ✅
- `source_path` (file being copied) ✅

They DON'T receive:

- ❌ Current file's full path

**Fix:** Add `current_file_path` parameter. We have it: `currentFile.path`

#### 2. **Subdirectories in Collections**

Relative path depth varies by file location:

```
src/content/articles/post.md → ../../assets/articles/image.png
src/content/articles/2025/post.md → ../../../assets/articles/image.png
src/content/articles/2025/january/post.md → ../../../../assets/articles/image.png
```

**Fix:** Calculate from file's directory, not collection root. Works automatically with relative path calculation.

#### 3. **Custom Asset Directory Configurations**

Users can override asset directories at project or collection level. The relative path calculation must work regardless.

**Fix:** We already resolve the final asset path correctly. Just need to calculate relative to wherever it ends up.

#### 4. **Files Already in Project (No Copy)**

When `copyStrategy: 'only-if-outside-project'` and file is already in project:

- File isn't copied
- We call `get_relative_path` to get path relative to project root
- Still need to convert to relative-to-file

**Fix:** Modify `get_relative_path` to also accept `current_file_path` and calculate relative-to-file instead of relative-to-project.

#### 5. **Cross-Platform Path Separators**

Windows uses `\`, Unix uses `/`. Markdown always uses `/`.

**Fix:** Already handled in existing code with `.replace('\\', "/")`. Continue this pattern.

#### 6. **Potential Breaking Change**

Existing users may have adapted their Astro configs to work with absolute paths. Switching to relative is technically a breaking change.

**Mitigation options:**

1. Document in release notes with migration guide
2. Add "Use absolute paths (legacy)" setting for backwards compatibility
3. Make relative the default for new projects only

I lean toward option 1 (breaking change with docs) because:

- Current behavior is wrong for Astro's defaults
- Very few users likely affected (new project)
- Easy to fix if someone complains (just add the setting)

#### 7. **Path Prefix Edge Case**

When markdown file and asset are in same directory:

- Current: `/src/assets/articles/image.png`
- Relative: `./image.png` or just `image.png`

Astro accepts both, but `./` is clearer. Ensure we use `./` prefix for same-directory files.

#### 8. **Image Hover Preview Compatibility**

We have an image hover preview feature (`src/hooks/editor/useImageHover.ts`) that resolves image paths. It currently uses `resolve_image_path` Rust command which handles absolute paths.

**Fix Required:** Verify `resolve_image_path` command can handle relative paths. Looking at `files.rs:875-928`, it already handles relative paths starting with `./` or `../`, so we should be fine.

### Decision: Implement Option 2 (Relative Paths with Toggle)

**Approach:** Implement Option 1's relative path calculation PLUS add a project setting to toggle between relative and absolute paths.

**Default behavior:** ALL projects (new and existing) will use relative paths by default. This is a breaking change but aligns with Astro's conventions.

**Rationale:**

1. Aligns with Astro's defaults and best practices (confirmed by docs)
2. Better UX for majority of users (no Astro config required)
3. Provides escape hatch for edge cases (users with custom image components, etc.)
4. Implementation is straightforward with low risk
5. We have all necessary data
6. Breaking change is justified - affects few users and is easy to revert via setting

---

## Implementation Plan

### Phase 1: Add Setting to Preferences Schema

#### 1.1 Update Rust Preferences Model

**File:** `src-tauri/src/models/preferences.rs` (or wherever `ProjectPreferences` is defined)

```rust
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ProjectPreferences {
    // ... existing fields ...

    #[serde(default = "default_use_relative_asset_paths")]
    pub use_relative_asset_paths: bool,
}

fn default_use_relative_asset_paths() -> bool {
    true // Default to relative (Astro's convention)
}
```

#### 1.2 Update TypeScript Preferences Type

**File:** `src/types/preferences.ts` (or wherever preferences types are defined)

```typescript
export interface ProjectPreferences {
  // ... existing fields ...
  useRelativeAssetPaths: boolean // defaults to true
}
```

#### 1.3 Add Settings UI Toggle

**File:** `src/components/settings/ProjectSettings.tsx` (or appropriate settings component)

Add a toggle control in the "Assets" or "Paths" section:

```tsx
<div className="space-y-2">
  <Label>Asset Path Style</Label>
  <div className="flex items-center space-x-2">
    <Switch
      checked={preferences.useRelativeAssetPaths ?? true}
      onCheckedChange={checked =>
        updatePreference('useRelativeAssetPaths', checked)
      }
    />
    <span className="text-sm">Use relative paths for images (recommended)</span>
  </div>
  <p className="text-xs text-muted-foreground">
    When enabled, images use paths relative to the current file (e.g.,{' '}
    <code>../../assets/image.png</code>). When disabled, paths are absolute from
    project root (e.g., <code>/src/assets/image.png</code>).
  </p>
</div>
```

---

### Phase 2: Update Rust Commands

#### 2.1 Add Dependency

**File:** `src-tauri/Cargo.toml`

```toml
[dependencies]
pathdiff = "0.2"
# ... other dependencies
```

#### 2.2 Update Copy Commands

**File:** `src-tauri/src/commands/files.rs`

Add two new parameters to both copy commands and implement conditional path logic:

```rust
#[tauri::command]
pub async fn copy_file_to_assets(
    source_path: String,
    project_path: String,
    collection: String,
    current_file_path: String,           // NEW
    use_relative_paths: bool,            // NEW
) -> Result<String, String> {
    // ... existing validation and copy logic ...

    // After copying, get the project-relative path
    let project_relative_path = /* ... existing copy logic result ... */;

    // Convert to appropriate path style based on setting
    let final_path = if use_relative_paths {
        calculate_relative_path(&current_file_path, &project_path, &project_relative_path)?
    } else {
        // Absolute path from project root (legacy behavior)
        format!("/{}", project_relative_path.replace('\\', "/"))
    };

    Ok(final_path)
}

#[tauri::command]
pub async fn copy_file_to_assets_with_override(
    source_path: String,
    project_path: String,
    collection: String,
    assets_override: String,
    current_file_path: String,           // NEW
    use_relative_paths: bool,            // NEW
) -> Result<String, String> {
    // Same pattern as copy_file_to_assets
    // ... existing logic ...

    let final_path = if use_relative_paths {
        calculate_relative_path(&current_file_path, &project_path, &project_relative_path)?
    } else {
        format!("/{}", project_relative_path.replace('\\', "/"))
    };

    Ok(final_path)
}

#[tauri::command]
pub async fn get_relative_path(
    file_path: String,
    project_path: String,
    current_file_path: String,           // NEW
    use_relative_paths: bool,            // NEW
) -> Result<String, String> {
    // For files already in project (no copy needed)
    // ... existing validation ...

    let project_relative_path = /* ... existing logic ... */;

    let final_path = if use_relative_paths {
        calculate_relative_path(&current_file_path, &project_path, &project_relative_path)?
    } else {
        format!("/{}", project_relative_path.replace('\\', "/"))
    };

    Ok(final_path)
}
```

#### 2.3 Implement Path Calculation Helper

**File:** `src-tauri/src/commands/files.rs`

Add this helper function:

```rust
use pathdiff::diff_paths;

fn calculate_relative_path(
    current_file_path: &str,
    project_path: &str,
    project_relative_asset_path: &str,
) -> Result<String, String> {
    // Get directory containing the current markdown file
    let current_file = Path::new(current_file_path);
    let current_file_dir = current_file
        .parent()
        .ok_or("Invalid current file path")?;

    // Get the asset's full path
    let asset_full_path = Path::new(project_path).join(project_relative_asset_path);

    // Calculate relative path from file directory to asset
    let relative_path = diff_paths(&asset_full_path, current_file_dir)
        .ok_or("Could not calculate relative path")?;

    // Convert to string with forward slashes (Markdown convention)
    let path_string = relative_path
        .to_string_lossy()
        .replace('\\', "/");

    // Ensure ./ prefix for same-directory files (clearer than bare filename)
    let final_path = if path_string.starts_with("../") {
        path_string
    } else {
        format!("./{}", path_string)
    };

    Ok(final_path)
}
```

---

### Phase 3: Update TypeScript Callers

#### 3.1 Update Core File Processing Function

**File:** `src/lib/files/fileProcessing.ts`

Update `processFileToAssets` signature and implementation:

```typescript
export async function processFileToAssets(
  sourcePath: string,
  projectPath: string,
  collection: string,
  currentFilePath: string, // NEW
  useRelativePaths: boolean, // NEW
  copyStrategy: 'always' | 'only-if-outside-project' = 'always',
  assetsOverride?: string
): Promise<string> {
  // Handle files already in project
  if (copyStrategy === 'only-if-outside-project') {
    const isInProject = sourcePath.startsWith(projectPath)

    if (isInProject) {
      const relativePath = await invoke<string>('get_relative_path', {
        filePath: sourcePath,
        projectPath,
        currentFilePath, // NEW
        useRelativePaths, // NEW
      })
      return relativePath
    }
  }

  // Copy file to assets
  const command = assetsOverride
    ? 'copy_file_to_assets_with_override'
    : 'copy_file_to_assets'

  const args = assetsOverride
    ? {
        sourcePath,
        projectPath,
        collection,
        assetsOverride,
        currentFilePath, // NEW
        useRelativePaths, // NEW
      }
    : {
        sourcePath,
        projectPath,
        collection,
        currentFilePath, // NEW
        useRelativePaths, // NEW
      }

  const resultPath = await invoke<string>(command, args)

  // No longer normalize here - Rust returns final format
  return resultPath
}
```

**Important:** Remove the leading slash normalization that currently exists around line 78-80. Rust now handles the final path format.

#### 3.2 Update Drag-and-Drop Handler

**File:** `src/lib/editor/dragdrop/fileProcessing.ts`

Update the call site to pass the new parameters:

```typescript
export async function handleFileDropIntoEditor(/* ... existing params ... */) {
  const { projectPath, preferences } = useProjectStore.getState()
  const { currentFile } = useEditorStore.getState()

  // Get preference (default to true if not set)
  const useRelativePaths = preferences.useRelativeAssetPaths ?? true

  const assetPath = await processFileToAssets(
    filePath,
    projectPath,
    currentFile.collection,
    currentFile.path, // NEW: Pass current file path
    useRelativePaths, // NEW: Pass preference
    'always',
    assetsPathOverride
  )

  // ... rest of the logic
}
```

#### 3.3 Update Frontmatter Image Field

**File:** `src/components/frontmatter/fields/ImageField.tsx`

Update the file selection handler:

```typescript
const handleFileSelection = async (filePath: string) => {
  const { projectPath, preferences } = useProjectStore.getState()
  const { currentFile } = useEditorStore.getState()

  // Get preference (default to true if not set)
  const useRelativePaths = preferences.useRelativeAssetPaths ?? true

  const assetPath = await processFileToAssets(
    filePath,
    projectPath,
    currentFile.collection,
    currentFile.path, // NEW: Pass current file path
    useRelativePaths, // NEW: Pass preference
    'only-if-outside-project',
    assetsPathOverride
  )

  updateFrontmatterField(name, assetPath)
}
```

---

### Phase 4: Verify Image Hover Preview Compatibility

**File:** `src-tauri/src/commands/files.rs` (around line 875-928)

**Action:** Review the `resolve_image_path` command to confirm it handles both path styles:

- Relative paths: `./image.png`, `../../assets/image.png`
- Absolute paths: `/src/assets/image.png`

**Expected:** The function already handles relative paths starting with `./` or `../`. If not, update it.

---

### Phase 5: Testing

#### 5.1 Manual Testing Checklist

**Setup:** Create test Astro project with:

- Collection in `src/content/articles/`
- Subdirectory `src/content/articles/2025/`
- Nested subdirectory `src/content/articles/2025/january/`
- Assets directory `src/assets/articles/`

**Test Matrix:**

| File Location                   | Expected Relative Path                  | Expected Absolute Path           |
| ------------------------------- | --------------------------------------- | -------------------------------- |
| `articles/post.md`              | `../../assets/articles/image.png`       | `/src/assets/articles/image.png` |
| `articles/2025/post.md`         | `../../../assets/articles/image.png`    | `/src/assets/articles/image.png` |
| `articles/2025/january/post.md` | `../../../../assets/articles/image.png` | `/src/assets/articles/image.png` |

**For each file location, test:**

- [ ] Drag & drop image into editor (creates markdown image tag)
- [ ] Upload image via frontmatter image field
- [ ] Upload file already in project (no copy, just path generation)
- [ ] Custom asset path override at project level
- [ ] Custom asset path override at collection level
- [ ] Toggle setting OFF → verify absolute paths
- [ ] Toggle setting ON → verify relative paths
- [ ] Image hover preview works with both path styles
- [ ] Cross-platform: Test on Windows (path separators)

#### 5.2 Edge Cases to Test

- [ ] Image in same directory as markdown file → `./image.png`
- [ ] Very deeply nested file → `../../../../../../../../assets/image.png`
- [ ] Asset path with spaces or special characters
- [ ] Multiple images in same operation
- [ ] Switching setting mid-session (new images use new setting)

---

### Phase 6: Documentation and Migration

#### 6.1 Breaking Change Notice

All projects (new and existing) will use relative paths by default. Document this clearly in release notes.

**Release Notes Template:**

```markdown
## Breaking Change: Relative Asset Paths

Astro Editor now uses **relative paths** for images by default, matching Astro's conventions.

**Before:** `/src/assets/articles/image.png`
**After:** `../../assets/articles/image.png`

### Why this change?

Astro expects relative paths by default. Absolute paths require custom configuration
in your Astro project. This change provides the best out-of-the-box experience.

### Migration

**If you prefer absolute paths:**

1. Open Project Settings
2. Disable "Use relative paths for images"
3. New images will use absolute paths

**Existing markdown files:** Continue to work as-is. Only newly uploaded images
will use the new default.

### For Astro Sites

If you've configured your Astro site to handle absolute paths, you can either:

- Revert that configuration (recommended)
- Disable relative paths in Astro Editor settings
```

#### 6.2 Update User Guide

If there's a user guide section on asset management, add:

```markdown
### Asset Path Styles

Astro Editor can generate paths in two styles:

- **Relative paths** (default): `../../assets/articles/image.png`
  - Paths are relative to the current markdown file
  - Works out-of-the-box with Astro
  - Recommended for most users

- **Absolute paths** (legacy): `/src/assets/articles/image.png`
  - Paths are absolute from project root
  - Requires Astro configuration
  - Use this if you have custom image components that expect absolute paths

To change this setting, go to Project Settings → Asset Path Style.
```

---

## Summary of Files to Modify

### Rust (Backend)

1. `src-tauri/Cargo.toml` - Add `pathdiff` dependency
2. `src-tauri/src/models/preferences.rs` - Add `use_relative_asset_paths` field
3. `src-tauri/src/commands/files.rs` - Update 3 commands + add helper function

### TypeScript (Frontend)

4. `src/types/preferences.ts` - Add `useRelativeAssetPaths` field
5. `src/lib/files/fileProcessing.ts` - Update function signature + remove normalization
6. `src/lib/editor/dragdrop/fileProcessing.ts` - Pass new parameters
7. `src/components/frontmatter/fields/ImageField.tsx` - Pass new parameters

### UI

8. `src/components/settings/ProjectSettings.tsx` - Add toggle control

### Testing

9. Manual testing checklist (see Phase 5)
10. Verify `resolve_image_path` compatibility

### Documentation

11. Release notes - Breaking change notice
12. User guide - Document setting (if applicable)

---

## Estimated Effort

**3-4 hours** including comprehensive testing across directory structures and platforms.

---

## Risk Assessment: LOW

**Risks:**

- Breaking change may surprise existing users
- Edge cases with unusual directory structures

**Mitigations:**

- Clear release notes and migration guide
- Setting provides easy opt-out to legacy behavior
- Comprehensive testing checklist
- Default aligns with Astro best practices (long-term benefit)
