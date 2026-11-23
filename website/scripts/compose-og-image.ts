// Rebuilds public/og-image.png around a fresh window screenshot, keeping its logo,
// title and bottom bar. Take the screenshot first, from the repo root:
//
//   bun run app shots og-window
//   cd website && bun scripts/compose-og-image.ts [output.png]
import sharp from 'sharp'

const OG_IMAGE = 'public/og-image.png'
const WINDOW_SHOT = '../docs/tasks-todo/temporary/raw/og-window.png'
const output = process.argv[2] ?? OG_IMAGE

const WIDTH = 1200
const HEIGHT = 630
// Where the window sits, and where the logo and title end and the bar begins
const WINDOW = { left: 204, top: 252, width: 792, radius: 8 }
const BAR_TOP = 613

const current = await sharp(OG_IMAGE).ensureAlpha().raw().toBuffer()
const background = {
  r: current[(240 * WIDTH + 8) * 4]!,
  g: current[(240 * WIDTH + 8) * 4 + 1]!,
  b: current[(240 * WIDTH + 8) * 4 + 2]!,
}
const heading = await sharp(OG_IMAGE)
  .extract({ left: 0, top: 0, width: WIDTH, height: WINDOW.top - 8 })
  .toBuffer()
const bar = await sharp(OG_IMAGE)
  .extract({ left: 0, top: BAR_TOP, width: WIDTH, height: HEIGHT - BAR_TOP })
  .toBuffer()

const height = BAR_TOP - WINDOW.top + WINDOW.radius
const roundedRect = (fill: string) =>
  Buffer.from(
    `<svg width="${WINDOW.width}" height="${height}"><rect width="${WINDOW.width}" height="${height}" rx="${WINDOW.radius}" fill="${fill}"/></svg>`
  )

const screenshot = await sharp(WINDOW_SHOT)
  .resize({ width: WINDOW.width })
  .extract({ left: 0, top: 0, width: WINDOW.width, height })
  .composite([{ input: roundedRect('#fff'), blend: 'dest-in' }])
  .png()
  .toBuffer()

const shadow = await sharp({
  create: {
    width: WINDOW.width + 40,
    height: height + 40,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite([{ input: roundedRect('#00000040'), left: 20, top: 20 }])
  .blur(6)
  .png()
  .toBuffer()

await sharp({
  create: { width: WIDTH, height: HEIGHT, channels: 3, background },
})
  .composite([
    { input: heading, left: 0, top: 0 },
    { input: shadow, left: WINDOW.left - 20, top: WINDOW.top - 18 },
    { input: screenshot, left: WINDOW.left, top: WINDOW.top },
    { input: bar, left: 0, top: BAR_TOP },
  ])
  .png()
  .toFile(output)

console.log(`wrote ${output}`)
