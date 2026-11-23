/*
 * The app window, which Write, Link, Edit and Commit all share. Those chapters
 * add their captions, camera moves, key presses and pointer paths to the lists
 * here, and this file turns them into each frame.
 */
const ICON = {
  panel:
    '<rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" />',
  panelR:
    '<rect x="3" y="3" width="18" height="18" rx="2" /><path d="M15 3v18" />',
  plus: '<path d="M12 5v14M5 12h14" />',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />',
  pilcrow: '<path d="M13 4v16M17 4v16M19 4H9.5a4.5 4.5 0 0 0 0 9H13" />',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" /><path d="M17 21v-8H7v8M7 3v5h8" />',
  back: '<path d="M19 12H5M12 19l-7-7 7-7" />',
  sliders:
    '<path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4" />',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8" />',
  chevron: '<path d="m6 9 6 6 6-6" />',
  search: '<circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />',
  close: '<path d="M18 6 6 18M6 6l12 12" />',
  table:
    '<path d="M12 3v18M3 9h18M3 15h18" /><rect x="3" y="3" width="18" height="18" rx="2" />',
  spell: '<path d="m6 16 6-12 6 12M8 12h8M16 20l2 2 4-4" />',
  branch:
    '<path d="M6 3v12" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" />',
  check: '<path d="M20 6 9 17l-5-5" />',
  checkCircle: '<circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" />',
  warning:
    '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3ZM12 9v4M12 17h.01" />',
  right: '<path d="m9 18 6-6-6-6" />',
  up: '<path d="M12 19V5M5 12l7-7 7 7" />',
  refresh:
    '<path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" />',
}
const ico = (name, extra = '') =>
  `<svg class="ico" viewBox="0 0 24 24" ${extra}>${ICON[name]}</svg>`

const OTHER_FILES = [
  ['Async/await in JavaScript', 'async-await-javascript.mdx', 'mdx'],
  ['A week in Lisbon', 'a-week-in-lisbon.md'],
  ['Morning pages', 'morning-pages.md'],
  ['Five cookbooks I love', 'five-cookbooks.mdx', 'mdx'],
  ['On digital minimalism', 'digital-minimalism.md', 'draft'],
  ['The one-pot pasta post', 'one-pot-pasta.md'],
]

mountScenes(`
<section class="scene" id="sD">
  <div id="win-persp">
    <div id="win">
      <div class="titlebar">
        <div class="tl">
          <span style="background: #ff5f57"></span><span style="background: #febc2e"></span><span style="background: #28c840"></span>
        </div>
        ${ico('panel')}
        <span style="margin-left: 6px">demo-project</span>
        <div class="icons">
          ${ico('plus')}
          <span id="tbFocus">${ico('eye')}</span>
          <span id="tbType">${ico('pilcrow')}</span>
          ${ico('save')}
          ${ico('panelR')}
        </div>
      </div>
      <div class="winbody">
        <div id="sideL">
          <div class="inner">
            <div class="sideHead">
              ${ico('back')} Articles
              <div class="icons">${ico('sliders')}${ico('file')}</div>
            </div>
            <div class="files">
              <div class="file sel">
                <div class="row"><span class="ttl" id="fileTitle"></span></div>
                <div class="row"><span class="fn">the-book-that-fixed-my-mo…</span><span class="badge mdx" style="border: none">MDX</span></div>
              </div>
              ${OTHER_FILES.map(
                ([title, name, badge]) => `
                <div class="file">
                  <div class="row"><span class="ttl">${title}</span>${badge ? `<span class="badge ${badge}">${badge === 'mdx' ? 'MDX' : 'Draft'}</span>` : ''}</div>
                  <div class="fn">${name}</div>
                </div>`
              ).join('')}
            </div>
          </div>
        </div>
        <div id="edArea">
          <div id="edScroll"><div id="ed"></div></div>
          <div id="issPop"></div>
          <div id="mdxDim"></div>
          <div id="mdxPop"></div>
          <div id="palette"></div>
        </div>
        <div id="sideR">
          <div class="inner">
            <div class="tabs">
              <div class="tab" id="tab-frontmatter">${ico('table')} Frontmatter</div>
              <div class="tab" id="tab-copyedit">${ico('spell')} Copyedit</div>
              <div class="tab" id="tab-git">${ico('branch')} Git</div>
            </div>
            <div class="panel" id="panel-frontmatter"></div>
            <div class="panel" id="panel-copyedit"></div>
            <div class="panel" id="panel-git"></div>
          </div>
        </div>
      </div>
      <div id="edMeasure"></div>
      <div id="toast"></div>
      <div id="ring"></div>
      <div id="dragCard">
        <img src="assets/cat.jpg" alt="" />
        <div class="lbl">Cute Cat (1).jpg</div>
      </div>
      <svg id="cursor" viewBox="0 0 34 44">
        <path d="M3 2 L3 34 L11 27 L16.5 39.5 L22 37 L16.8 25 L28 25 Z" fill="#000" stroke="#fff" stroke-width="2.6" stroke-linejoin="round" />
      </svg>
    </div>
  </div>
  <div id="keys"></div>
  <div class="caption" id="d-cap"></div>
</section>
`)

/* ---------------- what the chapters add to ---------------- */
/** [start, end, eyebrow, headline] */
const CAPTIONS = []
/** Camera moves: { t, d, s, cx, cy }. cx and cy are a point in the window. */
const CAMERA = []
/** The square clips' own camera moves, by clip. */
const CLIP_CAMERA = { copyedit: [], git: [] }
/** Key presses to show: { t, keys } */
const KEYS = []
/** Pointer paths, each a list of { t, sel | x, y, click, move } */
const POINTER = []

const camTo = (t, d, shot) => CAMERA.push({ t, d, ...shot })
const keyPress = (t, ...keys) => {
  KEYS.push({ t, keys })
  cue('pop', t, { f: 520, amp: 0.08 })
}
function pointerPath(points) {
  POINTER.push(points)
  for (const p of points) {
    if (p.click) cue('pop', p.t, { f: 700, amp: 0.06, pan: 0.2 })
  }
}

/** The whole window, below the caption. */
const SHOT_WIDE = { s: 0.86, cx: 800, cy: 470 }
/** Where a shot's centre sits on the stage: lower than the middle, to clear the caption. */
const FOCUS_Y = CLIP ? 700 : 640

/* ---------------- the post, as a function of time ---------------- */
function postBlocks(t) {
  const blocks = [['title', tTitle.at(t)]]
  if (t >= tP1.start) blocks.push(['p1', tP1.at(t)])
  if (t >= tP2.start) blocks.push(['p2', tP2.at(t)])
  if (t >= CAT_T && t < CAT_GONE) blocks.push(['cat', CAT_LINE])
  if (t >= ASIDE.insert)
    blocks.push(
      ['aside-open', '<Aside>'],
      ['aside', tAside.at(t)],
      ['aside-close', '</Aside>']
    )
  if (t >= tP3.start) blocks.push(['p3', tP3.at(t)])
  if (t >= tP4.start) blocks.push(['p4', editedP4(tP4.at(t), t)])
  if (t >= BOOK.insert)
    blocks.push(
      ['book-open', BOOK_TAG],
      ['book', tBook.at(t)],
      ['book-close', '</BookCard>']
    )
  return blocks
}

/** Which block the caret is in, and where (the block's end by default). */
function caretAt(t) {
  if (t >= COMMIT) return ['p2']
  if (t >= EDIT) return editCaret(t)
  if (t >= LINK) return linkCaret(t)
  if (t >= BOOK.insert) return ['book']
  if (t >= tP4.start) return ['p4']
  if (t >= tP3.start) return ['p3']
  if (t >= ASIDE.insert) return ['aside']
  if (t >= CAT_T) return ['cat']
  if (t >= tP2.start) return ['p2']
  if (t >= tP1.start) return ['p1']
  return ['title']
}

function docAt(t) {
  const [where, position] = caretAt(t)
  return postBlocks(t)
    .map(([id, text]) => {
      if (id !== where) return text
      const i = position ? position(text) : text.length
      return text.slice(0, i) + MARK + text.slice(i)
    })
    .join('\n\n')
}

/** Adds what the editor draws on top of the text: highlights, underlines, selections. */
function decorate(markup, t) {
  let out = markup
  const pos = highlightsAt(t)
  if (pos) {
    out = out.replace(
      />([^<]+)</g,
      (_, text) =>
        '>' +
        text.replace(POS_WORDS, (word) => {
          const cls = VERBS.includes(word) ? 'verbs' : 'adverbs'
          return pos[cls] ? `<span class="pos-${cls}">${word}</span>` : word
        }) +
        '<'
    )
  }
  for (const issue of ISSUES) {
    if (t < CHECKS_FOUND || t >= issue.fixAt) continue
    const active = t >= issue.selectAt ? ' active' : ''
    out = out.replace(
      issue.match,
      `<span class="iss ${issue.check}${active}">$&</span>`
    )
  }
  if (t >= LINK_SELECT && t < LINK_INSERT) {
    out = out.replace('morning pages', '<span class="ed-sel">$&</span>')
  }
  return out
}

/* ---------------- camera ---------------- */
function camAt(t) {
  const moves = CLIP ? CLIP_CAMERA[CLIP] : CAMERA
  let shot = moves[0]
  for (let i = 1; i < moves.length; i++) {
    const move = moves[i]
    if (t <= move.t) break
    const p = E.inOutCubic(seg(t, move.t, move.t + move.d))
    shot = {
      s: lerp(shot.s, move.s, p),
      cx: lerp(shot.cx, move.cx, p),
      cy: lerp(shot.cy, move.cy, p),
    }
  }
  return shot
}

/* ---------------- editor scroll ---------------- */
// Keeps the caret near this height in the editor, gliding rather than jumping
const CARET_ANCHOR = 300
const SCROLL_STEP = 1 / 30
let scrollTable = []

function scrollAt(t) {
  const i = clamp((t - WRITE) / SCROLL_STEP, 0, scrollTable.length - 1)
  const a = Math.floor(i)
  const b = Math.min(a + 1, scrollTable.length - 1)
  return lerp(scrollTable[a], scrollTable[b], i - a)
}

/** Works out the scroll for every moment, and where each pointer stop is. */
function prepareApp() {
  $('d-cap').innerHTML = CAPTIONS.map(
    ([, , eyebrow, headline]) =>
      `<div class="cap-item"><div class="eyebrow">${eyebrow}</div><div class="headline">${headline}</div></div>`
  ).join('')

  const measure = $('edMeasure')
  let last = ''
  let top = 0
  let y = 0
  const steps = Math.ceil((END - WRITE) / SCROLL_STEP)
  scrollTable = []
  for (let i = 0; i <= steps; i++) {
    const doc = renderDoc(docAt(WRITE + i * SCROLL_STEP), false)
    if (doc !== last) {
      measure.innerHTML = doc
      last = doc
      top = measure.querySelector('.caret')?.offsetTop ?? top
    }
    const target = Math.max(0, top + 64 - CARET_ANCHOR)
    y += (target - y) * (1 - Math.exp(-SCROLL_STEP / 0.14))
    scrollTable.push(y)
  }

  for (const path of POINTER) {
    for (const point of path) {
      if (!point.sel) continue
      // Just before it arrives, since a click can remove what it clicked
      renderFull(point.t - 0.02)
      const el = document.querySelector(point.sel)
      if (!el) throw new Error(`No pointer target ${point.sel}`)
      const rect = el.getBoundingClientRect()
      const box = $('win').getBoundingClientRect()
      const scale = box.width / 1600
      point.x = (rect.left + rect.width / 2 - box.left) / scale
      point.y = (rect.top + rect.height / 2 - box.top) / scale
    }
  }
}

/* ---------------- pointer ---------------- */
function pointerAt(t) {
  for (const path of POINTER) {
    const first = path[0],
      final = path[path.length - 1]
    if (t < first.t - 0.35 || t > final.t + 0.6) continue
    let x = first.x,
      y = first.y
    for (const point of path.slice(1)) {
      const p = E.inOutCubic(seg(t, point.t - (point.move ?? 0.5), point.t))
      x = lerp(x, point.x, p)
      y = lerp(y, point.y, p)
    }
    const click = [...path].reverse().find((p) => p.click && t >= p.t)
    return {
      x,
      y,
      opacity: win(t, first.t - 0.35, final.t + 0.6, 0.2, 0.3),
      click: click && t < click.t + 0.45 ? click : null,
    }
  }
  return null
}

function renderPointer(t) {
  const pointer = pointerAt(t)
  S($('cursor'), {
    opacity: pointer ? pointer.opacity : 0,
    transform: pointer ? `translate(${pointer.x}px, ${pointer.y}px)` : 'none',
  })
  const drag = t > CAT_DRAG && t < CAT_T + 0.1 && pointer
  const release = E.inCubic(seg(t, CAT_T - 0.3, CAT_T + 0.05))
  S($('dragCard'), {
    opacity: drag ? 1 - release : 0,
    transform: drag
      ? `translate(${pointer.x - 40}px, ${pointer.y - 30}px) rotate(${Math.sin(t * 5) * 1.5 * (1 - release) - 3}deg) scale(${1 - release * 0.8})`
      : 'none',
  })
  const ringAt = pointer?.click
  const rp = ringAt ? seg(t, ringAt.t, ringAt.t + 0.45) : 0
  S($('ring'), {
    left: (ringAt?.x ?? 0) + 'px',
    top: (ringAt?.y ?? 0) + 'px',
    opacity: ringAt ? 1 - rp : 0,
    transform: `scale(${0.25 + rp * 0.75})`,
  })
}

/* ---------------- the frame ---------------- */
function renderCaptions(t) {
  const items = [...$('d-cap').children]
  CAPTIONS.forEach(([a, b], i) => {
    const p = win(t, a, b, 0.35, 0.28)
    const rise = E.outCubic(seg(t, a, a + 0.4))
    S(items[i], {
      opacity: p,
      transform: `translateY(${(1 - rise) * 18}px)`,
    })
  })
  const any = CAPTIONS.some(([a, b]) => t >= a && t <= b)
  S($('d-cap'), { visibility: any ? 'visible' : 'hidden' })
}

function renderKeys(t) {
  const press = KEYS.find((k) => t >= k.t - 0.3 && t <= k.t + 0.85)
  if (!press) {
    show($('keys'), 0)
    return
  }
  html(
    $('keys'),
    press.keys.map((k) => `<span class="kbd">${k}</span>`).join('')
  )
  const down =
    seg(t, press.t, press.t + 0.07) * (1 - seg(t, press.t + 0.1, press.t + 0.2))
  show($('keys'), win(t, press.t - 0.3, press.t + 0.85, 0.15, 0.2))
  S($('keys'), {
    transform: `translateY(${down * 6}px) scale(${0.9 + 0.1 * E.outBack(seg(t, press.t - 0.3, press.t))})`,
  })
}

function sceneApp(t) {
  const o = win(t, FORM_FLY + 0.2, END + 0.6, 0.9, 0.6)
  show($('sD'), o)
  if (o <= 0) return

  const cam = camAt(t)
  S($('win'), {
    transform: `translate(${-cam.s * (cam.cx - 800)}px, ${FOCUS_Y - 540 - cam.s * (cam.cy - 470)}px) scale(${cam.s})`,
  })

  const left = leftSidebarAt(t),
    right = rightSidebarAt(t)
  S($('sideL'), {
    width: 310 * left + 'px',
    borderRightWidth: left > 0.01 ? '1px' : '0',
  })
  S($('sideR'), {
    width: 390 * right + 'px',
    borderLeftWidth: right > 0.01 ? '1px' : '0',
  })

  const focus = focusAt(t)
  html($('ed'), decorate(renderDoc(docAt(t), focus > 0), t))
  $('ed').style.setProperty('--dim', focus)
  ;[...$('ed').querySelectorAll('.ae-line')]
    .find((line) => line.textContent.startsWith('![Cute'))
    ?.classList.toggle('line-sel', t >= CAT_SELECT && t < CAT_GONE)
  $('tbFocus').classList.toggle('on', focus > 0.5)
  $('tbType').classList.toggle('on', focus > 0.5)
  const lastKey = Math.max(
    ...[tTitle, tP1, tP2, tAside, tP3, tP4, tBook].map((k) => k.last(t))
  )
  $('ed').style.setProperty(
    '--caret-o',
    caretHidden(t) ? 0 : t - lastKey < 0.5 || t % 1 < 0.55 ? 1 : 0
  )
  S($('edScroll'), { transform: `translateY(${-scrollAt(t)}px)` })
  renderIssuePopover(t)
  // The Git clip frames the panel, so the writing beside it steps back
  if (CLIP === 'git') {
    S($('ed'), { opacity: lerp(0.22, 1, seg(t, COMMIT + 19.3, COMMIT + 20.3)) })
  }
  $('fileTitle').textContent = titleFieldAt(t) || 'New Article'

  const tab =
    t >= COMMIT + 0.3 ? 'git' : t >= EDIT + 0.3 ? 'copyedit' : 'frontmatter'
  for (const id of ['frontmatter', 'copyedit', 'git']) {
    $(`tab-${id}`).classList.toggle('on', id === tab)
    S($(`panel-${id}`), { display: id === tab ? 'block' : 'none' })
  }
  if (tab === 'frontmatter') html($('panel-frontmatter'), frontmatterPanel(t))
  if (tab === 'copyedit') html($('panel-copyedit'), copyeditPanel(t))
  if (tab === 'git') html($('panel-git'), gitPanel(t))

  renderMdx(t)
  renderPalette(t)
  renderToast(t)
  renderPointer(t)
  renderCaptions(t)
  renderKeys(t)
}
