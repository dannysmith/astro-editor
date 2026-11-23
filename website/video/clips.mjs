// Renders the square social clips, with their part of the soundtrack. Run the
// main video's synth.mjs first, so out/audio.wav exists.
//
//   node video/clips.mjs              -> out/clips/astro-editor-<clip>.mp4
//   node video/clips.mjs copyedit     -> just that clip
import { chromium } from 'playwright-core'
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

const dir = import.meta.dirname
const out = (f) => path.join(dir, 'out', f)

const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto('file://' + path.join(dir, 'index.html'))
const { clips, endFrame } = await page.evaluate(() => ({
  clips: window.__clips,
  endFrame: window.__clipEndFrame,
}))
await browser.close()

function run(command, args) {
  const r = spawnSync(command, args, { stdio: 'inherit' })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

mkdirSync(out('clips'), { recursive: true })
const names =
  process.argv.length > 2 ? process.argv.slice(2) : Object.keys(clips)
for (const name of names) {
  const { from, length } = clips[name]
  const silent = `clip-${name}-silent.mp4`
  run('node', [path.join(dir, 'render.mjs'), '--clip', name, '--out', silent])
  // The sound is gone by the end frame, before the next chapter's cues
  run('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-i', out(silent),
    '-ss', String(from), '-t', String(length + endFrame), '-i', out('audio.wav'),
    '-map', '0:v', '-map', '1:a',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-tune', 'animation',
    '-pix_fmt', 'yuv420p',
    '-af', `afade=t=in:st=0:d=0.3,afade=t=out:st=${length - 1}:d=1,loudnorm=I=-16:TP=-1.5:LRA=11`,
    '-ar', '48000', '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart',
    out(`clips/astro-editor-${name}.mp4`),
  ]) // prettier-ignore
  console.log(out(`clips/astro-editor-${name}.mp4`))
}
