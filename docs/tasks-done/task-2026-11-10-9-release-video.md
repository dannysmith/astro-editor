# Task: Videos for 1.1.0

GitHub: #354

Two videos: a one-off "what's new in 1.1.0" video to share on socials with the release, and an update to the homepage video, whose MDX scene shows the builder as it was before the props form.

## The 1.1.0 video

For sharing the release (Bluesky, the Astro Discord, the blog post), so it should make sense with the sound off and without the website around it. Short: well under a minute.

1. **"Astro Editor 1.1.0 is here."** A bold opening.
2. **What Astro Editor is,** in a few seconds, for people who haven't seen it: an editor for Astro content collections, with schema-aware frontmatter forms, built for writing. Reuse scenes B and C of the homepage video (`website/video/`) rather than making new ones.
3. **What's new,** a scene each:
   - **The MDX component builder's props form** (#350): pick a component, fill in its props in a form built from its types (including Vue and Svelte), with image and entry pickers, and Starlight's own components in Starlight projects.
   - **Auto-imports** (#357, experimental): inserting a component adds its `import`, matching how the site already imports things.
   - **Projects and Project Settings** (#82, #361): AE reads where each collection lives from its loader, so content outside `src/content` just works; the project list with project icons; Project Settings as a readout of what was found, where you only correct what's wrong.
   - **File names from a pattern** (#87): `{YYYY-MM-DD}-{title}` and friends, renamed once the title is written.
4. **Everything else,** as one quick list scene. Mostly what's new in 1.1.0 (#354's items after v1.0.20, and this branch's task docs): saving before quitting (#364), the Windows startup crash (#351), the window keeping its size across displays, Zod 4 tuples, literals and unions, image pickers for arrays of images, the sidebar refreshing on changes made outside the app, and the many small fixes. Highlights from 1.0.18–1.0.20 can go in too, such as Astro 7 support and dates you can't misread.
5. **End card:** download link and version.

### How

- Use the `personal:video-creator` skill, and build on `website/video/`'s pipeline (an HTML page with a stateless `render(t)`, rendered frame by frame), reusing its intro scenes, editor styling and soundtrack code where they fit.
- Recreate the app's UI in HTML, as the homepage video does, rather than screen recording, so it can be animated precisely. Real screenshots from `bun run app` (Project Settings, the project list) are fine for still moments.
- Keep the one-off code out of the website: build it in `docs/tasks-todo/temporary/` (gitignored) or a throwaway folder, and delete it once the MP4 is made. Only the MP4 is kept, wherever it's shared from, not in the repo.

## The homepage video

Scene F (`sceneF` in `website/video/index.html`) shows the old MDX popup: search, pick, insert. Change it to show the props form and the import being added, keeping its slot in the timeline (39.6–45.3s) so the sound cues in `synth.mjs` still line up. Then `bun run video` (outside the sandbox; see `website/video/README.md`) and commit the new MP4 and poster.

## Done when

- [x] The 1.1.0 video is rendered and Danny has it: 50s, built from a copy of `website/video/` with its own timeline and soundtrack (the opener and schema scenes reused through time remapping, the props form and imports, a new file renamed from its title, collections read from the config, the project list, Project Settings, and a list of everything else).
- [x] The code used to make it is deleted, with the rest of `docs/tasks-todo/temporary/`.
- [x] The homepage video shows the props form, and its MP4 is committed (the poster frame didn't change). Scene F now types "book", fills BookCard's form and inserts the tag; its sounds are retimed in `synth.mjs`. Danny updates the README's video on GitHub.
