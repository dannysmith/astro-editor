# Intro video

The 60-second marketing video on the homepage (`public/astro-editor-intro.mp4`). It's authored as a web page and rendered to MP4 frame by frame, with a soundtrack synthesised in code.

## How it works

`index.html` is the whole video. It has one function, `render(t)`, which sets every element to where it should be `t` seconds in. It never depends on the previous frame, and there are no CSS transitions or animations. That makes any moment reproducible: the renderer can jump to any time, screenshot it, and move on, however long each screenshot takes.

Almost every animation is built from three helpers in the page's script:

- `seg(t, start, end)` — how far through a time window we are, from 0 to 1.
- `E.*` easing curves — bend that 0–1 value so motion feels natural (`outCubic`, `inOutCubic`, `outBack` for a little overshoot, etc.).
- `lerp(from, to, p)` — map the eased value onto a property: position, scale, opacity, blur, colour.

On top of those:

- **Scenes** are functions (`sceneA` … `sceneH`) that fade themselves in and out with `win(t, start, end)` and hide entirely when invisible.
- **Typing** uses `typer()`, which works out a timestamp for every character up front (with seeded randomness, so it looks human but renders identically every time). The markdown is re-highlighted on each frame, so bold and italic snap into place when the closing mark is typed, just like the app.
- **Camera moves and editor scrolling** are keyframe lists (`CAM`, `SCROLL`) that ease between keys.
- **Layout-dependent positions** (schema connector curves, where the image drops, where the cursor hovers) are measured from the live page with `getBoundingClientRect()`.

## Pipeline

Run everything from `website/`:

```bash
bun run video
```

This runs three scripts in order:

| Script | Does | Output |
| --- | --- | --- |
| `render.mjs` | Screenshots all 3,600 frames (60fps) in six headless Chromium pages, encodes with ffmpeg | `out/video-silent.mp4` |
| `synth.mjs` | Synthesises the soundtrack: pad, key clicks, whooshes, bells, reverb | `out/audio.wav` |
| `publish.mjs` | Muxes and loudness-normalises a master, then writes the web encode and poster | `out/astro-editor.mp4`, `public/…intro.mp4`, `src/assets/…poster.jpg` |

`out/` is gitignored. A full run takes a few minutes; the frames (~500 MB) are deleted once encoded.

## Editing the video

1. Open `index.html` in Chrome directly from disk. Add `?play` to watch it in real time, or `?t=30` to see a single moment.
2. Make changes. All text, timings and styling live in `index.html`; scene start and end times are in each `scene*()` function, the caption list (`D_CAPS`) and the keyframe lists.
3. Check specific frames without a full render:

   ```bash
   node video/render.mjs --stills 12.5,30,48
   ```

   This writes `out/stills/t-<time>.png`. `--from` and `--to` render just a section.

4. Run `bun run video` to regenerate everything, then commit the updated `public/astro-editor-intro.mp4` and `src/assets/intro-video-poster.jpg`.

If you move scenes around in time, also retime the sound cues at the bottom of `synth.mjs` (the whooshes, pops and bells are hard-coded to scene times). Key clicks follow the typing automatically: `synth.mjs` reads every keystroke time from the page.

### Scene timeline

| Time | Scene |
| --- | --- |
| 0–8s | A: "You just want to write." → VS Code with red tags |
| 8–13s | B: The caret becomes the app icon; title and tagline |
| 13–22s | C: `content.config.ts` schema turns into a frontmatter form |
| 22–45s | D–F: The app — typing, distraction-free, focus mode, image drop, ⌥-hover preview, MDX inserter |
| 45–52s | G: Tilted wall of screenshots with feature names cycling |
| 52–60s | H: End card |

## Assets

The page uses the website's own files where it can, so updated screenshots show up on the next render:

- Screenshots and the app icon from `src/assets/`
- iA Writer fonts from `public/fonts/`
- `assets/` holds only the two demo images the website doesn't have (the cat photo and the book cover, both from `test/demo-project`)

The app UI in scenes C–F is recreated in HTML using the app's real editor colours (`src/components/editor/Editor.css` in the app) rather than screen-recorded, so it can be animated precisely.

## Requirements and gotchas

- **ffmpeg** on your `PATH`, and Playwright's Chromium: `bunx playwright-core install chromium`.
- **Run it outside the Claude Code sandbox.** Chromium can't launch inside it.
- **Keep `render(t)` stateless.** The six render workers each start partway through the video, so anything cached from an earlier frame will be missing. Derive everything from `t` or measure it from the page.
- **The schema code block is whitespace-sensitive** (`white-space: pre`) and marked `prettier-ignore`. Keep it that way or Prettier will reflow the indentation.
- The page waits for fonts and images to load (`window.__ready`) before the first frame; add any new images as `<img>` tags or they may render late.
