// Renders index.html to a silent video, frame by frame: each frame's time is
// passed to the page's render(t), then screenshotted. Six headless browsers
// each take a chunk of the frames, and ffmpeg stitches the results together.
//
//   node video/render.mjs                      -> out/video-silent.mp4 (60fps)
//   node video/render.mjs --fps 30             -> lower frame rate
//   node video/render.mjs --stills 3,12.5,40   -> out/stills/t-<time>.png for checking
//   node video/render.mjs --from 20 --to 30    -> render a section only
import { chromium } from 'playwright-core'
import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const dir = path.dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const arg = (name, def) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : def
}
const fps = +arg('fps', 60)
const workers = +arg('workers', 6)
const stills = arg('stills')
const url = 'file://' + path.join(dir, 'index.html')

const browser = await chromium.launch()
async function openPage() {
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  })
  page.on('pageerror', (e) => console.error('page error:', e.message))
  await page.goto(url)
  await page.evaluate(() => window.__ready)
  return page
}

if (stills) {
  mkdirSync(path.join(dir, 'out', 'stills'), { recursive: true })
  const page = await openPage()
  for (const t of stills.split(',').map(Number)) {
    await page.evaluate((t) => window.render(t), t)
    const file = path.join(dir, 'out', 'stills', `t-${t.toFixed(2)}.png`)
    await page.screenshot({ path: file })
    console.log(file)
  }
  await browser.close()
  process.exit(0)
}

const duration = await (await openPage()).evaluate(() => window.DURATION)
const from = +arg('from', 0),
  to = +arg('to', duration)
const first = Math.round(from * fps),
  last = Math.round(to * fps)
const framesDir = path.join(dir, 'out', 'frames')
if (existsSync(framesDir)) rmSync(framesDir, { recursive: true })
mkdirSync(framesDir, { recursive: true })

let done = 0
const started = Date.now()
const total = last - first
await Promise.all(
  Array.from({ length: workers }, async (_, w) => {
    const page = await openPage()
    // Each worker renders a contiguous chunk so per-scene state stays warm.
    const chunk = Math.ceil(total / workers)
    for (
      let f = first + w * chunk;
      f < Math.min(first + (w + 1) * chunk, last);
      f++
    ) {
      await page.evaluate((t) => window.render(t), f / fps)
      await page.screenshot({
        path: path.join(framesDir, `${String(f - first).padStart(5, '0')}.jpg`),
        type: 'jpeg',
        quality: 94,
      })
      if (++done % 120 === 0)
        console.log(
          `${done}/${total} frames (${((Date.now() - started) / 1000).toFixed(0)}s)`
        )
    }
  })
)
await browser.close()

mkdirSync(path.join(dir, 'out'), { recursive: true })
const out = path.join(dir, 'out', arg('out', 'video-silent.mp4'))
const ff = spawnSync(
  'ffmpeg',
  [
    '-y',
    '-loglevel',
    'error',
    '-framerate',
    String(fps),
    '-i',
    path.join(framesDir, '%05d.jpg'),
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '16',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    out,
  ],
  { stdio: 'inherit' }
)
if (ff.status !== 0) process.exit(ff.status)
rmSync(framesDir, { recursive: true }) // ~500 MB of JPEGs at 60fps
console.log(out)
