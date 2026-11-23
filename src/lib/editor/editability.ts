import { Compartment, EditorState } from '@codemirror/state'
import { fileLoad } from './load-document'

/** The store state that decides whether the open file can be edited */
export interface Editability {
  isLoaded: boolean
  editingPaused: boolean
}

/**
 * The editor is read-only until the open file has loaded: until then it holds
 * an empty placeholder (see `isLoaded` in editorStore). Also while editing is
 * paused for a pull (`editingPaused`). Read-only rather than not editable, so
 * focus stays in the editor while switching files.
 *
 * Read-only only stops typing. While paused, every other change (formatting
 * commands, drops, pastes, fixes) is refused too, apart from loading the file
 * from disk. The filter is only there while paused, so typing never runs it.
 */
export const editabilityCompartment = new Compartment()

const refuseEdits = EditorState.changeFilter.of(
  transaction => transaction.annotation(fileLoad) === true
)

export const isEditable = ({ isLoaded, editingPaused }: Editability) =>
  isLoaded && !editingPaused

/** The extensions for `editabilityCompartment` */
export const editability = (state: Editability) => [
  EditorState.readOnly.of(!isEditable(state)),
  state.editingPaused ? refuseEdits : [],
]
