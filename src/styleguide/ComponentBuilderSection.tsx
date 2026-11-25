import type { MdxComponent, PropInfo, PropKind } from '@/types'
import { Dialog, DialogContent, DialogTitle } from '../components/ui/dialog'
import { ComponentForm } from '../components/component-builder/ComponentForm'
import { useComponentBuilderStore } from '../store/componentBuilderStore'

function prop(
  name: string,
  kind: PropKind,
  extra: Partial<PropInfo> = {}
): PropInfo {
  return {
    name,
    prop_type: '',
    kind,
    is_optional: true,
    default_value: null,
    description: null,
    ...extra,
  }
}

/**
 * A component with one prop of each kind the form has a control for, and an
 * empty required one
 */
const COMPONENT: MdxComponent = {
  name: 'Event',
  file_path: 'src/components/mdx/Event.astro',
  framework: 'react',
  has_slot: true,
  description: 'An event listing, with a title, date and speakers.',
  import_source: null,
  named_export: false,
  slot_template: null,
  props: [
    prop(
      'title',
      { kind: 'string' },
      { is_optional: false, description: 'What the event is called' }
    ),
    prop('date', { kind: 'date' }, { is_optional: false }),
    prop(
      'format',
      { kind: 'literals', values: ['in-person', 'online', 'hybrid'] },
      { default_value: 'in-person' }
    ),
    prop('capacity', { kind: 'number' }, { default_value: '50' }),
    prop('free', { kind: 'boolean' }, { default_value: 'true' }),
    prop('featured', { kind: 'boolean' }, { is_optional: false }),
    prop('speakers', { kind: 'array', items: { kind: 'string' } }),
    prop('venue', { kind: 'string' }, { is_optional: false }),
    prop(
      'track',
      { kind: 'literals', values: ['design', 'engineering', 'product'] },
      { description: 'Which track the talk is in' }
    ),
    prop('emoji', { kind: 'string' }),
  ],
}

// The form reads its component and values from the builder store, as in the app
useComponentBuilderStore.setState({
  selectedComponent: COMPONENT,
  step: 'configure',
  values: {
    title: 'Launch night',
    date: '2026-01-15',
    featured: true,
    speakers: ['Ada', 'Grace'],
  },
})

export function ComponentBuilderSection() {
  return (
    <Dialog open>
      <DialogContent className="overflow-hidden p-0 sm:max-w-2xl">
        <DialogTitle className="sr-only">Insert MDX Component</DialogTitle>
        <ComponentForm component={COMPONENT} />
      </DialogContent>
    </Dialog>
  )
}
