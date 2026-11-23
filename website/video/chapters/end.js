/* Chapter 7: the wall of remaining features, and the end card. */
mountScenes(`
<!-- G: montage -->
<section class="scene" id="sG">
  <div id="g-persp">
    <div id="g-wall">
      <div class="gcol" id="gc0"></div>
      <div class="gcol" id="gc1"></div>
      <div class="gcol" id="gc2"></div>
    </div>
  </div>
  <div id="g-shade"></div>
  <div id="g-text">
    <div class="eyebrow">And plenty more</div>
    <div id="g-phrases"></div>
  </div>
</section>

<!-- H: end card -->
<section class="scene" id="sH">
  <img id="h-icon" src="../src/assets/icon.png" alt="" />
  <div id="h-title">Astro Editor</div>
  <div id="h-line"></div>
  <div id="h-cta"><span class="pill">astroeditor.danny.is</span></div>
  <div id="h-brew">or <code>brew install --cask astro-editor</code></div>
</section>
`)

/* ---------------- Scene G: montage ---------------- */
const WALL = [
  [
    'command-palette',
    'main-demo-image-light',
    'typewriter-mode',
    'copyedit-checks',
  ],
  [
    'git-tab',
    'image-preview-demo',
    'main-demo-image-distractionless-dark',
    'mdx-builder-1',
  ],
  [
    'file-manager-drafts-filter',
    'frontmatter-sidebar-overview',
    'main-demo-image-dark',
    'command-palette',
  ],
]
WALL.forEach((col, i) => {
  $('gc' + i).innerHTML = [...col, ...col]
    .map((n) => `<img src="../src/assets/${n}.png" alt="" />`)
    .join('')
})
const PHRASES = [
  'Content Finder',
  'Colour themes',
  'Project list',
  'Drafts & filters',
  'Shortcuts for everything',
]
$('g-phrases').innerHTML = PHRASES.map(
  (p) => `<div class="gp">${p}</div>`
).join('')
const phraseEls = [...$('g-phrases').children]
const WALL_START = END - 0.1
const G_T0 = END + 0.6,
  G_STEP = 0.92
// The end card, which takes over from the wall
const CARD = END + 5.4

function sceneG(t) {
  const o = E.outCubic(seg(t, WALL_START, WALL_START + 0.8))
  show($('sG'), o)
  if (o <= 0) return
  const lt = t - WALL_START
  const end = E.inOutCubic(seg(t, CARD - 0.3, CARD + 0.7)) // blur back for the end card
  S($('g-wall'), {
    transform: `rotateX(24deg) rotateZ(-12deg) scale(${1.05 + lt * 0.006})`,
    filter: `brightness(${0.62 - 0.32 * end}) blur(${end * 10}px)`,
  })
  ;[0, 1, 2].forEach((i) =>
    S($('gc' + i), {
      transform: `translateY(${[-300, -900, -500][i] + (i % 2 ? 1 : -1) * lt * 70}px)`,
    })
  )
  S($('g-text'), { opacity: 1 - E.inCubic(seg(t, CARD - 0.5, CARD)) })
  S($('g-text').querySelector('.eyebrow'), {
    opacity: E.outCubic(seg(t, END + 0.2, END + 0.8)),
  })
  phraseEls.forEach((el, i) => {
    const a = G_T0 + i * G_STEP,
      b = a + G_STEP
    const pin = E.outExpo(seg(t, a, a + 0.35)),
      pout = E.inCubic(seg(t, b - 0.2, b))
    const last = i === PHRASES.length - 1
    const po = last ? pin : pin * (1 - pout)
    S(el, {
      opacity: po,
      transform: `translateY(${(1 - pin) * 60 - (last ? 0 : pout * 50)}px)`,
      filter: `blur(${(1 - pin) * 8 + (last ? 0 : pout * 8)}px)`,
    })
  })
  S($('g-shade'), { opacity: 1 - 0.3 * end })
}

/* ---------------- Scene H: end card ---------------- */
const hTyper = typer(
  'Free & open source. macOS, Windows & Linux.',
  CARD + 1.4,
  0.045,
  31
)
function sceneH(t) {
  const o = seg(t, CARD, CARD + 0.4)
  show($('sH'), o)
  if (o <= 0) return
  const ip = E.outBack(seg(t, CARD + 0.2, CARD + 0.9))
  S($('h-icon'), {
    opacity: clamp(ip * 2),
    transform: `scale(${0.6 + 0.4 * ip}) translateY(${(1 - ip) * 30}px)`,
  })
  const tp = E.outQuint(seg(t, CARD + 0.5, CARD + 1.3))
  S($('h-title'), {
    opacity: tp,
    transform: `translateY(${(1 - tp) * 40}px)`,
    filter: `blur(${(1 - tp) * 10}px)`,
  })
  const caretOn = t - hTyper.last(t) < 0.4 || t % 1 < 0.55
  html(
    $('h-line'),
    esc(hTyper.at(t)).replaceAll('&amp;', '&amp;') +
      (t > CARD + 1.2 && caretOn ? CARET : '')
  )
  const cp = E.outBack(seg(t, CARD + 3.5, CARD + 4.1))
  S($('h-cta'), {
    opacity: clamp(cp * 2),
    transform: `scale(${0.8 + 0.2 * cp})`,
  })
  const bp = E.outCubic(seg(t, CARD + 4.1, CARD + 4.8))
  S($('h-brew'), {
    opacity: bp,
    transform: `translateY(${(1 - bp) * 16}px)`,
  })
}

cue('whoosh', END + 0.2, { rise: 0.6, fall: 0.9, amp: 0.14 }) // the wall
cue('bell', END + 0.1, { note: 78, amp: 0.035, pan: -0.3 })
PHRASES.forEach((_, k) =>
  cue('pop', G_T0 + k * G_STEP, {
    f: 700 + k * 60,
    amp: 0.04,
    pan: k % 2 ? 0.3 : -0.3,
  })
)
cue('whoosh', CARD + 0.1, { rise: 0.8, fall: 0.8, amp: 0.12 })
cue('hit', CARD + 0.15, { amp: 0.18 })
;[69, 76, 81, 85].forEach((note, k) =>
  cue('bell', CARD + 0.2 + k * 0.12, {
    note,
    amp: 0.035,
    pan: k % 2 ? 0.3 : -0.3,
  })
)
cue('pop', CARD + 3.55, { f: 900, amp: 0.06 }) // URL pill
