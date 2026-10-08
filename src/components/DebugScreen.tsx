import React from 'react'
import { EditorView, keymap, drawSelection } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import {
  closeBrackets,
  closeBracketsKeymap,
  snippet,
} from '@codemirror/autocomplete'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { markdown } from '@codemirror/lang-markdown'

export const DebugScreen: React.FC = () => {
  const editorRef = React.useRef<HTMLDivElement>(null)
  const viewRef = React.useRef<EditorView | null>(null)

  React.useEffect(() => {
    if (!editorRef.current || viewRef.current) return

    const extensions = [
      history(),
      drawSelection(),
      EditorState.allowMultipleSelections.of(true),
      EditorView.clickAddsSelectionRange.of(
        event => event.metaKey || event.ctrlKey
      ),
      markdown(),
      closeBrackets(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap]),
    ]

    const startState = EditorState.create({
      doc: '# Snippet Test\n\nClick the button above to insert a Callout component.\n\n',
      extensions: [
        ...extensions,
        EditorView.theme({
          '&': {
            height: '100%',
          },
          '.cm-content': {
            padding: '20px',
            fontSize: '16px',
          },
        }),
      ],
    })

    const view = new EditorView({
      state: startState,
      parent: editorRef.current,
    })

    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [])

  const insertSnippet = (snippetTemplate: string, view: EditorView) => {
    const range = view.state.selection.main
    snippet(snippetTemplate)(view, null, range.from, range.to)
    view.focus()
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">CodeMirror Debug View</h1>

        <div className="mb-4">
          <button
            className="px-4 py-2 bg-warning text-warning-foreground rounded hover:bg-warning/90"
            onClick={() => {
              if (viewRef.current) {
                insertSnippet(
                  '<Callout type="${warning}" title="${}" icon="${}">${}</Callout>',
                  viewRef.current
                )
              }
            }}
          >
            Insert Callout
          </button>
        </div>

        <div className="border border-border rounded-lg overflow-hidden bg-card">
          <div ref={editorRef} className="h-[600px]" />
        </div>
      </div>
    </div>
  )
}
