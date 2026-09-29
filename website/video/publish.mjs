// Final step of the video pipeline: muxes out/video-silent.mp4 with
// out/audio.wav into a full-quality master, then writes the compressed web
// version and poster frame that the homepage uses.
//
//   node video/publish.mjs
//     -> video/out/astro-editor.mp4          (master, loudness-normalised)
//     -> public/astro-editor-intro.mp4       (web encode, ~5 MB)
//     -> src/assets/intro-video-poster.jpg   (brand-reveal frame)
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const dir = import.meta.dirname
const out = (f) => path.join(dir, 'out', f)
const master = out('astro-editor.mp4')
const POSTER_TIME = 11.5 // "Astro Editor / Writer mode for your Astro content."

function ffmpeg(args) {
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], {
    stdio: 'inherit',
  })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

ffmpeg([
  '-i', out('video-silent.mp4'),
  '-i', out('audio.wav'),
  '-c:v', 'copy',
  '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
  '-ar', '48000', '-c:a', 'aac', '-b:a', '192k',
  '-shortest', '-movflags', '+faststart',
  master,
]) // prettier-ignore

// CRF 27 keeps the editor text crisp; only the dimmed screenshot wall softens.
ffmpeg([
  '-i', master,
  '-c:v', 'libx264', '-preset', 'veryslow', '-crf', '27', '-tune', 'animation',
  '-pix_fmt', 'yuv420p', '-profile:v', 'high',
  '-c:a', 'aac', '-b:a', '112k',
  '-movflags', '+faststart',
  path.join(dir, '..', 'public', 'astro-editor-intro.mp4'),
]) // prettier-ignore

ffmpeg([
  '-ss', String(POSTER_TIME),
  '-i', master,
  '-frames:v', '1', '-q:v', '2',
  path.join(dir, '..', 'src', 'assets', 'intro-video-poster.jpg'),
]) // prettier-ignore

console.log('Published public/astro-editor-intro.mp4 and the poster frame')
