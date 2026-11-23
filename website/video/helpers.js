/* ---------------- helpers ---------------- */
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const seg = (t, a, b) => clamp((t - a) / (b - a))
const lerp = (a, b, p) => a + (b - a) * p
const E = {
  outCubic: (x) => 1 - (1 - x) ** 3,
  inCubic: (x) => x * x * x,
  inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2),
  outExpo: (x) => (x === 1 ? 1 : 1 - 2 ** (-10 * x)),
  outQuint: (x) => 1 - (1 - x) ** 5,
  outBack: (x) => {
    const c1 = 1.9,
      c3 = c1 + 1
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2
  },
  inOutQuint: (x) => (x < 0.5 ? 16 * x ** 5 : 1 - (-2 * x + 2) ** 5 / 2),
}
/** Fades in over [a, a+din] and out over [b-dout, b]. */
const win = (t, a, b, din = 0.5, dout = 0.5) =>
  Math.min(E.outCubic(seg(t, a, a + din)), 1 - E.inCubic(seg(t, b - dout, b)))
const $ = (id) => document.getElementById(id)
function S(el, props) {
  for (const k in props) el.style[k] = props[k]
}
function html(el, s) {
  if (el.__html !== s) {
    el.innerHTML = s
    el.__html = s
  }
}
function show(el, o) {
  el.style.opacity = o
  el.style.visibility = o <= 0.001 ? 'hidden' : 'visible'
}

function rng(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Every keystroke time, used by synth.mjs for key-click sounds. */
window.__keyTimes = []
/** Deterministic, human-ish typing: char i appears at times[i]. */
function typer(text, start, perChar, seed = 1) {
  const r = rng(seed),
    times = []
  let tt = start
  for (let i = 0; i < text.length; i++) {
    const prev = text[i - 1]
    let d = perChar * (0.55 + r() * 0.9)
    if (prev === '\n') d = perChar * 2.5
    else if (prev && /[.,!?]/.test(prev)) d = perChar * 3
    tt += d
    times.push(tt)
  }
  window.__keyTimes.push(...times)
  const count = (t) => {
    let n = 0
    while (n < times.length && times[n] <= t) n++
    return n
  }
  return {
    text,
    start,
    end: tt,
    at: (t) => text.slice(0, count(t)),
    last: (t) => {
      const n = count(t)
      return n ? times[n - 1] : -Infinity
    },
  }
}
const CARET = '<span class="caret"></span>'

/* ---------------- markdown (mirrors the app's source-mode styling) ---------------- */
const MARK = ''
const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const mk = (s) => `<span class="ae-mark">${esc(s)}</span>`
function inline(text) {
  let out = '',
    i = 0
  while (i < text.length) {
    const rest = text.slice(i)
    let m
    if ((m = /^!\[([^\]]*)\]\(([^)]+)\)/.exec(rest)))
      out +=
        mk('![') +
        `<span class="ae-link">${esc(m[1])}</span>` +
        mk(']') +
        `<span class="ae-mark ae-url">${esc('(' + m[2] + ')')}</span>`
    else if ((m = /^\[([^\]]+)\]\(([^)]+)\)/.exec(rest)))
      out +=
        mk('[') +
        `<span class="ae-link">${esc(m[1])}</span>` +
        mk(']') +
        `<span class="ae-mark ae-url">${esc('(' + m[2] + ')')}</span>`
    else if ((m = /^\*\*([^*]+)\*\*/.exec(rest)))
      out +=
        mk('**') + `<strong class="ae-strong">${esc(m[1])}</strong>` + mk('**')
    else if ((m = /^\*([^*\s][^*]*)\*/.exec(rest)))
      out += mk('*') + `<em class="ae-em">${esc(m[1])}</em>` + mk('*')
    else {
      out += esc(text[i])
      i++
      continue
    }
    i += m[0].length
  }
  return out
}
function jsxLine(l) {
  const m =
    /^<(\/?)([A-Za-z][\w.]*)((?:\s+[\w:-]+(?:=(?:"[^"]*"|\{[^}]*\}))?)*)\s*(\/?)>$/.exec(
      l
    )
  if (!m) return null
  const attrs = m[3].replace(
    /([\w:-]+)(?:=("[^"]*"|\{[^}]*\}))?/g,
    (_, a, v) =>
      `<span class="jx-a">${a}</span>` +
      (!v
        ? ''
        : v[0] === '{'
          ? `<span class="jx-e">=${esc(v)}</span>`
          : `<span class="jx-e">=</span><span class="jx-s">${esc(v)}</span>`)
  )
  return `<span class="jx-b">&lt;${m[1]}</span><span class="jx-t">${m[2]}</span>${attrs}<span class="jx-b">${m[4]}&gt;</span>`
}
function renderLine(l, cls = '') {
  let m
  if ((m = /^(#{1,6})\s+(.*)$/.exec(l)))
    return `<div class="ae-line ae-heading ${cls}">${esc(m[1])} ${inline(m[2])}</div>`
  const j = jsxLine(l)
  if (j) return `<div class="ae-line ${cls}">${j}</div>`
  return `<div class="ae-line ${cls}">${l === '' ? '&nbsp;' : inline(l)}</div>`
}
/** Renders the doc; MARK is the caret. In focus mode everything except the
    caret's current sentence gets the .fdim class. */
function renderDoc(src, focus) {
  return src
    .split('\n')
    .map((l) => {
      if (!focus || !l.includes(MARK)) return renderLine(l, focus ? 'fdim' : '')
      const [before, after] = l.split(MARK)
      // The current sentence includes its terminator once it's been typed.
      const core = before.replace(/[.!?]\s*$/, '')
      const cut =
        core.search(/[^.!?]*$/) +
        core.slice(core.search(/[^.!?]*$/)).match(/^\s*/)[0].length
      const prev = before.slice(0, cut),
        cur = before.slice(cut)
      return `<div class="ae-line"><span class="fdim">${inline(prev)}</span>${inline(cur)}${MARK}<span class="fdim">${inline(after)}</span></div>`
    })
    .join('')
    .replaceAll(MARK, CARET)
}
