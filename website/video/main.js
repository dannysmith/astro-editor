/* The master render: every chapter's state for time t. */
function background(t) {
  const x1 = 960 + Math.sin(t * 0.21) * 420,
    y1 = 420 + Math.cos(t * 0.17) * 180
  const x2 = 960 + Math.cos(t * 0.13) * 600,
    y2 = 760 + Math.sin(t * 0.19) * 160
  $('bg').style.background =
    `radial-gradient(900px 640px at ${x1}px ${y1}px, rgba(67,133,190,.13), transparent 70%), radial-gradient(760px 520px at ${x2}px ${y2}px, rgba(139,126,200,.07), transparent 70%), #100f0f`
}

function renderFull(t) {
  t = clamp(t, 0, FULL_DURATION)
  document.documentElement.style.setProperty('--caret-o', t % 1 < 0.55 ? 1 : 0)
  background(t)
  sceneA(t)
  sceneB(t)
  // The app first, since the schema's form flies to where its sidebar is
  sceneApp(t)
  sceneSchema(t)
  sceneG(t)
  sceneH(t)
}

function render(t) {
  if (CLIP) {
    renderClip(t)
    return
  }
  renderFull(t)
  // Fade up from black, fade out to black
  $('blackout').style.opacity = Math.max(
    1 - seg(t, 0, 0.5),
    E.inCubic(seg(t, FULL_DURATION - 0.8, FULL_DURATION))
  )
}

/** A square clip: its chapter, then a held end frame. */
function renderClip(t) {
  const { from, length } = CLIPS[CLIP]
  // Freezes just short of the next chapter, whose key press and wall start early
  renderFull(from + Math.min(t, length - 0.2))
  const end = E.outCubic(seg(t, length - 0.15, length + 0.35))
  show($('clipEnd'), end)
  $('d-cap').style.opacity = 1 - end
  const icon = E.outBack(seg(t, length + 0.05, length + 0.6))
  S($('clip-icon'), { transform: `scale(${0.7 + 0.3 * icon})` })
  $('blackout').style.opacity = Math.max(
    1 - seg(t, 0, 0.3),
    E.inCubic(seg(t, DURATION - 0.4, DURATION))
  )
}

if (CLIP) {
  document.documentElement.classList.add('clip')
  mountScenes(`
    <section class="scene" id="clipEnd">
      <img id="clip-icon" src="../src/assets/icon.png" alt="" />
      <div id="clip-new">New in Astro Editor 1.2</div>
      <div id="clip-url">astroeditor.danny.is</div>
    </section>
  `)
}

window.render = render
window.DURATION = DURATION
window.__chapters = CHAPTERS
window.__clips = CLIPS
window.__clipEndFrame = CLIP_END_FRAME
// Asked for by name, because a browser only loads a font once text uses it, and
// the editor's scroll and pointer stops are measured before any text is shown
window.__ready = Promise.all(
  [
    "480 21px 'iA Writer Duo'",
    "700 21px 'iA Writer Duo'",
    "italic 480 21px 'iA Writer Duo'",
    "400 21px 'iA Writer Mono'",
  ].map((font) => document.fonts.load(font))
)
  .then(() => document.fonts.ready)
  .then(() =>
    Promise.all([...document.images].map((i) => i.decode().catch(() => {})))
  )
  .then(() => {
    measureSchema()
    prepareApp()
    render(0)
    return true
  })

const params = new URLSearchParams(location.search)
if (params.has('play')) {
  window.__ready.then(() => {
    const t0 = performance.now() - (+params.get('play') || 0) * 1000
    const loop = () => {
      render((performance.now() - t0) / 1000)
      requestAnimationFrame(loop)
    }
    loop()
  })
} else if (params.has('t')) {
  window.__ready.then(() => render(+params.get('t')))
}
