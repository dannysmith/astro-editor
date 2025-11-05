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
