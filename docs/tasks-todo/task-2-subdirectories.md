# Task: Subdirectories in collections

Currently the application assumes that the content for markdown/mdx content collections will be in `src/content` (or whatever other path override is configured in the settings), with each having its own subdirectory (usually named after the collection). It assumes that the content will be a flat collection of md/mdx files in these directories.

```
src/content
|- notes
  |- file1.md
  |- file2.md
|- articles
  |- article1.mdx
  |-article2.mdx
```

Any Markdown or MDX files in subdirectories underneath these are ignored.

Many Astro sites organize the md/mdx files within a single content collection using subdirectories. In the example above, notes may be split up into different folders within `src/content/notes` to help with file management, despite them all being part of the same content collection with the same schema.

Astro Editor should support this in the left File browser sidebar. It should show any subdirectories at the top of the file browser and when drilling down into one should show the "breadcrubs" at the top of the sidebar alongside the currently open collection. It should be easy to navigate back up. Basically, as you would expect a file browser sidebar to work. I don't think the UI should include expandable and collapsible file trees here. I think that will clutter the UI too much.

- When creating a new file, it should be created in whichever directory is currently open in the left sidebar. If we're in a subdirectory, the file should be created in that. And if we're not in any sort of subdirectory, it should just be created in the root directory for that content collection as it currently is.
- There is no need to add any features to allow us to move files between subdirectories for now. That's a job that should be done in an external text editor or in Finder.
- The UI should definitely make it clear what content collection we're in at all times. This is currently done in the header of the sidebar, but if we're in a subdirectory of a collection we should be clear what dub-dir were in and what collection.
- Because the top level of the hierachy in our left sidebar UI is always going to be content collections, i.e. when we're looking at a whole project we're going to see a list of all the content collections. This kind of new almost file browser-y type thing where we can drill down into sub-directories only needs to apply within those content collections.

## Future Features

- A collection-level setting which allows for a custom path to be set to the top-level "content" directory for this collection. This allows for non-standard locations for the actual content files. If the collection is loaded using a _simple_ glob loader in `content.config.ts` it will contain a path to the location of the files. We can detect if this is non-standard and automatically set the custom content directory path for this collection.
