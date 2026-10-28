import { describe, expect, it } from 'vitest'
import type { MdxComponent, PropInfo, PropKind } from '@/types'
import {
  buildPreview,
  buildSnippet,
  insertsAsBlock,
  serializeProp,
} from './snippet-builder'

function prop(name: string, kind: PropKind, is_optional = true): PropInfo {
  return {
    name,
    prop_type: '',
    kind,
    is_optional,
    default_value: null,
    description: null,
  }
}

function component(
  props: PropInfo[],
  overrides: Partial<MdxComponent> = {}
): MdxComponent {
  return {
    name: 'Callout',
    file_path: 'src/components/mdx/Callout.astro',
    props,
    has_slot: false,
    description: null,
    framework: 'astro',
    import_source: null,
    slot_template: null,
    ...overrides,
  }
}

describe('serializeProp', () => {
  it('leaves out props without a value', () => {
    const title = prop('title', { kind: 'string' })
    expect(serializeProp(title, undefined)).toBeNull()
    expect(serializeProp(title, '')).toBeNull()
    expect(
      serializeProp(
        prop('tags', { kind: 'array', items: { kind: 'string' } }),
        []
      )
    ).toBeNull()
  })

  it('writes strings, literals and unknown types as strings', () => {
    expect(serializeProp(prop('title', { kind: 'string' }), 'Hello')).toBe(
      'title="Hello"'
    )
    expect(
      serializeProp(prop('size', { kind: 'literals', values: ['sm'] }), 'sm')
    ).toBe('size="sm"')
    expect(serializeProp(prop('x', { kind: 'unknown' }), 'a b')).toBe('x="a b"')
  })

  it('uses a template literal for strings with quotes or newlines', () => {
    const code = prop('code', { kind: 'string' })
    expect(serializeProp(code, 'say "hi"')).toBe('code={`say "hi"`}')
    expect(serializeProp(code, 'a\n\t`b` ${c}')).toBe(
      'code={`a\\n\\t\\`b\\` \\${c}`}'
    )
  })

  it('writes numbers, booleans and dates as expressions', () => {
    expect(serializeProp(prop('count', { kind: 'number' }), ' 42 ')).toBe(
      'count={42}'
    )
    const open = prop('open', { kind: 'boolean' })
    expect(serializeProp(open, true)).toBe('open')
    expect(serializeProp(open, false)).toBe('open={false}')
    expect(serializeProp(prop('when', { kind: 'date' }), '2026-01-01')).toBe(
      "when={new Date('2026-01-01')}"
    )
  })

  it('writes images and collection entries as the variable named', () => {
    expect(serializeProp(prop('hero', { kind: 'image' }), 'heroImage')).toBe(
      'hero={heroImage}'
    )
    expect(
      serializeProp(
        prop('post', { kind: 'collectionEntry', collection: 'blog' }),
        'post'
      )
    ).toBe('post={post}')
  })

  it('writes arrays as array literals', () => {
    expect(
      serializeProp(
        prop('tags', { kind: 'array', items: { kind: 'string' } }),
        ['a', "it's"]
      )
    ).toBe("tags={['a', 'it\\'s']}")
    expect(
      serializeProp(
        prop('sizes', { kind: 'array', items: { kind: 'number' } }),
        ['1', '2']
      )
    ).toBe('sizes={[1, 2]}')
  })
})

describe('buildPreview', () => {
  it('includes props with values and required props, in declaration order', () => {
    const c = component([
      prop('type', { kind: 'literals', values: ['note', 'tip'] }, false),
      prop('title', { kind: 'string' }),
      prop('count', { kind: 'number' }),
    ])
    expect(buildPreview(c, { count: '3' })).toBe(
      '<Callout type="note" count={3} />'
    )
  })

  it('adds a slot and the client directive for framework components', () => {
    const c = component([], { has_slot: true, framework: 'react' })
    expect(buildPreview(c, {}, 'client:idle')).toBe(
      '<Callout client:idle>…</Callout>'
    )
    expect(buildPreview(component([]), {}, 'client:idle')).toBe('<Callout />')
    expect(
      buildPreview(component([], { framework: 'vue' }), {}, 'client:only')
    ).toBe('<Callout client:only="vue" />')
    expect(
      buildPreview(component([], { framework: 'react' }), {}, 'client:media')
    ).toBe('<Callout client:media="(max-width: 50em)" />')
  })
})

describe('insertsAsBlock', () => {
  it('puts components with a slot template, or a slot on an empty line, on lines of their own', () => {
    const slotted = component([], { has_slot: true })
    expect(insertsAsBlock(slotted, true)).toBe(true)
    expect(insertsAsBlock(slotted, false)).toBe(false)
    expect(insertsAsBlock(component([]), true)).toBe(false)
    expect(
      insertsAsBlock(
        component([], { has_slot: true, slot_template: '\n' }),
        false
      )
    ).toBe(true)
  })

  it('gives a block component its content on its own line', () => {
    const c = component([], { has_slot: true })
    expect(buildSnippet(c, {}, 'none', true)).toBe(
      '<Callout>\n${1:}\n</Callout>${}'
    )
    expect(buildPreview(c, {}, 'none', true)).toBe('<Callout>\n…\n</Callout>')
  })
})

describe('buildSnippet', () => {
  it('turns empty required props and the slot into tab stops', () => {
    const c = component(
      [
        prop('title', { kind: 'string' }, false),
        prop('count', { kind: 'number' }, false),
      ],
      { has_slot: true }
    )
    expect(buildSnippet(c, {})).toBe(
      '<Callout title="${1:}" count=\\{${2:}\\}>${3:}</Callout>${}'
    )
  })

  it('fills the slot from the template, keeping its tab stops', () => {
    const c = component([prop('label', { kind: 'string' }, false)], {
      name: 'Tabs',
      has_slot: true,
      slot_template: '\n  <TabItem label="${First}">${}</TabItem>\n',
    })
    expect(buildSnippet(c, {})).toBe(
      '<Tabs label="${1:}">\n  <TabItem label="${First}">${}</TabItem>\n</Tabs>${}'
    )
    expect(buildPreview(c, { label: 'x' })).toBe(
      '<Tabs label="x">\n  <TabItem label="First"></TabItem>\n</Tabs>'
    )
  })

  it('escapes braces in entered values so they stay literal', () => {
    const c = component([prop('count', { kind: 'number' })])
    expect(buildSnippet(c, { count: '2' })).toBe('<Callout count=\\{2\\} />${}')
  })
})
