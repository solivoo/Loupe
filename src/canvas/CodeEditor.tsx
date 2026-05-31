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

function ClipboardIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  )
}

export function CodeEditor() {
  const sourceCode = useEventLoopStore((s) => s.sourceCode)
  const setSourceCode = useEventLoopStore((s) => s.setSourceCode)
  const highlightedLine = useEventLoopStore((s) => s.highlightedLine)
  const [copyDone, setCopyDone] = useState(false)
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

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(sourceCode)
      setCopyDone(true)
      window.setTimeout(() => setCopyDone(false), 2000)
    } catch {
      setCopyDone(false)
    }
  }, [sourceCode])

  return (
    <section className="code-editor-panel">
      <div className="code-editor-panel__head">
        <h2 className="code-editor-panel__title">
          <span aria-hidden>{'</>'}</span> Tu snippet
        </h2>
        <div className="code-editor-panel__actions">
          {highlightedLine !== null && (
            <span className="code-editor-panel__line-badge">
              Línea {highlightedLine}
            </span>
          )}
          <button
            type="button"
            className="code-editor-panel__copy"
            onClick={handleCopy}
            title="Copiar código al portapapeles"
            aria-label="Copiar código al portapapeles"
          >
            <ClipboardIcon />
            <span className="code-editor-panel__copy-label">
              {copyDone ? 'Copiado' : 'Copiar'}
            </span>
          </button>
        </div>
      </div>

      <ExampleSelector activeId={activeExampleId} onLoadExample={handleLoadExample} />

      <p className="code-editor-panel__hint">
        Elige un <strong>ejemplo</strong> o arma un <strong>snippet</strong> (console.log, .then, timers, async/await) y usa <strong>Step</strong> para avanzar.
        JS/TS: <code>console.log</code>, <code>Promise</code>, <code>setTimeout</code>, etc.
      </p>

      <div className="code-editor-wrap code-editor-wrap--codemirror">
        <CodeMirror
          value={sourceCode}
          height="100%"
          minHeight="280px"
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
