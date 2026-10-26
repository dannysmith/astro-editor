import { describe, it, expect, beforeEach } from 'vitest'
import { buildUiTree, findByText, labelOf, roleOf } from './ui-tree'

// jsdom has no layout, so visibility comes from a data attribute in these tests
const options = {
  isVisible: (el: Element) => !el.hasAttribute('data-hidden'),
  hasArea: (el: Element) => !el.hasAttribute('data-no-area'),
}

function render(html: string) {
  document.body.innerHTML = html
  return document.body
}

describe('roleOf', () => {
  it('uses explicit roles, then implicit ones', () => {
    render(`
      <div role="menuitem checkbox" id="a"></div>
      <a href="/x" id="b"></a><a id="c"></a>
      <input type="checkbox" id="d"><input type="hidden" id="e"><input id="f">
      <h3 id="g"></h3>
    `)
    const role = (id: string) => roleOf(document.getElementById(id)!)
    expect(role('a')).toBe('menuitem')
    expect(role('b')).toBe('link')
    expect(role('c')).toBeNull()
    expect(role('d')).toBe('checkbox')
    expect(role('e')).toBeNull()
    expect(role('f')).toBe('textbox')
    expect(role('g')).toBe('heading')
  })
})

describe('labelOf', () => {
  it('prefers aria-label, then aria-labelledby, then label, placeholder and text', () => {
    render(`
      <button id="a" aria-label="Close">×</button>
      <span id="title">Settings</span><div id="b" aria-labelledby="title">…</div>
      <label for="c">Title</label><input id="c" placeholder="Enter title...">
      <input id="d" placeholder="Search">
      <button id="e">  Save
        changes </button>
    `)
    const label = (id: string) => labelOf(document.getElementById(id)!)
    expect(label('a')).toBe('Close')
    expect(label('b')).toBe('Settings')
    expect(label('c')).toBe('Title')
    expect(label('d')).toBe('Search')
    expect(label('e')).toBe('Save changes')
  })

  it('truncates long labels', () => {
    render(`<button id="a">${'x'.repeat(200)}</button>`)
    expect(labelOf(document.getElementById('a')!)).toHaveLength(80)
  })
})

describe('buildUiTree', () => {
  let refs: Map<number, Element>
  beforeEach(() => {
    refs = new Map()
  })

  it('outlines containers, controls and text with numbered refs', () => {
    render(`
      <nav aria-label="Files">
        <button>First</button>
        <button disabled>Second</button>
      </nav>
      <main>
        <h2>Welcome</h2>
        <p>Pick a file</p>
        <input type="checkbox" checked aria-label="Draft">
        <input value="Hello" aria-label="Title">
      </main>
    `)
    expect(buildUiTree(document.body, refs, options)).toBe(
      [
        'navigation "Files"',
        '  button "First" [1]',
        '  button "Second" [2] (disabled)',
        'main',
        '  heading "Welcome" [3] (h2)',
        '  text "Pick a file"',
        '  checkbox "Draft" [4] (checked)',
        '  textbox "Title" [5] (value="Hello")',
      ].join('\n')
    )
    expect(refs.get(1)?.textContent).toBe('First')
    expect(refs.get(5)).toBeInstanceOf(HTMLInputElement)
  })

  it('skips hidden subtrees, aria-hidden, inert and elements without area', () => {
    render(`
      <div data-hidden><button>Hidden</button></div>
      <div aria-hidden="true"><button>Aria hidden</button></div>
      <div inert><button>Inert</button></div>
      <h2 data-no-area>Screen reader title</h2>
      <button>Shown</button>
    `)
    expect(buildUiTree(document.body, refs, options)).toBe('button "Shown" [1]')
  })

  it('leaves out containers with nothing visible inside', () => {
    render(`<ul><li data-hidden>Gone</li></ul><button>Shown</button>`)
    expect(buildUiTree(document.body, refs, options)).toBe('button "Shown" [1]')
  })

  it('summarises CodeMirror instead of walking its lines', () => {
    render(`
      <div class="cm-editor">
        <div class="cm-line">One</div><div class="cm-line">Two</div>
      </div>
    `)
    expect(buildUiTree(document.body, refs, options)).toBe(
      'editor (2 visible lines) [1]'
    )
  })

  it('resets refs on each call', () => {
    render(`<button>One</button>`)
    buildUiTree(document.body, refs, options)
    render(`<button>Two</button>`)
    buildUiTree(document.body, refs, options)
    expect(refs.size).toBe(1)
    expect(refs.get(1)?.textContent).toBe('Two')
  })
})

describe('findByText', () => {
  it('prefers an exact match over a partial one, ignoring case', () => {
    render(`
      <button id="a">Save as draft</button>
      <button id="b">Save</button>
    `)
    expect(findByText(document.body, 'save', options)?.id).toBe('b')
    expect(findByText(document.body, 'draft', options)?.id).toBe('a')
  })

  it("doesn't match containers on their text", () => {
    render(
      `<ul role="list" id="list"><li><button id="a">Open project</button></li></ul>`
    )
    expect(findByText(document.body, 'open', options)?.id).toBe('a')
  })

  it('ignores hidden elements and returns null when nothing matches', () => {
    render(`<button data-hidden>Save</button>`)
    expect(findByText(document.body, 'Save', options)).toBeNull()
  })
})
