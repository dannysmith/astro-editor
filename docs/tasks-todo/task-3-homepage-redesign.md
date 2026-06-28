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

## Approach & Decisions

Agreed up front:

- **Styling:** Scoped Astro `<style>` blocks driven by the Flexoki CSS variables already in `src/layouts/Layout.astro`. **No Tailwind** — the current homepage's `https://cdn.tailwindcss.com` gets removed. This matches the taskdn homepage pattern (`~/dev/taskdn/website/src/pages/index.astro`) and the docs site's aesthetic.
- **Fonts:** Start with `system-ui` and revisit once there's an initial design (Phase 3). A web font (e.g. Google Fonts, or self-hosted via Fontsource to stay off a CDN) is fine if it clearly serves the design — we'll decide then, not now. The iA Writer fonts already live locally in `public/fonts/` for `AEDemo` regardless.
- **Build from scratch:** Start from a near-empty `index.astro` (just the `Layout` + an empty `<main>`) and grow it phase by phase, rather than editing the existing page down. The old homepage is reference material, not a starting point.
- **Theme:** Follow the visitor's OS preference automatically via `light-dark()` (no manual toggle, no JS, no FOUC). The "Designed for Writing" section still shows *both* themes explicitly via a compare slider regardless of the visitor's setting.
- **Media — Lean first:** Astro `<Image>` screenshots as the backbone, `AEDemo` for writing-surface motion, one tiny custom light/dark compare slider, and a click-to-load YouTube facade. No GIFs or bespoke animations in v1. Bespoke HTML/CSS animations and selective GIFs come later as a purely additive phase — each one drops in to replace a screenshot that's already working, so the launch is never blocked on capture/encoding.

### Why we're not blocked on assets

`src/assets/` already holds curated, high-quality screenshots — including the *paired* shots the brief calls for. We migrate everything onto these via Astro `<Image>` and stop referencing the older `public/*.png` set.

The key new additions are the three `main-demo-image-*` shots: the **same content file** rendered in Astro Editor light, Astro Editor dark, and VS Code — all the same dimensions, both AE sidebars open, showing rich frontmatter (including a cover image field). One set does triple duty: the hero VS Code↔AE contrast, the light/dark compare slider (identical but for colour → a clean swipe/swap), and a frontmatter showcase.

| Section | Existing assets in `src/assets/` |
|---|---|
| Hero contrast | `main-demo-image-vscode.png` (looks horribly complex) ↔ `main-demo-image-light.png` / `main-demo-image-dark.png` (clean, both sidebars open) |
| Light/dark compare | `main-demo-image-light.png` **+** `main-demo-image-dark.png` (identical except colour) |
| Frontmatter | `main-demo-image-{light,dark}.png` (sidebar + cover image field), `frontmatter-sidebar-overview.png`, `nested-field-example.png`, `nested-image-field.png` |
| Writing | `focus-mode.png`, `typewriter-mode.png`, `clean-editor-view.png`, `image-preview-demo.png` |
| MDX inserter | `mdx-builder-1.png`, `mdx-builder-2.png`, `mdx-builder-3.png` |
| Other features | `command-palette.png`, `copyedit-highlights.png`, `file-manager-{filter,drafts-filter,sort,1,2,3}.png` |

The only genuinely motion-specific things (image drag-and-drop, paste-URL-over-selection) are handled by `AEDemo` or deferred to the optional later phase.

### Per-feature media strategy (v1)

- **Hero** → static VS Code ↔ Astro Editor contrast using the `main-demo-image-*` set (same file, so the contrast is honest) + an `AEDemo` typing out a clean, focused writing surface. No GIF.
- **Frontmatter** → screenshots. Form/interaction-heavy; a clean annotated screenshot conveys "schema fields appear even when absent from your frontmatter" better than motion.
- **Designed for Writing** → a small custom light/dark compare slider (clip-path + range input, no dependency) over `main-demo-image-light.png` / `main-demo-image-dark.png` (pixel-aligned, so the swipe is seamless), plus `AEDemo` for focus/typewriter.
- **MDX inserter** → the three `mdx-builder` shots as a short sequence.
- **Working with Images** → screenshots for v1; flag a drag-drop GIF as later polish (the one place motion genuinely adds information).
- **Other features** → screenshot cards.
- **Video** → embedded near the bottom as a click-to-load facade (thumbnail + play button swaps in the iframe), not an eager YouTube iframe — better perf, fits the privacy-first ethos.

### Page structure & components to extract

Final section order: **Header/Nav → Hero → Download → Frontmatter → Designed for Writing → MDX Components → Working with Images → Other Features → Video → Footer.**

New components under `website/src/components/` (lean on `AEDemo`, `Figure`, and Astro `<Image>` where they already fit):

- `SiteHeader.astro` — responsive nav with mobile menu (logo, Features, Docs, GitHub, Download).
- `SiteFooter.astro` — footer (Privacy, Docs, GitHub, Download, copyright).
- `DownloadButtons.astro` — the macOS / Windows / Linux-beta download block, reused in hero + download section.
- `FeatureSection.astro` — alternating media/text section wrapper (`title`, body slot, media slot, `reverse` prop), mirroring taskdn's `.product` pattern.
- `WindowChrome.astro` / `Screenshot.astro` — a framed screenshot wrapper (mirror taskdn's `WindowChrome.astro`).
- `ThemeCompareSlider.astro` — light/dark before/after slider.
- `YouTubeFacade.astro` — click-to-load video embed.

`Layout.astro` is reused as-is (its Flexoki vars + `light-dark()` already do what we need); we just stop overriding it to dark-only in `index.astro`. If the page needs a couple more semantic tokens (accent, hairline), add them to `Layout.astro`'s `:root` rather than inline.

## Implementation Plan

Each phase is independently reviewable. No phase depends on assets that don't already exist (except the clearly-flagged optional Phase 6).

### Phase 1 — Foundations & scaffolding

- Replace `index.astro` wholesale with a near-empty shell: `Layout` + an empty `<main>`. The old page is not edited down — it's gone, kept only as reference. (No CDN Tailwind, Google Fonts, dark-only overrides, or aurora/starfield carry over.)
- Add empty placeholder sections (semantic HTML) for each part of the final structure so later phases have somewhere to slot into.
- Establish shared scoped-style conventions: container max-width, section vertical rhythm, spacing scale, responsive breakpoints (reuse taskdn's `900px` / `600px` breakpoints as a starting point).
- Confirm `Layout.astro`'s `light-dark()` vars render correctly without the dark-only override; add any missing semantic tokens (accent, hairline) to its `:root`.

### Phase 2 — Chrome: header, footer, download

- `SiteHeader.astro` — responsive nav + accessible mobile menu (keyboard-navigable, focus-trapped), GitHub icon link, Docs link, Download CTA.
- `SiteFooter.astro` — links to Privacy, Docs, GitHub, Download + copyright.
- `DownloadButtons.astro` — extract the macOS (Universal), Windows, and Linux-beta (AppImage/.deb/.rpm) buttons + Homebrew snippet from the current page; keep the real release-asset URLs.
- Simplify nav anchors to the new section set (no need to preserve `#features` / `#how` for external links).
- Preserve/clean up SEO: keep the `SoftwareApplication` JSON-LD and per-page meta via the `head` slot; confirm OG/Twitter tags resolve. (OG image itself is out of scope for now.)

### Phase 3 — Hero

- Rewrite the headline and subhead in an honest, developer-to-developer voice (no marketing slop, no "CMS experience your content deserves"). Lead from the philosophy: *writer mode vs coder mode*, an interface for the content files you already have.
- VS Code ↔ Astro Editor contrast: `main-demo-image-vscode.png` against `main-demo-image-light.png`/`dark.png` — framed `<Image>`s side-by-side on desktop, stacked on mobile. Same file in both, so the "look how much calmer this is" point lands honestly.
- `AEDemo` typing out the clean, focused writing surface (sidebars shut) directly below the contrast.
- Primary download CTA (reuse `DownloadButtons` or a condensed variant).

### Phase 4 — Main feature sections

Build `FeatureSection.astro`, then each feature as an alternating section:

- **Working with Frontmatter** — schema-aware forms generated from the Zod schema; emphasise that schema fields show up *even when not yet present in the file's frontmatter*, plus smart image fields. Assets: `frontmatter-sidebar-overview.png`, `nested-field-example.png`, `nested-image-field.png`.
- **Designed for Writing** — `ThemeCompareSlider` over `main-demo-image-light.png` / `main-demo-image-dark.png`; `AEDemo` for focus + typewriter; concise list for beautiful typography, editing shortcuts, paste-URL-over-selection, link hovering, image-preview-on-hover.
- **Inserting MDX Components** — short sequence of `mdx-builder-1/2/3.png` with brief copy (unique feature, minimal explanation).
- **Working with Images** — drag-in → rename → copy-to-correct-place → link inserted; cover frontmatter image fields and Option-hover preview here. Assets: `nested-image-field.png`, `image-preview-demo.png`.
- **Other Features** — compact card grid: Drafts/Filtering/Sorting (`file-manager-*`), Copyedit modes (`copyedit-highlights.png`, brief note on colour-coded parts of speech), Command Palette (`command-palette.png`, "the whole thing is keyboard-navigable").

### Phase 5 — Video & launch polish

- `YouTubeFacade.astro` near the bottom (thumbnail + play button → swap in the iframe on click).
- Responsive QA across mobile / tablet / desktop; verify the alternating sections and hero contrast reflow cleanly.
- Accessibility pass: descriptive alt text on every image, correct heading order, visible focus states, keyboard-operable mobile menu, `prefers-reduced-motion` respected (already honoured by `AEDemo`; ensure the slider and any transitions do too).
- Light/dark visual QA in both OS settings.
- Run `bun run check` (type check + lint + format) and a Lighthouse/SEO pass.

### Phase 6 — Bespoke animations & GIFs (optional, additive)

Each item below is a drop-in replacement for a working screenshot, guarded by `prefers-reduced-motion`:

- Candidate bespoke HTML/CSS animations: paste-URL-over-selection, command palette, MDX inserter flow.
- Candidate GIFs (where motion carries real information): image drag-and-drop into the editor.
- Maintain a capture checklist for any new screenshots/GIFs and add them to `src/assets/`.
