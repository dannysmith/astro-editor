/**
 * Copyedit Mode Extension for CodeMirror 6
 *
 * Provides parts of speech (POS) highlighting for markdown editing.
 * Uses compromise.js for NLP processing.
 */

import { StateField, StateEffect, Transaction } from '@codemirror/state'
import { error as logError } from '@tauri-apps/plugin-log'
import type { Range } from '@codemirror/state'
import {
  EditorView,
  Decoration,
  DecorationSet,
  ViewPlugin,
  ViewUpdate,
} from '@codemirror/view'
import nlp from 'compromise'
import type { GlobalSettings } from '@/lib/bindings'

import { useProjectStore } from '../../../../store/projectStore'
import { POS_CONFIGS } from './constants'
import { readHighlights } from './highlights'
import { processPosType } from './pos-matching'
import type { CompromiseDocument } from './types'

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

  // Provided as a function, so CodeMirror treats the highlights as styling
  // only (see focus-mode.ts): toggling them across the whole document would
  // otherwise make the view jump
  provide: f => EditorView.decorations.of(view => view.state.field(f)),
})

/**
 * Get enabled parts of speech from global settings
 */
function getEnabledPartsOfSpeech(): Set<string> {
  const highlights = readHighlights(useProjectStore.getState().globalSettings)
  return new Set(
    Object.entries(highlights)
      .filter(([, on]) => on)
      .map(([key]) => key)
  )
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
 * Words at `cursorPosition` are skipped, as they're being edited.
 */
function createPosDecorations(
  text: string,
  enabledPartsOfSpeech: Set<string>,
  cursorPosition: number
): DecorationSet {
  // Parsing a long document is a noticeable pause, so not for nothing
  if (enabledPartsOfSpeech.size === 0) return Decoration.none

  const marks: Range<Decoration>[] = []
  const processedRanges = new Set<string>()

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
    // Dev-only: this runs on every document change, so a persistent failure
    // would flood the log
    if (import.meta.env.DEV) {
      void logError(`[CopyeditMode] Error in NLP processing: ${String(error)}`)
    }
  }

  return Decoration.set(marks, true)
}

/** Whether two global settings objects have the same highlights on */
function sameHighlights(
  a: GlobalSettings | null,
  b: GlobalSettings | null
): boolean {
  const first = readHighlights(a)
  const second = readHighlights(b)
  return POS_CONFIGS.every(
    ({ settingKey }) => first[settingKey] === second[settingKey]
  )
}

// Highlight plugin: analyses the document as it changes, and again whenever
// the highlight settings change, from the Copyedit panel or the palette
export const highlightPlugin = ViewPlugin.fromClass(
  class {
    private timeoutId: number | null = null
    private hasInitialAnalysis = false
    private isActivelyEditing = false
    private editingTimeoutId: number | null = null
    private unsubscribe: () => void

    constructor(public view: EditorView) {
      this.unsubscribe = useProjectStore.subscribe((state, previous) => {
        if (!sameHighlights(state.globalSettings, previous.globalSettings)) {
          this.applySettings()
        }
      })
    }

    /** Re-analyses straight away, even mid-edit, as the user asked for it */
    applySettings() {
      if (this.timeoutId !== null) {
        clearTimeout(this.timeoutId)
        this.timeoutId = null
      }
      this.hasInitialAnalysis = true
      this.view.dispatch({
        effects: updatePosDecorations.of(
          createPosDecorations(
            this.view.state.doc.toString(),
            getEnabledPartsOfSpeech(),
            this.view.state.selection.main.head
          )
        ),
      })
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

      const decorations = createPosDecorations(
        doc,
        enabledPartsOfSpeech,
        this.view.state.selection.main.head
      )

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
      this.unsubscribe()
    }
  }
)

/**
 * Create the copyedit mode extension
 */
export function createCopyeditModeExtension() {
  return [highlightDecorations, highlightPlugin]
}
