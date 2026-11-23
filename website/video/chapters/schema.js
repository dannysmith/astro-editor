/*
 * Chapter 2: it understands your project. The post's schema draws lines to a
 * form, then that form flies across and becomes the app's right sidebar.
 */
mountScenes(`
<section class="scene" id="sC">
  <div id="c-head">
    <div class="eyebrow">Frontmatter</div>
    <div class="headline">Your schemas become forms.</div>
  </div>
  <div id="c-code">
    <div class="win-tabbar">
      <span class="dot" style="background: #ff5f57"></span
      ><span class="dot" style="background: #febc2e"></span
      ><span class="dot" style="background: #28c840"></span
      ><span class="tabname">src/<b>content.config.ts</b></span>
    </div>
    <div id="c-lines">
<div class="cl" data-i="0"><div class="hl"></div><span><span class="k">const</span> articles <span class="p">=</span> <span class="f">defineCollection</span><span class="p">({</span><i class="end"></i></span></div>
<div class="cl" data-i="1"><div class="hl"></div><span>  <span class="key">schema</span><span class="p">:</span> <span class="p">({</span> image <span class="p">})</span> <span class="p">=&gt;</span> z<span class="p">.</span><span class="f">object</span><span class="p">({</span><i class="end"></i></span></div>
<div class="cl" data-i="2"><div class="hl"></div><span>    <span class="key">title</span><span class="p">:</span> z<span class="p">.</span><span class="f">string</span><span class="p">(),</span><i class="end"></i></span></div>
<div class="cl" data-i="3"><div class="hl"></div><span>    <span class="key">description</span><span class="p">:</span> z<span class="p">.</span><span class="f">string</span><span class="p">().</span><span class="f">optional</span><span class="p">(),</span><i class="end"></i></span></div>
<div class="cl" data-i="4"><div class="hl"></div><span>    <span class="key">pubDate</span><span class="p">:</span> z<span class="p">.</span>coerce<span class="p">.</span><span class="f">date</span><span class="p">(),</span><i class="end"></i></span></div>
<div class="cl" data-i="5"><div class="hl"></div><span>    <span class="key">cover</span><span class="p">:</span> <span class="f">image</span><span class="p">().</span><span class="f">optional</span><span class="p">(),</span><i class="end"></i></span></div>
<div class="cl" data-i="6"><div class="hl"></div><span>    <span class="key">tags</span><span class="p">:</span> z<span class="p">.</span><span class="f">array</span><span class="p">(</span>z<span class="p">.</span><span class="f">string</span><span class="p">()),</span><i class="end"></i></span></div>
<div class="cl" data-i="7"><div class="hl"></div><span>    <span class="key">draft</span><span class="p">:</span> z<span class="p">.</span><span class="f">boolean</span><span class="p">(),</span><i class="end"></i></span></div>
<div class="cl" data-i="8"><div class="hl"></div><span>  <span class="p">}),</span><i class="end"></i></span></div>
<div class="cl" data-i="9"><div class="hl"></div><span><span class="p">})</span><i class="end"></i></span></div>
    </div>
  </div>
  <svg id="c-svg" width="1920" height="1080"></svg>
  <div id="c-form">
    <div class="field" data-f="2">
      <div class="flabel">Title <span class="req">*</span></div>
      <div class="input" style="font-weight: 650">New Article</div>
    </div>
    <div class="field" data-f="3">
      <div class="flabel">Description</div>
      <div class="input ta ph">Enter description…</div>
    </div>
    <div class="field" data-f="4">
      <div class="flabel">Pub Date <span class="req">*</span></div>
      <div class="input">
        23 Nov 2026<span class="suffix"
          ><svg class="ico" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></svg
        ></span>
      </div>
    </div>
    <div class="field" data-f="5">
      <div class="flabel">Cover</div>
      <div class="input imgbtn">Select Image</div>
    </div>
    <div class="field" data-f="6">
      <div class="flabel">Tags</div>
      <div class="input ph">Add tags…</div>
    </div>
    <div class="field" data-f="7">
      <div class="flabel" style="justify-content: space-between; margin-bottom: 0">
        Draft <span class="switch" id="cf-switch"><b></b></span>
      </div>
    </div>
  </div>
</section>
`)

const C_T0 = SCHEMA + 1.1,
  C_STEP = 0.92
// When the form leaves for the sidebar, relative to the chapter
const FORM_FLY = SCHEMA + 7.7,
  FORM_LANDS = SCHEMA + 9.5,
  SCHEMA_ENDS = SCHEMA + 10.4
const cLines = [...document.querySelectorAll('#c-lines .cl')]
const cFields = [...document.querySelectorAll('#c-form .field')]
let cPaths = null
let formRest = null

/** Connector geometry and the form's position, measured with the scene at rest. */
function measureSchema() {
  const svg = $('c-svg')
  cPaths = cFields.map((f) => {
    const i = +f.dataset.f
    const e = cLines[i].querySelector('.end').getBoundingClientRect()
    const fl = f.getBoundingClientRect()
    const x1 = e.right + 16,
      y1 = e.top + e.height / 2
    const x2 = fl.left - 14,
      y2 = fl.top + 14
    const mx = (x1 + x2) / 2
    const d = `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`
    svg.insertAdjacentHTML(
      'beforeend',
      `<path d="${d}" fill="none" stroke="#5b9fd3" stroke-width="2.5" stroke-linecap="round" style="filter:drop-shadow(0 0 6px rgba(91,159,211,.8))"/><circle r="6" fill="#bfe3ff" style="filter:drop-shadow(0 0 8px #5b9fd3)"/>`
    )
    const path = svg.lastElementChild.previousElementSibling
    return { path, dot: svg.lastElementChild, len: path.getTotalLength() }
  })
  const form = $('c-form')
  formRest = {
    left: form.offsetLeft,
    top: form.offsetTop,
    width: form.offsetWidth,
    height: form.offsetHeight,
  }
}

function sceneSchema(t) {
  const o = win(t, SCHEMA, SCHEMA_ENDS, 0.6, 0.45)
  show($('sC'), o)
  if (o <= 0) return
  const hin = E.outCubic(seg(t, SCHEMA, SCHEMA + 0.8))
  const leaving = E.inOutCubic(seg(t, FORM_FLY - 0.1, FORM_FLY + 0.8))
  S($('c-head'), {
    opacity: hin * (1 - leaving),
    transform: `translateY(${(1 - hin) * 30 - leaving * 24}px)`,
  })
  const cin = E.outExpo(seg(t, SCHEMA + 0.2, SCHEMA + 1.2))
  S($('c-code'), {
    opacity: cin * (1 - leaving),
    transform: `translateX(${(1 - cin) * -80 - leaving * 140}px)`,
  })

  // The form flies to wherever the app's right sidebar is on screen
  const fin = E.outExpo(seg(t, SCHEMA + 0.4, SCHEMA + 1.4))
  const fly = E.inOutCubic(seg(t, FORM_FLY, FORM_LANDS))
  const side = $('sideR').getBoundingClientRect()
  const sx = lerp(1, side.width / formRest.width, fly)
  const sy = lerp(1, side.height / formRest.height, fly)
  const dx = lerp((1 - fin) * 80, side.left - formRest.left, fly)
  const dy = lerp(0, side.top - formRest.top, fly)
  S($('c-form'), {
    opacity: fin * (1 - seg(t, FORM_LANDS - 0.25, FORM_LANDS + 0.35)),
    transformOrigin: '0 0',
    transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
  })

  cFields.forEach((f, k) => {
    const i = +f.dataset.f
    const a = C_T0 + k * C_STEP
    const hl = win(t, a - 0.1, a + 1.25, 0.2, 0.4)
    S(cLines[i].querySelector('.hl'), { opacity: hl })
    const { path, dot, len } = cPaths[k]
    const draw = E.inOutCubic(seg(t, a, a + 0.45))
    const fade = (1 - seg(t, a + 0.9, a + 1.4)) * (1 - leaving)
    S(path, {
      strokeDasharray: len,
      strokeDashoffset: len * (1 - draw),
      opacity: fade,
    })
    const pt = path.getPointAtLength(len * draw)
    dot.setAttribute('cx', pt.x)
    dot.setAttribute('cy', pt.y)
    S(dot, { opacity: draw > 0 && draw < 1 ? 1 : 0 })
    const fp = E.outCubic(seg(t, a + 0.35, a + 0.8))
    S(f, {
      opacity: fp,
      transform: `translateX(${(1 - fp) * -24}px)`,
      filter: `blur(${(1 - fp) * 6}px)`,
    })
  })
}

cue('whoosh', SCHEMA + 0.4, { rise: 0.5, fall: 0.7, amp: 0.1 })
cue('bell', SCHEMA + 0.3, { note: 76, amp: 0.035, pan: -0.3 })
cFields.forEach((_, k) =>
  cue('pop', C_T0 + k * C_STEP + 0.4, {
    f: 900 + k * 70,
    amp: 0.045,
    pan: 0.3,
  })
)
cue('whoosh', FORM_FLY + 0.9, { rise: 0.7, fall: 0.8, amp: 0.13 })
cue('bell', FORM_LANDS, { note: 74, amp: 0.035, pan: 0.3 })
