/*
 * Chapter 5: edit. Part-of-speech highlights, then Harper's checks catch the
 * three typos typed earlier, using its real messages and suggestions. The cat
 * gets taken out.
 */
// As tagged by compromise, the library the app uses, without its odd guesses
const VERBS = [
  'started',
  'were',
  'get',
  'knew',
  "wasn't",
  'doing',
  "couldn't",
  'seem',
  'stop',
  'made',
  'change',
  'had',
  'fallen',
  'lent',
  "didn't",
  'read',
  'is',
  "don't",
  'try',
  'become',
  'make',
  'want',
  'bought',
  'leaving',
  'Changing',
  'took',
  'was',
  'expected',
  'kept',
  'reaching',
  'stays',
  'used',
  'have',
  'tried',
  'lasted',
  'stuck',
  'stick',
]
const ADVERBS = [
  'properly',
  'then',
  'just',
  'Then',
  'almost',
  'annoyingly',
  'now',
  'already',
  'finally',
]
const POS_WORDS = new RegExp(
  `(?<![\\w'’])(${[...VERBS, ...ADVERBS].sort((a, b) => b.length - a.length).join('|')})(?![\\w'’])`,
  'g'
)

const MENU_OPEN = EDIT + 1.6
const VERBS_ON = EDIT + 2.2
const ADVERBS_ON = EDIT + 2.7
const MENU_CLOSE = EDIT + 3.15
const MENU_REOPEN = EDIT + 5.6
const HIGHLIGHTS_OFF = EDIT + 6.1
const CHECK_TIMES = {
  spelling: EDIT + 7.4,
  grammar: EDIT + 7.7,
  style: EDIT + 8.0,
}
const CHECKS_FOUND = EDIT + 8.7

const ISSUES = [
  {
    id: 'fourty',
    check: 'spelling',
    text: 'fourty',
    fixed: 'forty',
    match: /\bfourty\b/,
    message: 'Did you mean to spell <b>fourty</b> this way?',
    fixes: ['fourth', 'forty', 'fourths'],
    apply: 'forty',
    selectAt: EDIT + 12.2,
    fixAt: EDIT + 13.15,
  },
  {
    id: 'then',
    check: 'grammar',
    text: 'harder then',
    fixed: 'harder than',
    word: 'then',
    match: /(?<=harder )then\b/,
    message: 'Did you mean <b>than</b>?',
    fixes: ['than'],
    apply: 'than',
    selectAt: EDIT + 14.4,
    fixAt: EDIT + 15.3,
  },
  {
    id: 'thethe',
    check: 'style',
    text: 'the the',
    fixed: 'the',
    word: 'the the',
    kind: 'Repetition',
    match: /\bthe the\b/,
    message: 'Did you mean to repeat this word?',
    fixes: ['the'],
    apply: 'the',
    selectAt: EDIT + 16.5,
    fixAt: EDIT + 17.4,
  },
]

const CAT_SELECT = EDIT + 22.2
const CAT_GONE = EDIT + 23.3

CAPTIONS.push(
  [EDIT + 0.2, EDIT + 6.9, 'Copyedit', 'See how your sentences are built.'],
  [
    EDIT + 7.0,
    EDIT + 12.0,
    'Copyedit',
    'Spotted the typos earlier? So did Harper.',
  ],
  [
    EDIT + 12.1,
    EDIT + 21.2,
    'Spelling, grammar & style',
    'Checked on your computer.',
  ],
  [EDIT + 21.3, EDIT + 25.9, 'Images', 'On reflection, maybe no cat.']
)

const SHOT_TEXT_PANEL = { s: 1.5, cx: 985, cy: 345 }
camTo(EDIT + 0.1, 0.9, SHOT_TEXT_PANEL)

// The clip's square frame: the writing, then the panel
const CLIP_TEXT = { s: 1.3, cx: 760, cy: 340 }
const CLIP_PANEL = { s: 1.58, cx: 1262, cy: 330 }
CLIP_CAMERA.copyedit.push(
  { t: 0, d: 0, ...CLIP_PANEL },
  { t: EDIT + 3.3, d: 0.7, ...CLIP_TEXT },
  { t: EDIT + 5.2, d: 0.6, ...CLIP_PANEL },
  { t: EDIT + 8.4, d: 0.7, ...CLIP_TEXT }
)

// A square can't show the panel and the typos together, so the clip fixes them
// from the popover beside each word, which the app also has
const issueTarget = (issue) =>
  CLIP === 'copyedit' ? `#ed .iss.${issue.check}` : `#issue-${issue.id}`
const fixTarget = (issue) =>
  CLIP === 'copyedit' ? `#pop-fix-${issue.id}` : `#fix-${issue.id}`

keyPress(EDIT + 0.15, '⌘', '3')
pointerPath([
  { t: EDIT + 1.1, x: 1000, y: 620 },
  { t: MENU_OPEN, sel: '#ceMenuBtn', click: true, move: 0.5 },
  { t: VERBS_ON, sel: '#ceItem-verbs', click: true, move: 0.35 },
  { t: ADVERBS_ON, sel: '#ceItem-adverbs', click: true, move: 0.3 },
  { t: MENU_CLOSE, x: 1000, y: 640, click: true, move: 0.35 },
  { t: MENU_REOPEN, sel: '#ceMenuBtn', click: true, move: 0.5 },
  { t: HIGHLIGHTS_OFF, sel: '#ceShowAll', click: true, move: 0.3 },
  { t: CHECK_TIMES.spelling, sel: '#ceSw-spelling', click: true, move: 0.5 },
  { t: CHECK_TIMES.grammar, sel: '#ceSw-grammar', click: true, move: 0.2 },
  { t: CHECK_TIMES.style, sel: '#ceSw-style', click: true, move: 0.2 },
  ...ISSUES.flatMap((issue) => [
    { t: issue.selectAt, sel: issueTarget(issue), click: true, move: 0.6 },
    { t: issue.fixAt - 0.05, sel: fixTarget(issue), click: true, move: 0.45 },
  ]),
])
cue('bell', CHECKS_FOUND, { note: 81, amp: 0.03, pan: 0.2 })
cue('pop', CAT_GONE, { f: 340, amp: 0.08 })

const highlightsAt = (t) => {
  if (t < VERBS_ON || t >= HIGHLIGHTS_OFF) return null
  return { verbs: true, adverbs: t >= ADVERBS_ON }
}

/**
 * The caret stays hidden at the first typo while they're fixed, so the view
 * holds still under the pointer, then goes to the cat.
 */
function editCaret(t) {
  if (t >= CAT_GONE) return ['p2']
  if (t >= EDIT + 21.0) return ['cat']
  return [
    'p4',
    (text) => text.search(/fou?rty/) + (t >= ISSUES[0].fixAt ? 5 : 6),
  ]
}

/** The popover beside the issue being fixed, in the square clip. */
function renderIssuePopover(t) {
  const issue =
    CLIP === 'copyedit' && ISSUES.find((i) => t >= i.selectAt && t < i.fixAt)
  const word = issue && $('ed').querySelector(`.iss.${issue.check}`)
  if (!word) {
    show($('issPop'), 0)
    return
  }
  const kind =
    issue.kind ?? (issue.check === 'spelling' ? 'Spelling' : 'Miscellaneous')
  html(
    $('issPop'),
    `<div class="pop-kind">${kind}</div>
     ${issue.check === 'spelling' ? '' : `<div class="pop-msg">${issue.message}</div>`}
     <div class="pop-fixes">${issue.fixes
       .map(
         (fix) =>
           `<span ${fix === issue.apply ? `id="pop-fix-${issue.id}"` : ''}>${fix}</span>`
       )
       .join('')}</div>
     <div class="pop-actions">${issue.check === 'spelling' ? '<span>Add to Dictionary</span>' : ''}<span>Ignore</span></div>`
  )
  const area = $('edArea').getBoundingClientRect()
  const rect = word.getBoundingClientRect()
  const scale = $('win').getBoundingClientRect().width / 1600
  S($('issPop'), {
    left: (rect.left - area.left) / scale + 'px',
    top: (rect.top - area.top) / scale - $('issPop').offsetHeight - 10 + 'px',
  })
  show($('issPop'), E.outCubic(seg(t, issue.selectAt, issue.selectAt + 0.15)))
}

/* ---------------- the Copyedit tab ---------------- */
const POS_ROWS = [
  ['nouns', 'Nouns'],
  ['verbs', 'Verbs'],
  ['adjectives', 'Adjectives'],
  ['adverbs', 'Adverbs'],
  ['conjunctions', 'Conjunctions'],
]

function copyeditPanel(t) {
  const on = highlightsAt(t)
  const names = on
    ? [
        '<span class="pos-verbs">Verbs</span>',
        on.adverbs && '<span class="pos-adverbs">Adverbs</span>',
      ]
        .filter(Boolean)
        .join(', ')
    : '<span class="ph">Highlight parts of speech</span>'
  const menuOpen =
    (t >= MENU_OPEN && t < MENU_CLOSE) ||
    (t >= MENU_REOPEN && t < HIGHLIGHTS_OFF + 0.15)
  const menu = menuOpen
    ? `<div class="ce-menu">
        <div class="ce-menu-item" id="ceShowAll">${on ? 'Hide All' : 'Show All'}</div>
        <div class="ce-menu-sep"></div>
        ${POS_ROWS.map(
          ([key, label]) =>
            `<div class="ce-menu-item" id="ceItem-${key}"><span class="ce-tick">${on?.[key] ? ico('check') : ''}</span><span class="pos-${key}">${label}</span></div>`
        ).join('')}
      </div>`
    : ''
  const checks = [
    ['spelling', 'Spelling'],
    ['grammar', 'Grammar'],
    ['style', 'Style'],
  ]
    .map(
      ([id, label]) =>
        `<div class="ce-check"><span class="ce-dot ${id}"></span>${label}<span class="switch ${t >= CHECK_TIMES[id] ? 'on' : ''}" id="ceSw-${id}"><b></b></span></div>`
    )
    .join('')
  const starting =
    t >= CHECK_TIMES.spelling && t < CHECKS_FOUND
      ? '<p class="ce-starting">Starting checks…</p>'
      : ''
  return `
    <div class="ce-menu-wrap">
      <div class="ce-btn" id="ceMenuBtn"><span>${names}</span>${ico('chevron')}</div>
      ${menu}
    </div>
    <div class="ce-checks">${starting}${checks}</div>
    ${t >= CHECKS_FOUND ? issuesList(t) : ''}`
}

function issuesList(t) {
  const open = ISSUES.filter((issue) => t < issue.fixAt)
  const rows = open
    .map((issue) => {
      const active = t >= issue.selectAt
      const fixes = active
        ? `<div class="iss-fixes">${issue.fixes
            .map(
              (fix) =>
                `<span ${fix === issue.apply ? `id="fix-${issue.id}"` : ''}>${fix}</span>`
            )
            .join('')}<span class="iss-ignore">Ignore</span></div>`
        : ''
      return `<div class="iss-row ${active ? 'active' : ''}" id="issue-${issue.id}">
        <div class="iss-head"><span class="iss-word ${issue.check}">${issue.word ?? issue.text}</span>${issue.kind ? `<span class="iss-kind">${issue.kind}</span>` : ''}</div>
        <div class="iss-msg">${issue.message}</div>
        ${fixes}
      </div>`
    })
    .join('')
  return `<div class="ce-issues">
    <h3>Issues <span>${open.length}</span></h3>
    ${open.length ? rows : '<p class="ce-none">No issues found.</p>'}
  </div>`
}
