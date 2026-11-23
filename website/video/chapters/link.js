/*
 * Chapter 4: link. "morning pages" is selected, the command palette opens the
 * Content Finder, and ⌘↵ replaces the selection with a link, as it does in the app.
 */
const LINK_SELECT = LINK + 0.35
const PALETTE_OPEN = LINK + 1.2
const PALETTE_QUERY = typer('find', LINK + 1.5, 0.09, 61)
const FINDER_OPEN = LINK + 2.5
const FINDER_QUERY = typer('morn', LINK + 2.75, 0.09, 62)
const LINK_SUBMIT = LINK + 3.95
const LINK_INSERT = LINK + 4.2
const LINK_TEXT = '[Morning pages](/articles/morning-pages)'

CAPTIONS.push(
  [
    LINK + 0.2,
    LINK + 2.45,
    'Command palette',
    'Everything’s a keystroke away.',
  ],
  [
    LINK + 2.55,
    LINK + 9.8,
    'Links',
    'Link to any post without leaving the keyboard.',
  ]
)

const SHOT_PALETTE = { s: 1.42, cx: 605, cy: 300 }
camTo(PALETTE_OPEN - 0.25, 0.5, SHOT_PALETTE)
camTo(LINK_INSERT, 0.6, SHOT_SIDEBAR)

keyPress(PALETTE_OPEN - 0.15, '⌘', 'P')
keyPress(LINK_SUBMIT, '⌘', '↵')
cue('pop', FINDER_OPEN, { f: 640, amp: 0.08 })
cue('pop', LINK_INSERT, { f: 860, amp: 0.07 })

function linkCaret(t) {
  if (t < LINK_SELECT) return ['book']
  if (t < LINK_INSERT) {
    return [
      'p4',
      (text) => text.indexOf('morning pages') + 'morning pages'.length,
    ]
  }
  return ['p4', (text) => text.indexOf(LINK_TEXT) + LINK_TEXT.length]
}

/** The post's last paragraph, with the link and the Copyedit fixes applied. */
function editedP4(text, t) {
  let out = text
  if (t >= LINK_INSERT) out = out.replace('morning pages', LINK_TEXT)
  for (const issue of ISSUES) {
    if (t >= issue.fixAt) out = out.replace(issue.text, issue.fixed)
  }
  return out
}

function renderPalette(t) {
  const open =
    t >= PALETTE_OPEN && t < LINK_INSERT
      ? E.outExpo(seg(t, PALETTE_OPEN, PALETTE_OPEN + 0.3)) *
        (1 - E.inCubic(seg(t, LINK_INSERT - 0.2, LINK_INSERT)))
      : 0
  show($('palette'), open)
  if (open <= 0) {
    if (t < ASIDE.open || t >= BOOK.insert) show($('mdxDim'), 0)
    return
  }
  show($('mdxDim'), open)
  S($('palette'), {
    transform: `translateY(${(1 - open) * -12}px) scale(${0.97 + 0.03 * open})`,
  })
  const finder = t >= FINDER_OPEN
  const q = finder ? FINDER_QUERY.at(t) : PALETTE_QUERY.at(t)
  const placeholder = finder ? 'Search content...' : 'Type a command...'
  const caretOn =
    t % 1 < 0.55 || t - (finder ? FINDER_QUERY : PALETTE_QUERY).last(t) < 0.4
  const search = `<div class="mdxSearch">${ico('search', 'style="width: 22px; height: 22px; color: #888"')}<span>${q ? esc(q) + (caretOn ? CARET : '') : CARET + `<span class="ph">${placeholder}</span>`}</span></div>`
  html($('palette'), search + (finder ? finderList(q) : paletteList(q)))
}

function paletteList(q) {
  const commands = [
    ['Find Content', 'Search content to open or insert a link', 'Navigation'],
    ['New File', 'Create a new file in the selected collection', 'File'],
    ['Toggle Left Sidebar', 'Show or hide the file list', 'Navigation'],
    ['Toggle Focus Mode', 'Dim all text except current sentence', 'Settings'],
  ].filter(([label]) => label.toLowerCase().includes(q.toLowerCase()))
  return `<div class="mdxList">${commands
    .map(
      ([label, description, group], i) =>
        `<div class="mdxItem ${i === 0 ? 'sel' : ''}"><div><div class="nm">${label}</div><div class="pr">${description}</div></div><span class="pal-group">${group}</span></div>`
    )
    .join('')}</div>`
}

function finderList(q) {
  const entries = [
    ['Morning pages', 'morning-pages.md'],
    ['A week in Lisbon', 'a-week-in-lisbon.md'],
    ['On digital minimalism', 'digital-minimalism.md'],
    ['Five cookbooks I love', 'five-cookbooks.mdx'],
  ].filter(([title]) => title.toLowerCase().includes(q.toLowerCase()))
  return `<div class="mdxList">${entries
    .map(
      ([title, name], i) =>
        `<div class="mdxItem ${i === 0 ? 'sel' : ''}"><div><div class="nm">${title}</div><div class="pr">${name}</div></div><span class="pal-group">articles</span></div>`
    )
    .join(
      ''
    )}</div><div class="pal-foot"><span>↩ Open</span><span>⌘↩ Insert link</span></div>`
}
