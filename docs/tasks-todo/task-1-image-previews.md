# Task: Image Previews

## Part One - Image Previews in editor

in markdown or MDX files when there are image links in there (eg `![Screenshot 2025-09-20 at 22.12.43.png](/src/assets/articles/2025-10-22-screenshot-2025-09-20-at-2212.43.png)`) I want it to be possible to somehow preview these. Now I think the best way of making this work would be that when you mouse over an image and hold option it pops up some kind of overlay somehow which shows a small preview of the image. I want this to be done as simply as possible. I'm choosing option here because we currently use that to enable clicking on URLs. When you hold option you get a cursor point you can click it to open the URL. Now we need to be able to support image links that are inserted using MDX components or markdown links and we need to be able to support ideally images which are externally online from a URL and also which are local in the astro project.

I would suggest that to do this, we don't look specifically for image tags and things. We just look for any URLs at all, which are in the document, that end in an image extension. If they're remote, we go and get that image from the internet. If they're local, we get that image from disk and display it somehow. And that means probably building out full path to where the image is as machine.

I'm keen to do this in the simplest way possible.

## Part Two - Support Astro image helper in content colelctions

Astro supports images in content collections. See here for the docs: https://docs.astro.build/en/guides/images/#images-in-content-collections

I would like to update the parser to recognize when we have an image field and rather than rendering a string component, I would like to render an image component which should have a shadcn file picker which allows the user to choose a file but also allows drag and drop into it.

Once a file has been chosen it should use the same mechanism to rename it and move it to the correct assets directory. This should be the same code that we currently use when files or images are dragged into the editor. And then ideally we should use the same underlying code to show a small preview of that image just below the picker. When we tried to implement this before, it got very complicated very quickly. I don't see why it should be that complicated to implement this.
