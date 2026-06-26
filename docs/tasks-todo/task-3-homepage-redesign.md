# Task: Complete Homepage Redesign

We have recently merged a lot of work to switch from a pretty boring static marketing page for Astro Editor to a statically built Starlight site in `website/` .The site's homepage at `website/src/pages/index.astro` is a simple port from the very old AI-generated static homepage.

## Task

Start from scratch and redesign the homepage from the ground up to show off and explain Astro Editor's features and encourage folks to use it.

## Probable Sections

These sections can look somewhat different from each other, I guess, but we need to make sure they work on different viewport widths. Make sure they look beautiful, if it's possible, of course, we can also perhaps look at either recording and embedding GIFs, or we can maybe look at faithfully reproducing some of the things maybe with a bit of animation here actually using HTML and CSS. but then maybe that's too much work. It really depends on what the feature here is. Obviously we could also look at screenshots and so on and so forth. 

### "Hero"

This is the main bit and should make it immediatly clear what Astro Editor does and how nice it looks, so people "get it" and think "damm I want that". Probably the best way to achieve this would be visually contrasting an open file or project in VS Code with all the incumbent messiness And then a file open with both sidebars open in After Editor showing the same frontmatter and content and everything. And then possibly immediately after that having some kind of animated demonstration of the same file with both sidebars shut nothing showing at the top and focus mode and typewriter mode on to show a completely distracting this environment. 

### Download

Pretty similar to what we have now. Includes the download buttons etc.

### Main Features

I feel like we should really clearly demonstrate the most compelling features of Astro Editor and I would suggest probably in this order:

#### Working with Frontmatter

The key Things here are that we read the actual Astro schema And provide suitable forms in the front matter based on the types in that. And one big advantage we don't really want to mention here is this means that if you're in a content collection, even fields which are in the schema but aren't yet in your front matter will show up here. So you don't have to remember what's actually in the schema for this content item. I guess this should probably also include like smart image fields. 

#### Designed for Writing

We can probably wrap all of these features together here: Focus + Typewriter mode, beautiful typography for writing, keyboard shortcuts for editing, stuff like paste URL over selection etc. Should probably include image preview on hover as well. And you know, hovering to open links, these kinds of things. We should definitely also show some kind of dark mode, light mode thing here. This could be as simple as like a switch drag to move between two screenshots. I'm sure there's an Astro extension for that. Or we could do something a bit smarter. But obviously no matter what theme the user is in, we need to show them that Astro Editor supports light and dark mode here as well, and it's beautiful in both. 

#### Inserting MDX Components

This is basically the MDX component inserter. This is quite a unique feature, so well it probably doesn't need tons of explanation being able to show off and if you have a component that looks like this, like a cool out or something, you can insert it really easily into and MDX doc. 

#### Working with Images

I feel like we should probably also cover like dragging images in here and how they're renamed, copied to the right place appropriately, and the links inserted. Cause again that just makes things way easier for authors. this might actually be the place to also show how we support images in the front ladder panel rather than in that section with you know a screenshot because it works basically the same way. And I guess this actually might be a better place to also cover hovering an image to get a preview rather than in the front battery section. 

#### Other Features

So the features above I think are like the main selling points and really the reason that people are gonna be interested. However, it's probably worth highlighting a few other features which I think are important enough to highlight on the marketing page.I suspect that these are gonna be:

- Drafts, Filtering and Sorting (Covering this we're also bound to show how you know the the sidebar works for collection items and stuff. )
- Copyedit modes - I think this is probably the easiest way of showing this is just gonna be like a screenshot and a brief explanation that we use different colours to highlight different types of word. That screenshot can just have all of them switched on.
- The Command Palette (eg easy keyboard navigability) - Again, this is probably just a GIF or a screenshot or an animation or something of the command palette. This is really just saying the whole thing's keyboard navigable and we've got a command palette so you can work quickly. 

I think most of the other features here, unless I've missed something really important, are probably not actually that important on this page, and then it'll be covered anyway when people go and look into the docs. 

### Video Bit

We should embed the YouTube video which is currently at the top somewhere nearer the bottom - it's pretty long.

## Other Things it needs

- Header/Nav similar to now(must work on mobile too)
- Footer similar to now (links to privicy, docs, github, download etc)
- Decent SEO stuff, and OG Image and the like - this stuff might well be manageable directly through Starlight rather than actually needing it to be specific to this page.

## Points to note

- We should make proper use of Astro and existing features where sensible (bearing in mind this is a marketing page not a docs page).
  - We have `Layout.astro` which provides a base HTML shell and Flexoki CSS variables which we may want to use, or base another homepage specific layout on.
  - We have Astro and starlight componets like `<Image>` which we should use, and we should generally follow Astro's best practices.
  - We have the AEDemo component which we use in various places in the docs which we may also be able to use here (or improve/adapt as needed).
  - For any repetative code or obviosuly extractable stuff we should look for opportunities to extract into shared Astro components.
- We should use modern CSS and Astro features like scoped styles to keep our styling clean. Where possible, we shouldn't be leaning on external public CDNs but if we need Tailwinnd we can install it properly into Astro/Starlight.
- You can reference the Taskdn homepage (`~/dev/taskdn/website/src/pages/index.astro`) for patterns (also uses a flexoki palette, `light-dark()`, component extraction, accessible animations and is a similar site structure).
- We can refer to the documentation in `website/src/content/docs/` for A load of information about like philosophy and what features we have. And obviously while it's fine to like repeat some of what's in there we shouldn't be repeating reams of text here right because this is for getting people to wanna go read those docs or wanna download it and have a try with it right.
- While this is designed to get people interested, remember that the audience for this are gonna be developers working locally with their own Astros sites. And also remember that we don't want to be writing a whole bunch of nonsense marketing speak in here, partly because of the fact that these are developers and this is an open source project. And partly because I'm not into AI slop and marketing slop.

## Implementation Plan

TBC
