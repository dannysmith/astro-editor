// Pixel diffs between screenshots, for checking a change against earlier shots
// (`bun run app diff <a> <b>`). Takes two PNGs, or two folders of `app shot`
// output matched by name, ignoring the timestamp. Doesn't need the app running.
import { mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'

type Bounds = { x: number; y: number; width: number; height: number }

export type ImageDiff =
  | { status: 'same' }
  | { status: 'size'; a: string; b: string }
  | {
      status: 'differ'
      pixels: number
      total: number
      bounds: Bounds
      image: Buffer
    }

const DIFF_COLOR: [number, number, number] = [255, 0, 0]

/**
 * Compares two PNGs pixel for pixel. Repeat snapshots of an unchanged page are
 * identical, so any changed pixel counts. When they differ, `image` is a PNG
 * of `b` faded out with the changed pixels in red.
 */
export function diffPngs(a: Buffer, b: Buffer): ImageDiff {
  const imgA = PNG.sync.read(a)
  const imgB = PNG.sync.read(b)
  if (imgA.width !== imgB.width || imgA.height !== imgB.height) {
    return {
      status: 'size',
      a: `${imgA.width}x${imgA.height}`,
      b: `${imgB.width}x${imgB.height}`,
    }
  }
  const { width, height } = imgA
  const out = new PNG({ width, height })
  const pixels = pixelmatch(imgA.data, imgB.data, out.data, width, height, {
    threshold: 0,
    includeAA: true,
    diffColor: DIFF_COLOR,
  })
  if (pixels === 0) return { status: 'same' }
  return {
    status: 'differ',
    pixels,
    total: width * height,
    bounds: diffBounds(out.data, width, height),
    image: PNG.sync.write(out),
  }
}

/**
 * The box around the changed pixels in a pixelmatch diff. The rest of the diff
 * is greyscale, so pure red only appears where pixels changed.
 */
function diffBounds(data: Uint8Array, width: number, height: number): Bounds {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (
        data[i] === DIFF_COLOR[0] &&
        data[i + 1] === DIFF_COLOR[1] &&
        data[i + 2] === DIFF_COLOR[2]
      ) {
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)
      }
    }
  }
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

/** `app shot` names files `<name>-<theme>-<W>x<H>-<YYYYMMDD-HHMMSS>.png`. The key drops the stamp. */
export function shotKey(file: string): string | null {
  return /^(.+)-\d{8}-\d{6}\.png$/.exec(path.basename(file))?.[1] ?? null
}

/** The newest file for each shot key. Stamps sort chronologically as strings. */
export function latestShots(files: string[]): Map<string, string> {
  const latest = new Map<string, string>()
  for (const file of [...files].sort()) {
    const key = shotKey(file)
    if (key) latest.set(key, file)
  }
  return latest
}

function describe(key: string, diff: ImageDiff, diffFile?: string): string {
  if (diff.status === 'same') return `${key}: same`
  if (diff.status === 'size') {
    return `${key}: sizes differ (${diff.a} vs ${diff.b})`
  }
  const { x, y, width, height } = diff.bounds
  const percent = (diff.pixels / diff.total) * 100
  const share = percent < 0.01 ? '<0.01' : percent.toFixed(2)
  return (
    `${key}: ${diff.pixels} pixels differ (${share}%) in ${width}x${height} at ${x},${y}` +
    (diffFile ? `\n  ${diffFile}` : '')
  )
}

/**
 * Diffs two PNGs, or every shot in folder `a` against the newest shot with the
 * same key in folder `b`. Writes a diff image to `outDir` for each pair that
 * differs, and returns a report with paths relative to `root`.
 */
export async function diffShots(
  a: string,
  b: string,
  outDir: string,
  root: string
): Promise<string> {
  const aIsDir = (await readdir(a).catch(() => null)) !== null
  const pairs: { key: string; a: string; b?: string }[] = []
  if (aIsDir) {
    const inA = latestShots(await readdir(a))
    const inB = latestShots(await readdir(b))
    for (const [key, file] of [...inA].sort()) {
      const match = inB.get(key)
      pairs.push({
        key,
        a: path.join(a, file),
        b: match ? path.join(b, match) : undefined,
      })
    }
    if (!pairs.length) throw new Error(`no shots in ${a}`)
  } else {
    pairs.push({ key: shotKey(b) ?? path.basename(b, '.png'), a, b })
  }

  const lines: string[] = []
  const missing: string[] = []
  const counts = { same: 0, differ: 0 }
  for (const pair of pairs) {
    if (!pair.b) {
      missing.push(pair.key)
      continue
    }
    const diff = diffPngs(
      Buffer.from(await Bun.file(pair.a).arrayBuffer()),
      Buffer.from(await Bun.file(pair.b).arrayBuffer())
    )
    let diffFile: string | undefined
    if (diff.status === 'differ') {
      await mkdir(outDir, { recursive: true })
      diffFile = path.join(outDir, `${pair.key}-diff.png`)
      await Bun.write(diffFile, diff.image)
      diffFile = path.relative(root, diffFile)
    }
    lines.push(describe(pair.key, diff, diffFile))
    counts[diff.status === 'same' ? 'same' : 'differ']++
  }
  if (missing.length) {
    lines.push(`Not in ${path.relative(root, b)}: ${missing.join(', ')}`)
  }
  if (pairs.length > 1) {
    lines.push(
      `\n${counts.same} same, ${counts.differ} differ` +
        (missing.length ? `, ${missing.length} missing` : '')
    )
  }
  return lines.join('\n')
}
