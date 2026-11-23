// Synthesises the soundtrack for the video: an ambient pad that resolves on
// the brand reveal, key clicks synced to every typed character, plus whooshes,
// bells and soft hits. Everything is timed from the page: the chapters, each
// keystroke, and the sound cues each chapter declares with cue().
//
//   node video/synth.mjs   -> out/audio.wav
import { chromium } from 'playwright-core'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const dir = path.dirname(fileURLToPath(import.meta.url))
const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto('file://' + path.join(dir, 'index.html'))
const { keyTimes, cues, chapters, duration } = await page.evaluate(() => ({
  keyTimes: window.__keyTimes,
  cues: window.__cues,
  chapters: window.__chapters,
  duration: window.DURATION,
}))
await browser.close()

const SR = 48000
const DUR = duration
const N = SR * DUR
const L = new Float32Array(N),
  R = new Float32Array(N)
const padL = new Float32Array(N),
  padR = new Float32Array(N) // sent to reverb

let seed = 42
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 4294967296
}
const noise = () => rand() * 2 - 1
const midi = (n) => 440 * 2 ** ((n - 69) / 12)
const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))

function add(buf, i, v) {
  if (i >= 0 && i < N) buf[i] += v
}
function addStereo(i, v, pan = 0, send = 0) {
  const gl = Math.cos(((pan + 1) * Math.PI) / 4),
    gr = Math.sin(((pan + 1) * Math.PI) / 4)
  add(L, i, v * gl)
  add(R, i, v * gr)
  if (send) {
    add(padL, i, v * gl * send)
    add(padR, i, v * gr * send)
  }
}

/* ---------- pad ---------- */
// [start, end, midi notes]. Sparse open fifths under the "problem" intro, then
// a warm A major progression from the brand reveal on, cycling until the end
// chapter, where it lifts on Esus and resolves on the end card.
const AMAJ9 = [45, 52, 56, 59, 61, 64]
const FSM9 = [42, 49, 52, 56, 57, 61]
const DMAJ9 = [38, 45, 49, 52, 54, 57]
const ESUS = [40, 47, 52, 54, 57, 59]
const PROGRESSION = [AMAJ9, FSM9, DMAJ9, AMAJ9, FSM9, DMAJ9, ESUS]
const CHORD_LENGTH = 6.7
const endStart = chapters.end.start
const CHORDS = [[0.0, 8.8, [45, 52, 57]]]
for (let i = 0, a = 8.6; a < endStart - 0.2; i++, a += CHORD_LENGTH) {
  CHORDS.push([
    a,
    Math.min(a + CHORD_LENGTH + 0.2, endStart),
    PROGRESSION[i % PROGRESSION.length],
  ])
}
CHORDS.push(
  [endStart - 0.2, endStart + 5.6, ESUS],
  [endStart + 5.4, DUR, [33, 45, 52, 56, 59, 61, 64]] // Amaj9, resolved
)
for (const [a, b, notes] of CHORDS) {
  const i0 = Math.floor(a * SR),
    i1 = Math.min(N, Math.floor((b + 1.4) * SR))
  notes.forEach((n, k) => {
    const f = midi(n)
    const amp = (n < 45 ? 0.05 : 0.032) * (a < 8 ? 0.7 : 1)
    const pan = ((k % 2) * 2 - 1) * 0.35
    const detune = 1 + (k - notes.length / 2) * 0.0009
    let ph1 = rand() * 6.28,
      ph2 = rand() * 6.28
    for (let i = i0; i < i1; i++) {
      const t = i / SR
      const env = smooth((t - a) / 1.3) * (1 - smooth((t - b) / 1.4))
      if (env <= 0) continue
      const vib = 1 + 0.0015 * Math.sin(t * 4.1 + k)
      ph1 += (2 * Math.PI * f * vib) / SR
      ph2 += (2 * Math.PI * f * detune * 2.0) / SR
      const shimmer = 0.75 + 0.25 * Math.sin(t * 0.7 + k * 1.3)
      const v =
        (Math.sin(ph1) + 0.18 * Math.sin(ph2) + 0.08 * Math.sin(3 * ph1)) *
        amp *
        env *
        shimmer
      addStereo(i, v, pan, 0.6)
    }
  })
}

/* ---------- bells ---------- */
function bell(t, n, amp = 0.05, pan = 0) {
  const f = midi(n),
    i0 = Math.floor(t * SR)
  for (let j = 0; j < SR * 2.5; j++) {
    const tt = j / SR
    const env = Math.exp(-tt * 2.2) * Math.min(1, tt / 0.004)
    const v =
      (Math.sin(2 * Math.PI * f * tt) +
        0.3 * Math.sin(2 * Math.PI * f * 2.76 * tt) * Math.exp(-tt * 6)) *
      amp *
      env
    addStereo(i0 + j, v, pan, 0.9)
  }
}

/* ---------- key clicks ---------- */
// Fast typing is thinned out, or the clicks would blur into a buzz
const MIN_CLICK_GAP = 0.055
let lastClick = -Infinity
for (const kt of [...keyTimes].sort((a, b) => a - b)) {
  if (kt - lastClick < MIN_CLICK_GAP) continue
  lastClick = kt
  const i0 = Math.floor(kt * SR),
    f = 1800 + rand() * 1600,
    amp = 0.13 + rand() * 0.06,
    pan = (rand() - 0.5) * 0.5
  let hp = 0,
    prev = 0
  for (let j = 0; j < SR * 0.03; j++) {
    const tt = j / SR
    const n = noise()
    hp = 0.85 * (hp + n - prev)
    prev = n // one-pole high-pass
    const v =
      (hp * Math.exp(-tt / 0.0035) +
        0.35 * Math.sin(2 * Math.PI * f * tt) * Math.exp(-tt / 0.002)) *
      amp
    addStereo(i0 + j, v, pan, 0.15)
  }
}

/* ---------- whooshes, hits, pops ---------- */
function whoosh(peak, rise = 0.55, fall = 0.7, amp = 0.16, pan = 0) {
  const i0 = Math.floor((peak - rise) * SR),
    len = Math.floor((rise + fall) * SR)
  let y1 = 0,
    y2 = 0
  for (let j = 0; j < len; j++) {
    const t = j / SR
    const x = t < rise ? t / rise : 1 - (t - rise) / fall
    const env = smooth(x) ** 1.6
    const fc = 300 + 5000 * env
    const a = 1 - Math.exp((-2 * Math.PI * fc) / SR)
    y1 += a * (noise() - y1)
    y2 += a * (y1 - y2)
    addStereo(i0 + j, y2 * amp * env * 2.2, pan + (x - 0.5) * 0.6, 0.4)
  }
}
function hit(t, amp = 0.35) {
  const i0 = Math.floor(t * SR)
  let ph = 0
  for (let j = 0; j < SR * 1.6; j++) {
    const tt = j / SR
    const f = 42 + 70 * Math.exp(-tt * 9)
    ph += (2 * Math.PI * f) / SR
    addStereo(
      i0 + j,
      Math.sin(ph) * Math.exp(-tt * 2.6) * Math.min(1, tt / 0.003) * amp,
      0,
      0.2
    )
  }
}
function pop(t, f = 820, amp = 0.07, pan = 0) {
  const i0 = Math.floor(t * SR)
  let ph = 0
  for (let j = 0; j < SR * 0.12; j++) {
    const tt = j / SR
    ph += (2 * Math.PI * f * (1 + 0.6 * Math.exp(-tt * 40))) / SR
    addStereo(i0 + j, Math.sin(ph) * Math.exp(-tt * 38) * amp, pan, 0.3)
  }
}

// The cues each chapter declares with cue()
for (const c of cues) {
  if (c.kind === 'whoosh') whoosh(c.t, c.rise, c.fall, c.amp, c.pan ?? 0)
  else if (c.kind === 'hit') hit(c.t, c.amp)
  else if (c.kind === 'pop') pop(c.t, c.f, c.amp, c.pan ?? 0)
  else if (c.kind === 'bell') bell(c.t, c.note, c.amp, c.pan ?? 0)
}

/* ---------- reverb (Schroeder: parallel combs into series all-passes) ---------- */
function reverb(input, offset) {
  const out = new Float32Array(N)
  const combs = [1557, 1617, 1491, 1422, 1277, 1356].map((d) => ({
    buf: new Float32Array(d + offset),
    i: 0,
    lp: 0,
  }))
  for (let n = 0; n < N; n++) {
    let s = 0
    for (const c of combs) {
      const y = c.buf[c.i]
      c.lp = y * 0.7 + c.lp * 0.3
      c.buf[c.i] = input[n] + c.lp * 0.86
      c.i = (c.i + 1) % c.buf.length
      s += y
    }
    out[n] = s / combs.length
  }
  for (const d of [556, 441, 341]) {
    const buf = new Float32Array(d + offset)
    let i = 0
    for (let n = 0; n < N; n++) {
      const b = buf[i],
        x = out[n]
      out[n] = -x + b
      buf[i] = x + b * 0.5
      i = (i + 1) % buf.length
    }
  }
  return out
}
const wetL = reverb(padL, 0),
  wetR = reverb(padR, 23)

/* ---------- mix + master ---------- */
const pcm = Buffer.alloc(N * 4)
let peak = 0
const mixed = new Float32Array(N * 2)
for (let i = 0; i < N; i++) {
  const t = i / SR
  const fade = smooth(t / 0.8) * (1 - smooth((t - (DUR - 1.6)) / 1.6))
  mixed[2 * i] = (L[i] + wetL[i] * 1.4) * fade
  mixed[2 * i + 1] = (R[i] + wetR[i] * 1.4) * fade
  peak = Math.max(peak, Math.abs(mixed[2 * i]), Math.abs(mixed[2 * i + 1]))
}
const gain = 0.89 / peak
for (let i = 0; i < N * 2; i++) {
  const v = Math.tanh(mixed[i] * gain * 1.1) // gentle soft clip
  pcm.writeInt16LE(Math.round(v * 32767), i * 2)
}
const header = Buffer.alloc(44)
header.write('RIFF', 0)
header.writeUInt32LE(36 + pcm.length, 4)
header.write('WAVE', 8)
header.write('fmt ', 12)
header.writeUInt32LE(16, 16)
header.writeUInt16LE(1, 20)
header.writeUInt16LE(2, 22)
header.writeUInt32LE(SR, 24)
header.writeUInt32LE(SR * 4, 28)
header.writeUInt16LE(4, 32)
header.writeUInt16LE(16, 34)
header.write('data', 36)
header.writeUInt32LE(pcm.length, 40)
mkdirSync(path.join(dir, 'out'), { recursive: true })
const out = path.join(dir, 'out', 'audio.wav')
writeFileSync(out, Buffer.concat([header, pcm]))
console.log(
  `${out} (${keyTimes.length} key clicks, peak gain ${gain.toFixed(2)})`
)
