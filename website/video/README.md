# Intro video

The 2:30 marketing video on the homepage (`public/astro-editor-intro.mp4`), and two square clips cut from it for social posts. It follows one blog post from a blank page to a pushed commit. It's authored as a web page and rendered to MP4 frame by frame, with a soundtrack synthesised in code.

## How it works

Every frame comes from one function, `render(t)`, which sets every element to where it should be `t` seconds in. It never depends on the previous frame, and there are no CSS transitions or animations. That makes any moment reproducible: the renderer can jump to any time, screenshot it, and move on, however long each screenshot takes.

Almost every animation is built from three helpers in `helpers.js`:

- `seg(t, start, end)` — how far through a time window we are, from 0 to 1.
- `E.*` easing curves — bend that 0–1 value so motion feels natural (`outCubic`, `inOutCubic`, `outBack` for a little overshoot, etc.).
- `lerp(from, to, p)` — map the eased value onto a property: position, scale, opacity, blur, colour.

**Typing** uses `typer()`, which works out a timestamp for every character up front (with seeded randomness, so it looks human but renders identically every time). The markdown is re-highlighted on each frame, so bold and italic snap into place when the closing mark is typed, just like the app.

## The files

| File | Holds |
| --- | --- |
| `index.html` | The stage, and the scripts in load order |
| `timeline.js` | Each chapter's length, the clips, and `cue()` for sound effects |
| `helpers.js` | Timing helpers, `typer()`, and the Markdown renderer |
| `chapters/why.js` | 1. The problem and the brand reveal |
| `chapters/schema.js` | 2. The schema becomes a form, which flies across to become the sidebar |
| `chapters/app.js` | The app window that chapters 3–6 share: the post, camera, scroll, pointer, captions and key presses |
| `chapters/write.js` | 3. The post's text, focus mode, the image, MDX components, frontmatter |
| `chapters/link.js` | 4. The command palette and Content Finder |
| `chapters/edit.js` | 5. Highlights, Harper's checks, removing the cat |
| `chapters/commit.js` | 6. The Git tab: stage, commit, push |
| `chapters/end.js` | 7. The wall of features and the end card |
| `main.js` | The master `render(t)`, and the square clip mode |
| `styles.css` | All the styles |

Scripts are plain `<script>` tags rather than modules, because Chromium blocks modules on `file://` pages.

## Pipeline

Run everything from `website/`:

```bash
bun run video        # the main video, its soundtrack and the web encode
bun run video:clips  # the two square clips (needs the soundtrack from above)
```

`bun run video` runs three scripts in order:

| Script | Does | Output |
| --- | --- | --- |
| `render.mjs` | Screenshots every frame at 60fps in six headless Chromium pages, encodes with ffmpeg | `out/video-silent.mp4` |
| `synth.mjs` | Synthesises the soundtrack: pad, key clicks, whooshes, bells, reverb | `out/audio.wav` |
| `publish.mjs` | Muxes and loudness-normalises a master, then writes the web encode and poster | `out/astro-editor.mp4`, `public/…intro.mp4`, `src/assets/…poster.jpg` |

`clips.mjs` renders each clip and adds its part of the soundtrack, writing `out/clips/astro-editor-copyedit.mp4` and `astro-editor-git.mp4`.

`out/` is gitignored. Frames are deleted once encoded. Commit only the final MP4 and poster, since every committed render stays in the repo's history.

## Editing the video

1. Open `index.html` in Chrome directly from disk. Add `?play` to watch it in real time, `?t=30` to see a single moment, or `?clip=git` for a square clip.
2. Make changes. Each chapter works in times relative to its start (`EDIT + 12.2`), so to make a chapter longer, change its length in `timeline.js` and everything after it moves, sound included.
3. Check specific frames without a full render:

   ```bash
   node video/render.mjs --stills 12.5,30,48
   node video/render.mjs --clip copyedit --stills 2,12
   ```

   This writes `out/stills/`. `--from` and `--to` render just a section.

4. Run `bun run video`, then commit the updated `public/astro-editor-intro.mp4` and `src/assets/intro-video-poster.jpg`.

### What a chapter adds

Chapters 3–6 add to shared lists in `chapters/app.js`, and that file turns them into each frame:

- `CAPTIONS.push([start, end, eyebrow, headline])`
- `camTo(t, duration, { s, cx, cy })` moves the camera: `s` is the zoom, and `cx`, `cy` a point in the 1600×940 window. The clips have their own moves in `CLIP_CAMERA`.
- `keyPress(t, '⌘', '/')` shows key caps.
- `pointerPath([...])` moves the pointer. Stops can name a CSS selector, measured from the page when it loads.
- `cue(kind, t, options)` adds a sound effect. Key clicks follow the typing automatically.

### The camera

People often watch this on a phone, so the camera moves in whenever the action is in something small. It moves between beats and never during typing or a click, holds for at least two seconds, and captions stay the same size whatever it's doing.

### Timeline

| Time | Chapter |
| --- | --- |
| 0:00 | 1. Why it exists |
| 0:13 | 2. It understands your project |
| 0:24 | 3. Write |
| 1:17 | 4. Link |
| 1:27 | 5. Edit |
| 1:53 | 6. Commit |
| 2:18 | 7. End card |

## Assets

The page uses the website's own files where it can, so updated screenshots show up on the next render:

- Screenshots and the app icon from `src/assets/`
- iA Writer fonts from `public/fonts/`
- `assets/` holds only the two demo images the website doesn't have (the cat photo and the book cover, both from `test/demo-project`)

The app UI in chapters 2–6 is recreated in HTML using the app's real labels, messages and editor colours (`src/App.css` in the app) rather than screen-recorded, so it can be animated precisely. The typos in the post are checked against Harper with the app's settings, so its messages and suggestions are real.

## Requirements and gotchas

- **ffmpeg** on your `PATH`, and Playwright's Chromium: `bunx playwright-core install chromium`.
- **Run it outside the Claude Code sandbox.** Chromium can't launch inside it.
- **Keep `render(t)` stateless.** The six render workers each start partway through the video, so anything cached from an earlier frame will be missing. Derive everything from `t` or measure it from the page.
- **Fonts are loaded by name in `main.js`.** The editor's scroll and pointer stops are measured when the page loads, before any editor text is on screen, and a browser only loads a font once text uses it. Measuring with a fallback font puts them in the wrong place.
- **The schema code block is whitespace-sensitive** (`white-space: pre`). Keep it that way.
- The page waits for fonts and images to load (`window.__ready`) before the first frame; add any new images as `<img>` tags or they may render late.
