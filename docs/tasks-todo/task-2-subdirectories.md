# Task: Subdirectories in collections

Currently the application assumes that the content for markdown/mdx content collections will be in `src/content` (or whatever other path is configured in the settings), with each having its own subdirectory (usually named after the collection). It assumes that the content will be a flat collection of md/mdx files under these directories.

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

Many Astro sites organize the files within a single content collection using subdirectories. In the example above, notes may be split up into different folders within `src/content/notes` to help with file management, despite them all being part of the same content collection with the same schema.

Astro Editor should support this in the left File browser sidebar. It should show any subdirectories at the top of the file browser and when drilling down into one should show the "breadcrubs" at the top of the sidebar alongside the currently open collection. It should be easy to go back up. Basically, as you would expect a file browser to work.

- When creating a new file, it should be created in whichever directory is open in the left sidebar. If we're in a subdirectory, the file should be created in that. And if we're not in any sort of subdirectory, it should just be created in the root directory for that content collection as it currently is.
- There is absolutely no need to add any features to allow us to move files between subdirectories. That's a job that should be done in an external text editor or in Finder. If a user creates something in the wrong subdirectory, they should just delete it and then create it in the right place. There's no need to add anything about any features to do with this at all to the app.
- The UI should definitely make it clear what content collection we're in, since currently the UI in the sidebar, both a folder and a content collection are represented in the same way, i.e. at the top level. So we just need to make sure that the UI is just clear when we're, say, changing to a new content collection in the UI. This should be pretty simple.
- Because the top level in our left sidebar UI is always going to be content collections, i.e. when we're looking at a whole project we're going to see a list of all the content collections. This kind of new almost file browser-y type thing where we can drill down into sub-directories only needs to apply within those content collections.

Now there are some astro sites that have even more complex setups with subdirectories where there are different content collections stored within more complicated subdirectory trees. But I think for a first pass at what we need to do here, we can assume that each content collection which uses the glob schema has exa

## Stretch Features

- A collection-level setting which allows for a custom path to be set to the top-level "content" directory for this collection. This allows for non-standard locations for the actual content files. If the collection is loaded using a _simple_ glob loader in `content.config.ts` it will contain a path to the location of the files. We can detect if this is non-standard and automatically set the custom content directory path for this collection.
- Ability to move a file from one subdirectory to another in the UI.
