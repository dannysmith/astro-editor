/* Chapter 1: why it exists. The typed line, VS Code, and the brand reveal. */
mountScenes(`
<!-- A: the problem -->
<section class="scene" id="sA">
  <div id="a-vscode">
    <img src="../src/assets/main-demo-image-vscode.png" alt="" />
    <div id="a-tint"></div>
  </div>
  <div id="a-tags"></div>
  <div id="a-type"></div>
  <div id="a-caption">
    <div class="headline" style="font-size: 64px">
      So why does writing it look like
      <span style="color: #ff7a6e">this?</span>
    </div>
  </div>
</section>

<!-- B: brand -->
<section class="scene" id="sB">
  <div id="b-glow"></div>
  <img id="b-icon" src="../src/assets/icon.png" alt="" />
  <div id="b-bar"></div>
  <div id="b-title">
    <span class="reveal"><span>Astro Editor</span></span>
  </div>
  <div id="b-tag">Writer mode for your <b>Astro content.</b></div>
</section>
`)

/* ---------------- Scene A ---------------- */
const aTyper = typer('You just want to write.', 0.7, 0.085, 7)
const TAGS = [
  // [label, x, y (stage coords), rotation]
  ['YAML frontmatter', 661, 274, -3],
  ['Line numbers', 566, 420, 2],
  ['Minimap', 1504, 300, 3],
  ['File tree', 430, 490, -2],
  ['import statements', 760, 512, -2],
  ['Breadcrumbs', 790, 166, 2],
  ['Status bar', 1402, 789, -3],
  ['Tabs', 600, 132, -4],
]
$('a-tags').innerHTML = TAGS.map(([l]) => `<div class="tag">${l}</div>`).join(
  ''
)
const tagEls = [...$('a-tags').children]

function sceneA(t) {
  const o = 1 - E.inCubic(seg(t, 7.6, 8.3))
  show($('sA'), o)
  if (o <= 0) return
  // Typed line: centred, then drifts up and fades as the code editor arrives.
  const up = E.inOutCubic(seg(t, 3.3, 4.1))
  const typed = aTyper.at(t)
  const caretOn = t - aTyper.last(t) < 0.4 || t % 1 < 0.55
  html(
    $('a-type'),
    esc(typed) +
      (caretOn ? CARET : '<span class="caret" style="opacity:0"></span>')
  )
  S($('a-type'), {
    opacity: 1 - up,
    transform: `translateY(${-120 * up}px) scale(${1 - 0.15 * up})`,
    filter: `blur(${8 * up}px)`,
  })

  const v = E.outExpo(seg(t, 3.5, 4.6))
  const push = seg(t, 3.5, 8.3)
  const out = E.inCubic(seg(t, 7.5, 8.3))
  S($('a-vscode'), {
    opacity: v * (1 - out),
    transform: `perspective(2000px) translateY(${(1 - v) * 120}px) rotateX(${(1 - v) * 18}deg) scale(${1.18 - 0.18 * v + 0.05 * push - 0.25 * out})`,
    filter: `blur(${(1 - v) * 10 + out * 14}px) saturate(${0.9 + push * 0.3})`,
  })
  S($('a-tint'), { opacity: E.inOutCubic(seg(t, 4.6, 6.8)) })
  tagEls.forEach((el, i) => {
    const [, x, y, r] = TAGS[i]
    const p = seg(t, 4.5 + i * 0.22, 4.5 + i * 0.22 + 0.45)
    const s = E.outBack(p)
    const shake = p >= 1 ? Math.sin((t + i) * 9) * 0.8 : 0
    S(el, {
      left: x + 'px',
      top: y + 'px',
      opacity: clamp(p * 3) * (1 - out),
      transform: `translate(-50%,-50%) rotate(${r + shake}deg) scale(${s * (1 - out * 0.4)})`,
    })
  })
  const c = win(t, 5.3, 8.0, 0.6, 0.5)
  S($('a-caption'), {
    opacity: c,
    transform: `translateY(${(1 - E.outCubic(seg(t, 5.3, 6))) * 30}px)`,
  })
}

/* ---------------- Scene B ---------------- */
function sceneB(t) {
  const o = win(t, 7.9, 13.2, 0.3, 0.6)
  show($('sB'), o)
  if (o <= 0) return
  // A lone caret collapses in, then becomes the bar inside the app icon.
  const barIn = E.outExpo(seg(t, 7.9, 8.5))
  const toIcon = E.inOutCubic(seg(t, 8.7, 9.5))
  const blink = t < 8.7 ? (t % 0.8 < 0.45 ? 1 : 0.15) : 1
  // Icon bar sits at ~ (x 186/255, y 42..193/246) of the icon image.
  const iconScale = lerp(0.5, 1, E.outBack(seg(t, 8.9, 9.7)))
  const bx = lerp(954, 840 + 240 * (174 / 255), toIcon),
    by = lerp(360, 250 + 231 * (46 / 246), toIcon)
  const bh = lerp(120, 231 * (148 / 246), toIcon),
    bw = lerp(12, 240 * (33 / 255), toIcon)
  S($('b-bar'), {
    left: bx + 'px',
    top: by + 'px',
    width: bw + 'px',
    height: bh + 'px',
    opacity: barIn * blink * (1 - E.outCubic(seg(t, 9.4, 9.8))),
    transform: `scaleY(${barIn})`,
    borderRadius: lerp(4, 7, toIcon) + 'px',
  })
  S($('b-icon'), {
    opacity: E.outCubic(seg(t, 8.95, 9.4)),
    transform: `scale(${iconScale})`,
    filter: `drop-shadow(0 30px 60px rgba(0,0,0,.6)) blur(${(1 - seg(t, 8.9, 9.4)) * 6}px)`,
  })
  S($('b-glow'), {
    opacity: E.outCubic(seg(t, 8.2, 9.6)) * (0.8 + 0.2 * Math.sin(t * 2)),
    transform: `scale(${0.8 + 0.25 * seg(t, 8, 13)})`,
  })
  const tp = E.outQuint(seg(t, 9.5, 10.4))
  S($('b-title').querySelector('.reveal > span'), {
    transform: `translateY(${(1 - tp) * 110}%)`,
  })
  const gp = E.outCubic(seg(t, 10.3, 11.0))
  S($('b-tag'), {
    opacity: gp,
    transform: `translateY(${(1 - gp) * 24}px)`,
  })
  const out = E.inCubic(seg(t, 12.6, 13.2))
  S($('sB'), {
    transform: `scale(${1 + 0.02 * seg(t, 8, 13) - 0.06 * out})`,
    filter: `blur(${out * 10}px)`,
  })
}

cue('whoosh', 4.1, { rise: 0.5, fall: 0.8, amp: 0.11 }) // VS Code slams in
TAGS.forEach((_, i) =>
  cue('pop', 4.5 + i * 0.22 + 0.08, {
    f: 600 + i * 55,
    amp: 0.06,
    pan: i % 2 ? 0.4 : -0.4,
  })
)
cue('whoosh', 8.2, { rise: 0.7, fall: 0.5, amp: 0.12 }) // collapse to caret
cue('hit', 8.95, { amp: 0.2 }) // icon lands
;[73, 76, 80, 83].forEach((note, k) =>
  cue('bell', 9.0 + k * 0.12, { note, amp: 0.045, pan: -0.4 + k * 0.25 })
)
