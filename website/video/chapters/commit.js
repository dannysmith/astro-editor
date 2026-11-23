/*
 * Chapter 6: commit. The Git tab has ticked the post and its book cover, and
 * spots the cat that was taken out. Stage, commit, push.
 */
const GIT_STAGE = COMMIT + 10.7
const GIT_COMMIT = COMMIT + 13.5
const GIT_PUSH = COMMIT + 15.5
const GIT_PUSHED = COMMIT + 16.1
const COMMIT_MESSAGE = 'Add “The book that fixed my mornings”'

CAPTIONS.push(
  [
    COMMIT + 0.2,
    COMMIT + 4.9,
    'Git',
    'It knows which files belong to this post.',
  ],
  [COMMIT + 5.0, COMMIT + 10.0, 'Git', 'Even the one you took out.'],
  [COMMIT + 10.1, COMMIT + 19.2, 'Git', 'Stage. Commit. Push.'],
  [
    COMMIT + 20.0,
    COMMIT + 24.9,
    'Written, edited and committed',
    'Without leaving writer mode.',
  ]
)

const SHOT_GIT = { s: 1.62, cx: 1007, cy: 322 }
const SHOT_GIT_FILES = { s: 2.05, cx: 1132, cy: 400 }
const SHOT_GIT_CARD = { s: 1.5, cx: 960, cy: 355 }
camTo(COMMIT, 0.9, SHOT_GIT)
camTo(COMMIT + 5.0, 0.8, SHOT_GIT_FILES)
camTo(COMMIT + 10.0, 0.7, SHOT_GIT_CARD)
camTo(COMMIT + 19.3, 1.2, SHOT_WIDE)

// The square clip stays on the panel
const CLIP_GIT = { s: 2.2, cx: 1405, cy: 300 }
const CLIP_GIT_CARD = { s: 1.62, cx: 1405, cy: 395 }
CLIP_CAMERA.git.push(
  { t: 0, d: 0, ...CLIP_GIT },
  { t: COMMIT + 5.0, d: 0.7, s: 2.5, cx: 1405, cy: 400 },
  { t: COMMIT + 10.0, d: 0.7, ...CLIP_GIT_CARD },
  { t: COMMIT + 19.3, d: 1.2, s: 0.66, cx: 800, cy: 450 }
)

keyPress(COMMIT + 0.15, '⌘', '4')
pointerPath([
  { t: COMMIT + 9.9, x: 1000, y: 640 },
  { t: GIT_STAGE, sel: '#gitStage', click: true, move: 0.6 },
  { t: GIT_COMMIT, sel: '#gitCommit', click: true, move: 0.6 },
  { t: GIT_PUSH, sel: '#gitPush', click: true, move: 0.6 },
])
cue('bell', GIT_COMMIT + 0.1, { note: 78, amp: 0.035, pan: -0.2 })
cue('bell', GIT_PUSHED, { note: 83, amp: 0.035, pan: 0.2 })

function gitFile(name, letter, ticked, note) {
  return `<div class="git-file">
    <span class="git-box ${ticked ? 'on' : ''}">${ticked ? ico('check') : ''}</span>
    <span class="git-name">${name}</span>
    ${note ? `<span class="git-warn">${ico('warning')}</span>` : ''}
    <span class="git-letter ${letter}">${letter}</span>
    ${note ? `<div class="git-note">${note}</div>` : ''}
  </div>`
}

function gitPanel(t) {
  const staged = t >= GIT_STAGE && t < GIT_COMMIT + 0.1
  const committed = t >= GIT_COMMIT + 0.1
  const pushing = t >= GIT_PUSH && t < GIT_PUSHED
  const pushed = t >= GIT_PUSHED
  const counts =
    committed && !pushed
      ? `${ico('up', 'style="width: 13px; height: 13px"')}1`
      : 'in sync'
  const strip = `<div class="git-strip">
    ${ico('branch', 'style="width: 15px; height: 15px"')}
    <b>main</b><span>origin/main</span><span class="git-counts">${counts}</span>
    <span class="git-btns">
      <span class="git-btn">Pull</span>
      <span class="git-btn ${committed && !pushed ? '' : 'off'}" id="gitPush">${pushing ? 'Pushing…' : 'Push'}</span>
    </span>
  </div>`

  const status = committed ? 'Committed' : staged ? 'Staged' : 'Untracked'
  const dot = committed ? '' : staged ? 'added' : 'added'
  const entry = `<div class="git-section">
      <h3>This entry <span>articles</span></h3>
      <div class="git-entry">
        <div><span class="git-dot ${dot}"></span><b>the-book-that-fixed-my-mo…</b><span class="git-status">${status}</span></div>
        <p>${committed ? 'Last committed just now by Alex Morgan' : 'Never committed'}</p>
      </div>
    </div>`

  const action = staged
    ? `<div class="git-card">
        <div class="git-card-head">${ico('checkCircle')} 2 files staged for commit</div>
        <div class="git-card-body">
          <label>Commit message</label>
          <div class="git-message">${COMMIT_MESSAGE}</div>
          <div class="git-card-btns"><span class="git-cancel">Cancel</span><span class="git-commit" id="gitCommit">Commit 2 files</span></div>
          <div class="git-staged">
            <p>To be committed to main:</p>
            <div><span>2026-11-23-atomic-habits-cover.jpg</span><i>A</i></div>
            <div><span>the-book-that-fixed-my-mornings.mdx</span><i>A</i></div>
          </div>
        </div>
      </div>`
    : committed
      ? `<div class="git-stage off">Nothing to stage</div>
         <p class="git-done">${ico('checkCircle')} Committed <code>a1b2c3d</code> to main</p>`
      : '<div class="git-stage" id="gitStage">Stage 2 files</div>'

  const files = committed
    ? gitFile(
        '2026-11-23-cute-cat-1.jpg',
        'U',
        false,
        'No longer used in the entry'
      )
    : gitFile('2026-11-23-atomic-habits-cover.jpg', staged ? 'A' : 'U', true) +
      gitFile(
        '2026-11-23-cute-cat-1.jpg',
        'U',
        false,
        'No longer used in the entry'
      )

  return `${strip}${entry}${action}
    <div class="git-section"><h3>Files it uses</h3>${files}</div>
    <div class="git-other">${ico('right', 'style="width: 15px; height: 15px"')} No other uncommitted changes</div>`
}

function renderToast(t) {
  const o = win(t, GIT_PUSHED, GIT_PUSHED + 3.1, 0.25, 0.35)
  show($('toast'), o)
  if (o <= 0) return
  html($('toast'), `${ico('checkCircle')} Pushed to origin/main`)
  S($('toast'), {
    transform: `translateY(${(1 - E.outCubic(seg(t, GIT_PUSHED, GIT_PUSHED + 0.3))) * 18}px)`,
  })
}
