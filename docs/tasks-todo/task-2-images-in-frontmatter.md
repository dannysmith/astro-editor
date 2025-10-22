## Task: Support Astro image helper in content colelctions

We have recently implemented floating image previews in the editor. When holding option and hovering over any image URL or path, it's displayed in a floating window as a preview.

Astro supports images in content collections. See here for the docs: https://docs.astro.build/en/guides/images/#images-in-content-collections

I would like to update the parser to recognize when we have an image field and rather than rendering a string component, I would like to render an image component which should have a shadcn file picker which allows the user to choose a file but also allows drag and drop into it.

Once a file has been chosen it should use the same mechanism to rename it and move it to the correct assets directory. This should be the same code that we currently use when files or images are dragged into the editor. And then ideally we should use the same underlying code to show a small preview of that image just below the picker. When we tried to implement this before, it got very complicated very quickly. I don't see why it should be that complicated to implement this.
