# Task: Use relative paths for images and files in editor and frontmatter

https://github.com/dannysmith/astro-editor/issues/53

Images and files dragged into the editor and images added via the frontmatter panel currently work like this:

1. The file/image is copied to a subfolder of the configured assets directory named after the relevant content collection, and renamed to include today's date and remove spaces etc. (Except for frontmatter uploads where the image is already somewhere in the astro project)
2. The resultant markdown tag or frontmatter field is generated as an **absolute path relative to the Astro project root**.

So  an `image.png` added to a file in an `articles` collection will generate a path like `/src/assets/articles/2025-01-01-image.png`, assuming no project or collection-specific path overrides are in place.

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

1. The file structure of an Astro site is a **Coder Mode**  concern. As a **Writer Mode** tool, Astro Editor should not depend on coder-mode implementation details.
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

<!-- Frontmatter (also relative to file) -->
---
cover: "./firstpostcover.jpeg" # resolves to src/content/blog/firstblogcover.jpeg
---
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

### Recommendation

**Implement Option 1: Calculate Relative Paths in Rust**

**Rationale:**
1. Aligns with Astro's defaults and best practices (confirmed by docs)
2. Better UX for majority of users (no Astro config required)
3. Implementation is straightforward with low risk
4. We have all necessary data
5. ~Breaking change is justified and affects few users~

**Next steps if proceeding:**
1. Add `pathdiff = "0.2"` to `Cargo.toml`
2. Modify Rust commands to accept `current_file_path` and calculate relative paths
3. Update TypeScript call sites to pass `currentFile.path`
4. Remove leading slash normalization
5. Write comprehensive tests for various directory structures
6. Test with subdirectories, custom asset paths, and files already in project
7. Update user guide to document the change
8. Consider adding "Use absolute paths" setting for edge cases (optional, can add later if needed)

**Alternative (if hesitant about breaking change):**
Implement Option 2 with setting, default to "relative" for new projects, "absolute" for existing projects (detected by absence of setting). This avoids breaking existing users while making the right choice for new users.
