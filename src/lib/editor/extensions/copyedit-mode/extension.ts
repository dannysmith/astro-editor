/**
 * Copyedit Mode Extension for CodeMirror 6
 *
 * Provides parts of speech (POS) highlighting for markdown editing.
 * Uses compromise.js for NLP processing.
 */

import { StateField, StateEffect, Transaction } from '@codemirror/state'
import type { Range } from '@codemirror/state'
import {
  EditorView,
  Decoration,
  DecorationSet,
  ViewPlugin,
  ViewUpdate,
} from '@codemirror/view'
import nlp from 'compromise'

import { useProjectStore } from '../../../../store/projectStore'
import { POS_CONFIGS } from './constants'
import { processPosType } from './pos-matching'
import type { CompromiseDocument } from './types'

// Global reference to current view for external updates
let currentEditorView: EditorView | null = null

// State effects for highlight control
export const updatePosDecorations = StateEffect.define<DecorationSet>()

// Highlight decorations
export const highlightDecorations = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },

  update(decorations: DecorationSet, tr: Transaction) {
    // Handle explicit decoration updates
    for (const effect of tr.effects) {
      if (effect.is(updatePosDecorations)) {
        // Replace all decorations instead of merging
        return effect.value
      }
    }

    // Map existing decorations through document changes
    return decorations.map(tr.changes)
  },

  provide: f => EditorView.decorations.from(f),
})

/**
 * Get enabled parts of speech from global settings
 */
function getEnabledPartsOfSpeech(): Set<string> {
  const globalSettings = useProjectStore.getState().globalSettings
  const highlights = globalSettings?.general?.highlights

  const enabled = new Set<string>()
  // Use nullish coalescing to properly handle false values
  if (highlights?.nouns ?? true) enabled.add('nouns')
  if (highlights?.verbs ?? true) enabled.add('verbs')
  if (highlights?.adjectives ?? true) enabled.add('adjectives')
  if (highlights?.adverbs ?? true) enabled.add('adverbs')
  if (highlights?.conjunctions ?? true) enabled.add('conjunctions')

  return enabled
}

/**
 * Check if any highlights are enabled
 */
function hasAnyHighlightsEnabled(): boolean {
  const enabledPartsOfSpeech = getEnabledPartsOfSpeech()
  return enabledPartsOfSpeech.size > 0
}

/**
 * Create decorations for parts of speech highlighting.
 * Uses a configuration-driven approach to process all POS types uniformly.
 */
function createPosDecorations(
  text: string,
  enabledPartsOfSpeech: Set<string>
): DecorationSet {
  const marks: Range<Decoration>[] = []
  const processedRanges = new Set<string>()

  // Get current cursor position to exclude words being actively edited
  const cursorPosition = currentEditorView?.state.selection.main.head ?? -1

  try {
    // Parse the text with compromise.js
    const doc = nlp(text) as CompromiseDocument

    // Process each enabled POS type using config-driven approach
    for (const config of POS_CONFIGS) {
      if (!enabledPartsOfSpeech.has(config.settingKey)) {
        continue
      }

      const validRanges = processPosType(
        doc,
        text,
        config,
        cursorPosition,
        processedRanges
      )

      // Create decorations from valid ranges
      for (const range of validRanges) {
        marks.push(
          Decoration.mark({ class: config.className }).range(
            range.from,
            range.to
          )
        )
      }
    }

    // Sort marks by position to ensure proper application
    marks.sort((a, b) => a.from - b.from)
  } catch (error) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error('[CopyeditMode] Error in NLP processing:', error)
    }
  }

  return Decoration.set(marks, true)
}

/**
 * Trigger re-analysis from external components
 */
export function updateCopyeditModePartsOfSpeech() {
  if (currentEditorView) {
    // Always re-analyze when called externally (user toggled settings)
    const enabledPartsOfSpeech = getEnabledPartsOfSpeech()
    const doc = currentEditorView.state.doc.toString()
    const decorations = createPosDecorations(doc, enabledPartsOfSpeech)

    // Preserve cursor position during decoration update
    currentEditorView.dispatch({
      effects: updatePosDecorations.of(decorations),
      selection: currentEditorView.state.selection,
      scrollIntoView: false,
    })

    // Force the view to update by requesting a measure
    currentEditorView.requestMeasure()
  }
}

// Highlight plugin with view tracking
export const highlightPlugin = ViewPlugin.fromClass(
  class {
    private timeoutId: number | null = null
    private hasInitialAnalysis = false
    private isActivelyEditing = false
    private editingTimeoutId: number | null = null

    constructor(public view: EditorView) {
      currentEditorView = view // Store reference for external access
    }

    update(update: ViewUpdate) {
      // Always check if any highlights are enabled and analyze if needed
      const hasHighlights = hasAnyHighlightsEnabled()

      if (hasHighlights && update.docChanged) {
        // ANY document change means we're actively editing
        this.isActivelyEditing = true

        // Clear previous editing timeout
        if (this.editingTimeoutId !== null) {
          clearTimeout(this.editingTimeoutId)
        }

        // Set editing state to false after 3 seconds of complete inactivity
        this.editingTimeoutId = window.setTimeout(() => {
          this.isActivelyEditing = false
          // Immediately re-analyze after editing stops
          this.scheduleAnalysis()
        }, 3000)
      } else if (hasHighlights && !this.hasInitialAnalysis) {
        this.hasInitialAnalysis = true
        this.scheduleAnalysis()
      }
    }

    scheduleAnalysis() {
      if (this.timeoutId !== null) {
        clearTimeout(this.timeoutId)
      }

      // If actively editing, clear decorations immediately and don't schedule analysis
      if (this.isActivelyEditing) {
        this.view.dispatch({
          effects: updatePosDecorations.of(Decoration.none),
        })
        return
      }
      this.timeoutId = window.setTimeout(() => {
        this.analyzeDocument()
      }, 300)
    }

    analyzeDocument() {
      // Skip analysis if actively editing to prevent cursor interference
      if (this.isActivelyEditing) {
        return
      }

      const doc = this.view.state.doc.toString()

      // Get enabled parts of speech from global settings
      const enabledPartsOfSpeech = getEnabledPartsOfSpeech()

      const decorations = createPosDecorations(doc, enabledPartsOfSpeech)

      // Store cursor position before applying decorations
      const currentSelection = this.view.state.selection

      this.view.dispatch({
        effects: updatePosDecorations.of(decorations),
        selection: currentSelection, // Preserve cursor position
        scrollIntoView: false, // Don't scroll when updating decorations
      })
    }

    destroy() {
      if (this.timeoutId !== null) {
        clearTimeout(this.timeoutId)
      }
      if (this.editingTimeoutId !== null) {
        clearTimeout(this.editingTimeoutId)
      }
      if (currentEditorView === this.view) {
        currentEditorView = null // Clear reference
      }
    }
  }
)

/**
 * Create the copyedit mode extension
 */
export function createCopyeditModeExtension() {
  return [highlightDecorations, highlightPlugin]
}
