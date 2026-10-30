/**
 * Hand-written corrections and additions for Starlight's components, merged
 * over what `generate.ts` reads from their types. Every component Starlight
 * exports must have an entry here, so a new one gets looked at before it ships.
 *
 * Slot templates use CodeMirror snippet syntax: `${name}` is a tab stop
 * pre-filled with its name, `${}` an empty one.
 */
export interface ComponentOverride {
  /** Starlight's components have no JSDoc, so every one gets a short description */
  description: string
  has_slot?: boolean
  /** Content inserted inside the tag, in place of an empty slot */
  slot_template?: string
  /** Only these props are offered, in this order */
  props?: string[]
  /** Props the generator drops as inherited (e.g. from HTMLAttributes) but writers need */
  inherited?: Record<string, { required: boolean }>
  /** The order to list literal values in, by prop */
  literal_order?: Record<string, string[]>
  /** Props whose defaults mean nothing to a writer */
  no_default?: string[]
}

export const OVERRIDES: Record<string, ComponentOverride> = {
  Aside: {
    description: 'A callout for notes, tips, cautions and warnings.',
  },
  Badge: {
    description: 'A small label, like “New” or “Deprecated”.',
    literal_order: {
      variant: ['default', 'note', 'tip', 'caution', 'danger', 'success'],
    },
  },
  Card: {
    description: 'A box with a title, an optional icon and some content.',
  },
  CardGrid: {
    description: 'Lays out cards side by side.',
    slot_template:
      '\n  <Card title="${First card}">\n    ${}\n  </Card>\n  <Card title="${Second card}">\n    ${}\n  </Card>\n',
  },
  Code: {
    description:
      'A code block from a string, for code that a fenced block can’t hold.',
    // Code reads Astro.slots only to throw an error if anything is slotted
    has_slot: false,
    props: ['code', 'lang', 'title', 'frame', 'wrap'],
    no_default: ['lang'],
  },
  FileTree: {
    description: 'A file and folder listing, written as a nested list.',
    slot_template: '\n\n- ${src/}\n  - ${index.md}\n- ${README.md}\n\n',
  },
  Icon: {
    description: 'One of Starlight’s built-in icons.',
  },
  LinkButton: {
    description: 'A link that looks like a button.',
  },
  LinkCard: {
    description: 'A card that links to another page.',
    // From HTMLAttributes<'a'>, typed optional, but the card is a link
    inherited: { href: { required: true } },
  },
  Steps: {
    description: 'Numbered steps, written as an ordered list.',
    slot_template: '\n\n1. ${First step}\n\n2. ${Second step}\n\n',
  },
  TabItem: {
    description: 'One tab inside Tabs.',
  },
  Tabs: {
    description: 'Content in tabs, each a TabItem.',
    slot_template:
      '\n  <TabItem label="${First tab}">\n    ${}\n  </TabItem>\n  <TabItem label="${Second tab}">\n    ${}\n  </TabItem>\n',
  },
}
