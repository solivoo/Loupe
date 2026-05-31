import { javascript } from '@codemirror/lang-javascript'
import { RangeSetBuilder } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view'
import { oneDark } from '@codemirror/theme-one-dark'
import type { Extension } from '@codemirror/state'

/** Tema oscuro alineado al panel; refuerza la línea en ejecución. */
const executionLineTheme = EditorView.theme(
  {
    '&': { fontSize: '13px' },
    '.cm-executionLine': {
      background: 'rgba(59, 130, 246, 0.14)',
      boxShadow: 'inset 3px 0 0 0 rgba(56, 189, 248, 0.65)',
    },
    '.cm-scroller': { fontFamily: "var(--font-mono, ui-monospace, monospace)" },
  },
  { dark: true },
)

/**
 * Resalta la línea que el simulador marca como actual (1-based, como el parser).
 */
export function executionLineHighlight(line: number | null): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet
      view: EditorView

      constructor(view: EditorView) {
        this.view = view
        this.decorations = this.build()
      }

      update(u: ViewUpdate) {
        if (u.docChanged || u.viewportChanged) this.decorations = this.build()
      }

      build(): DecorationSet {
        const b = new RangeSetBuilder<Decoration>()
        if (line === null || line < 1) return b.finish()
        const doc = this.view.state.doc
        if (line > doc.lines) return b.finish()
        const ln = doc.line(line)
        b.add(ln.from, ln.from, Decoration.line({ class: 'cm-executionLine' }))
        return b.finish()
      }
    },
    { decorations: (v) => v.decorations },
  )
}

export function createCodeMirrorExtensions(highlightedLine: number | null): Extension[] {
  return [
    javascript({ jsx: true, typescript: true }),
    oneDark,
    executionLineTheme,
    executionLineHighlight(highlightedLine),
    EditorView.lineWrapping,
  ]
}
