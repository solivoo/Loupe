import { useCallback, useEffect, useMemo, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { useEventLoopStore } from '../store'
import { createCodeMirrorExtensions } from './codeMirrorExtensions'
import { ExampleSelector } from './ExampleSelector'
import {
  EVENT_LOOP_EXAMPLES,
  type EventLoopExample,
} from '../examples/eventLoopExamples'

/** Si el código del editor coincide con un ejemplo, devuelve su id (para marcarlo en el selector). */
function matchExampleId(code: string): string {
  return EVENT_LOOP_EXAMPLES.find((e) => e.code === code)?.id ?? ''
}

export function CodeEditor() {
  const sourceCode = useEventLoopStore((s) => s.sourceCode)
  const setSourceCode = useEventLoopStore((s) => s.setSourceCode)
  const highlightedLine = useEventLoopStore((s) => s.highlightedLine)
  const [activeExampleId, setActiveExampleId] = useState(() =>
    matchExampleId(sourceCode),
  )

  useEffect(() => {
    setActiveExampleId(matchExampleId(sourceCode))
  }, [sourceCode])

  const extensions = useMemo(
    () => createCodeMirrorExtensions(highlightedLine),
    [highlightedLine],
  )

  const handleLoadExample = useCallback(
    (example: EventLoopExample) => {
      setSourceCode(example.code)
      setActiveExampleId(example.id)
    },
    [setSourceCode],
  )

  const handleSourceChange = useCallback(
    (value: string) => {
      setSourceCode(value)
      setActiveExampleId(matchExampleId(value))
    },
    [setSourceCode],
  )

  return (
    <section className="code-editor-panel">
      <div className="code-editor-panel__head">
        <h2 className="code-editor-panel__title">
          <span aria-hidden>{'</>'}</span> Tu snippet
        </h2>
        {highlightedLine !== null && (
          <span className="code-editor-panel__line-badge">
            Línea {highlightedLine}
          </span>
        )}
      </div>

      <ExampleSelector activeId={activeExampleId} onLoadExample={handleLoadExample} />

      <div className="code-editor-wrap code-editor-wrap--codemirror">
        <CodeMirror
          value={sourceCode}
          height="100%"
          minHeight="120px"
          className="code-editor-cm"
          theme="none"
          extensions={extensions}
          onChange={handleSourceChange}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            closeBrackets: true,
            highlightActiveLine: false,
            autocompletion: true,
          }}
          indentWithTab
          placeholder="// Snippet didáctico (console.log, .then, setTimeout, async/await)…"
          aria-label="Editor de código fuente JavaScript"
        />
      </div>
    </section>
  )
}
