/*
 * The video's chapters, in order. Each chapter's own file works in times
 * relative to its start (`WRITE + 3.2`), so changing a length here moves
 * everything after it: captions, camera, typing and sound.
 */
const CHAPTER_LENGTHS = {
  why: 13,
  schema: 11,
  write: 53,
  link: 10,
  edit: 26,
  commit: 25,
  end: 12,
}

const CHAPTERS = {}
let chapterEnd = 0
for (const [name, length] of Object.entries(CHAPTER_LENGTHS)) {
  CHAPTERS[name] = { start: chapterEnd, length }
  chapterEnd += length
}
const FULL_DURATION = chapterEnd

const WHY = CHAPTERS.why.start
const SCHEMA = CHAPTERS.schema.start
const WRITE = CHAPTERS.write.start
const LINK = CHAPTERS.link.start
const EDIT = CHAPTERS.edit.start
const COMMIT = CHAPTERS.commit.start
const END = CHAPTERS.end.start

/**
 * The square social clips: a chapter each, then a held end frame. The Copyedit
 * clip stops after the fixes, before the chapter moves on to removing the image.
 */
const CLIPS = {
  copyedit: { from: EDIT, length: 20 },
  git: { from: COMMIT, length: CHAPTERS.commit.length },
}
const CLIP_END_FRAME = 3
const CLIP = new URLSearchParams(location.search).get('clip')
const DURATION = CLIP ? CLIPS[CLIP].length + CLIP_END_FRAME : FULL_DURATION

/** Sound effects, which synth.mjs reads from the page. */
window.__cues = []
function cue(kind, t, options = {}) {
  window.__cues.push({ kind, t, ...options })
}

/** Adds a chapter's markup to the stage. */
function mountScenes(markup) {
  document.getElementById('scenes').insertAdjacentHTML('beforeend', markup)
}
