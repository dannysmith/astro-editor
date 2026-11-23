/*
 * Chapter 3: write. The post is typed with the sidebars away, in focus mode,
 * with an image and two components, and its typos go in without comment.
 */
const POST = {
  title: '# The book that fixed my mornings',
  p1: "For years I started every day the same way: phone in hand before my eyes were properly open, half an hour of other people's news, and then a rush to get out of the door. I knew it wasn't doing me any good. I just couldn't seem to stop, and every plan I made to change it had fallen apart by Thursday.",
  p2: 'Then a friend lent me a book.',
  aside: "Yes, that's my cat. No, she didn't read it.",
  p3: "Its big idea is almost annoyingly simple: don't try to become a different person, just make the habit you want easier and the one you don't want harder. So I bought a cheap alarm clock and started leaving my phone in the kitchen overnight.",
  p4: "Changing that one small habit took fourty days, and it was harder then I expected. The first week I kept reaching for a phone that wasn't there. But now the the phone stays downstairs until breakfast, and I get an hour of quiet that I never used to have. I'd already tried morning pages, which lasted a week. This one stuck.",
  book: 'The one book that finally made my habits stick.',
}
const CAT_LINE =
  '![Cute Cat (1).jpg](../../assets/articles/2026-11-23-cute-cat-1.jpg)'
const BOOK_TAG =
  '<BookCard title="Atomic Habits" author="James Clear" cover={atomicHabitsCover} rating={5}>'

const tTitle = typer(POST.title, WRITE + 0.35, 0.04, 41)
const tP1 = typer(POST.p1, WRITE + 2.0, 0.0145, 42)
const tP2 = typer(POST.p2, WRITE + 9.6, 0.032, 43)
const CAT_DRAG = WRITE + 12.5
const CAT_T = WRITE + 14.5

const ASIDE = {
  keys: WRITE + 18.0,
  open: WRITE + 18.2,
  query: typer('aside', WRITE + 18.5, 0.09, 44),
  enter: WRITE + 19.3,
  form: WRITE + 19.45,
  submit: WRITE + 20.35,
  insert: WRITE + 20.6,
  item: 'Aside',
}
const tAside = typer(POST.aside, WRITE + 20.8, 0.022, 45)
const tP3 = typer(POST.p3, WRITE + 23.0, 0.0165, 46)
const tP4 = typer(POST.p4, WRITE + 29.2, 0.0145, 47)

const BOOK = {
  keys: WRITE + 39.1,
  open: WRITE + 39.3,
  query: typer('book', WRITE + 39.6, 0.09, 48),
  enter: WRITE + 40.3,
  form: WRITE + 40.45,
  title: typer('Atomic Habits', WRITE + 40.75, 0.034, 49),
  author: typer('James Clear', WRITE + 41.35, 0.034, 50),
  cover: WRITE + 41.95,
  rating: WRITE + 42.3,
  submit: WRITE + 43.1,
  insert: WRITE + 43.35,
  item: 'BookCard',
}
const tBook = typer(POST.book, WRITE + 43.6, 0.022, 51)

// The frontmatter fills in once the right sidebar is back
const FM_TITLE = typer(
  'The book that fixed my mornings',
  WRITE + 47.5,
  0.024,
  52
)
const FM_DESC = typer(
  'How one small change to my mornings finally stuck.',
  WRITE + 48.6,
  0.022,
  53
)
const FM_TAGS = WRITE + 50.2
const TAGS_LIST = ['books', 'habits', 'mornings']

const titleFieldAt = (t) => (t >= FM_TITLE.start ? FM_TITLE.at(t) : '')

/** The left sidebar's width from 0 to 1. Back when the edit starts. */
const leftSidebarAt = (t) =>
  1 -
  E.inOutQuint(seg(t, WRITE + 7.5, WRITE + 8.4)) +
  E.inOutQuint(seg(t, EDIT, EDIT + 0.8))
const rightSidebarAt = (t) =>
  1 -
  E.inOutQuint(seg(t, WRITE + 7.5, WRITE + 8.4)) +
  E.inOutQuint(seg(t, WRITE + 46.2, WRITE + 47.1))
const focusAt = (t) =>
  E.inOutCubic(seg(t, WRITE + 22.2, WRITE + 22.8)) *
  (1 - E.inOutCubic(seg(t, WRITE + 38.2, WRITE + 38.8)))
const caretHidden = (t) =>
  (t >= WRITE + 46.2 && t < LINK) ||
  (t >= EDIT && t < EDIT + 21.0) ||
  t >= COMMIT

CAPTIONS.push(
  [
    WRITE + 0.1,
    WRITE + 7.3,
    'Designed for writing',
    'A writing surface, not a code editor.',
  ],
  [
    WRITE + 7.4,
    WRITE + 12.4,
    'Distraction-free',
    'Hide everything but your words.',
  ],
  [
    WRITE + 12.5,
    WRITE + 17.8,
    'Images',
    'Drag images in. They’re copied, renamed and linked.',
  ],
  [WRITE + 17.9, WRITE + 22.0, 'MDX components', 'Pick a component.'],
  [
    WRITE + 22.1,
    WRITE + 38.6,
    'Focus mode',
    'Keep your eyes on the sentence you’re writing.',
  ],
  [WRITE + 38.9, WRITE + 46.0, 'MDX components', 'Fill in a form.'],
  [
    WRITE + 46.3,
    WRITE + 52.9,
    'Frontmatter',
    'Every field your schema knows about.',
  ]
)

const SHOT_TEXT = { s: 1.42, cx: 800, cy: 350 }
const SHOT_DIALOG = { s: 1.3, cx: 800, cy: 335 }
const SHOT_FORM = { s: 1.14, cx: 800, cy: 400 }
const SHOT_SIDEBAR = { s: 1.3, cx: 862, cy: 400 }
CAMERA.push({ t: 0, d: 0, ...SHOT_WIDE })
camTo(WRITE + 7.4, 1.1, SHOT_TEXT)
camTo(WRITE + 17.6, 0.6, SHOT_DIALOG)
camTo(WRITE + 20.6, 0.7, SHOT_TEXT)
camTo(WRITE + 38.5, 0.6, SHOT_FORM)
camTo(WRITE + 43.4, 0.7, SHOT_TEXT)
camTo(WRITE + 46.2, 0.9, SHOT_SIDEBAR)

keyPress(ASIDE.keys, '⌘', '/')
keyPress(ASIDE.submit, '⌘', '↵')
keyPress(BOOK.keys, '⌘', '/')
keyPress(BOOK.submit, '⌘', '↵')

pointerPath([
  { t: CAT_DRAG, x: 1560, y: 760 },
  { t: CAT_T - 0.3, sel: '#ed .ae-line:nth-of-type(5)', move: 1.5 },
])

cue('whoosh', WRITE + 7.9, { rise: 0.5, fall: 0.6, amp: 0.07 })
cue('pop', CAT_T, { f: 380, amp: 0.09 })
cue('pop', CAT_T + 0.06, { f: 760, amp: 0.05 })
cue('pop', ASIDE.enter, { f: 640, amp: 0.08 })
cue('pop', BOOK.enter, { f: 640, amp: 0.08 })
cue('whoosh', WRITE + 46.5, { rise: 0.4, fall: 0.5, amp: 0.06 })
TAGS_LIST.forEach((_, i) =>
  cue('pop', FM_TAGS + i * 0.28, { f: 800 + i * 80, amp: 0.05, pan: 0.3 })
)

/* ---------------- the frontmatter tab ---------------- */
function frontmatterPanel(t) {
  const title = FM_TITLE.at(t)
  const description = FM_DESC.at(t)
  const editing = (id) =>
    (id === 'title' && t >= FM_TITLE.start && t < FM_DESC.start) ||
    (id === 'desc' && t >= FM_DESC.start && t < FM_TAGS) ||
    (id === 'tags' && t >= FM_TAGS && t < FM_TAGS + 1.1)
  const caret = (id) => (editing(id) ? CARET : '')
  const chips = TAGS_LIST.filter((_, i) => t >= FM_TAGS + i * 0.28)
    .map((tag) => `<span class="chip">${tag} <i>×</i></span>`)
    .join('')
  return `
    <div class="field">
      <div class="flabel">Title <span class="req">*</span></div>
      <div class="input ta title ${editing('title') ? 'focus' : ''}" style="font-weight: 650">${esc(title || 'New Article')}${caret('title')}</div>
    </div>
    <div class="field">
      <div class="flabel">Description</div>
      <div class="input ta ${description ? '' : 'ph'} ${editing('desc') ? 'focus' : ''}">${esc(description) || 'Enter description…'}${caret('desc')}</div>
    </div>
    <div class="field">
      <div class="flabel">Pub Date <span class="req">*</span></div>
      <div class="input">23 Nov 2026<span class="suffix">${ico('chevron', 'style="width: 16px"')}</span></div>
    </div>
    <div class="field">
      <div class="flabel">Cover</div>
      <div class="input imgbtn">Select Image</div>
    </div>
    <div class="field">
      <div class="flabel">Tags</div>
      <div class="input ${chips ? '' : 'ph'} ${editing('tags') ? 'focus' : ''}" style="gap: 6px; padding-left: 7px">${chips || 'Add tags…'}</div>
    </div>
    <div class="field">
      <div class="flabel" style="justify-content: space-between">Draft <span class="switch"><b></b></span></div>
    </div>`
}

/* ---------------- the MDX component builder ---------------- */
const MDX_ITEMS = [
  ['Aside', '2 props + slot', 'astro'],
  ['InfoBox', '2 props + slot', 'vue'],
  ['Callout', '3 props + slot', 'astro'],
  ['BookCard', '10 props + slot', 'astro'],
  ['Alert', '3 props + slot', 'react'],
  ['Badge', '1 prop + slot', 'svelte'],
]
const FW_ICON = {
  vue: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M2 3h4l6 10 6-10h4L12 21z" opacity=".55"/><path fill="currentColor" d="M6.5 3h3L12 7.3 14.5 3h3L12 12.5z"/></svg>',
  astro:
    '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M9.3 2.5h5.4l5.3 15.3c-1.9-1-4.2-1.6-6.3-1.8L12 11l-1.7 5c-2.1.2-4.4.8-6.3 1.8z"/><path fill="currentColor" d="M9 18.5c.8 1.6 2 2.6 3 3 1-.4 2.2-1.4 3-3-2-.4-4-.4-6 0z" opacity=".7"/></svg>',
  react:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><ellipse cx="12" cy="12" rx="10" ry="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/></svg>',
  svelte:
    '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M19.6 4.4c-2-2.8-5.9-3.7-8.7-1.9L6 5.6A5.6 5.6 0 0 0 3.5 9.4a5.9 5.9 0 0 0 .6 3.8 5.6 5.6 0 0 0-.8 2.1 6 6 0 0 0 1 4.5c2 2.8 5.9 3.7 8.7 1.9l4.9-3.1a5.6 5.6 0 0 0 2.5-3.8 5.9 5.9 0 0 0-.6-3.8 5.6 5.6 0 0 0 .8-2.1 6 6 0 0 0-1-4.5z"/></svg>',
}

function mdxPicker(run, t) {
  const q = run.query.at(t)
  const caretOn = t % 1 < 0.55 || t - run.query.last(t) < 0.4
  const items = MDX_ITEMS.filter(([name]) =>
    name.toLowerCase().includes(q.toLowerCase())
  )
  return `
    <div class="mdxSearch">
      ${ico('search', 'style="width: 22px; height: 22px; color: #888"')}
      <span>${q ? esc(q) + (caretOn ? CARET : '') : CARET + '<span class="ph">Search components…</span>'}</span>
    </div>
    <div class="mdxList">
      ${items
        .map(
          ([name, props, fw], i) =>
            `<div class="mdxItem ${i === 0 ? 'sel' : ''}"><div><div class="nm">${name}</div><div class="pr">${props}</div></div><span class="fw ${fw}">${FW_ICON[fw]}${fw}</span></div>`
        )
        .join('')}
    </div>`
}

function formShell(tag, description, body, code) {
  return `
    <div class="mf-head">
      ${ico('back')}<span class="mf-tag">&lt;${tag}&gt;</span>
      <span class="fw astro">${FW_ICON.astro}astro</span>
      <svg class="ico close" viewBox="0 0 24 24">${ICON.close}</svg>
    </div>
    <div class="mf-desc">${description}</div>
    <div class="mf-body">${body}</div>
    <div class="mf-code">${code}</div>
    <div class="mf-foot"><span>⌘↵ Insert&nbsp;&nbsp;&nbsp;esc Back</span><span class="mf-btn">Insert</span></div>`
}

const asideForm = () =>
  formShell(
    'Aside',
    'A callout for notes, tips, cautions and warnings.',
    `<div class="mf-field">
       <div class="mf-label">type</div>
       <div class="mf-input">note<span style="margin-left: auto">${ico('chevron')}</span></div>
     </div>
     <div class="mf-field">
       <div class="mf-label">title</div>
       <div class="mf-input"></div>
     </div>`,
    ['<Aside>', '…', '</Aside>'].map((l) => jsxLine(l) ?? esc(l)).join('\n')
  )

function bookForm(t) {
  const caretOn = t % 1 < 0.55
  const field = (id, typing, from, to) => {
    const focused = t >= from && t < to
    const value = typing.at(t)
    const caret = focused && (caretOn || t - typing.last(t) < 0.4)
    return {
      value,
      markup: `<div class="mf-input ${focused ? 'focus' : ''}">${esc(value)}${caret ? CARET : ''}</div>`,
    }
  }
  const title = field('title', BOOK.title, BOOK.form + 0.2, BOOK.author.start)
  const author = field('author', BOOK.author, BOOK.author.start, BOOK.cover)
  const cover = t >= BOOK.cover
  const rated = t >= BOOK.rating
  const tag = `<BookCard title="${title.value}" author="${author.value}" cover={${cover ? 'atomicHabitsCover' : ''}}${rated ? ' rating={5}' : ''}>`
  return formShell(
    'BookCard',
    'A book with its cover and your rating, for reading lists.',
    `<div class="mf-field"><div class="mf-label">title<i>*</i></div>${title.markup}</div>
     <div class="mf-field"><div class="mf-label">author<i>*</i></div>${author.markup}</div>
     <div class="mf-field">
       <div class="mf-label">cover<i>*</i></div>
       <div class="mf-input mf-img ${cover ? 'set' : ''}">
         <img id="mfThumb" src="assets/atomic-habits.jpg" alt="" style="display: ${cover ? 'block' : 'none'}" />
         ${cover ? '<span class="ph">../../assets/articles/2026-11-23-atomic-habits-cover.jpg</span>' : 'Select Image'}
       </div>
     </div>
     <div class="mf-field mf-row">
       <div class="mf-label">rating</div>
       <div class="mf-input mf-num ${t >= BOOK.rating - 0.15 && t < BOOK.submit ? 'focus' : ''}">${rated ? '5' : ''}</div>
     </div>`,
    [tag, '…', '</BookCard>'].map((l) => jsxLine(l) ?? esc(l)).join('\n')
  )
}

function renderMdx(t) {
  const run = [ASIDE, BOOK].find((r) => t >= r.open && t < r.insert)
  if (!run) {
    show($('mdxDim'), 0)
    show($('mdxPop'), 0)
    return
  }
  const open =
    E.outExpo(seg(t, run.open, run.open + 0.35)) *
    (1 - E.inCubic(seg(t, run.insert - 0.2, run.insert)))
  show($('mdxDim'), open)
  show($('mdxPop'), open)
  const form = t >= run.form
  S($('mdxPop'), {
    top: form ? '56px' : '120px',
    transform: `translateY(${(1 - open) * -16}px) scale(${0.96 + 0.04 * open})`,
  })
  html(
    $('mdxPop'),
    !form ? mdxPicker(run, t) : run === ASIDE ? asideForm() : bookForm(t)
  )
}
