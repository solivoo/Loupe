import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useEventLoopStore } from '../store'
import {
  EVENT_LOOP_EXAMPLES,
  getExampleById,
  type EventLoopExample,
} from '../examples/eventLoopExamples'

interface ExampleSelectorProps {
  readonly activeId: string
  readonly onLoadExample: (example: EventLoopExample) => void
}

export function ExampleSelector({ activeId, onLoadExample }: ExampleSelectorProps) {
  const reset = useEventLoopStore((s) => s.reset)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  const active = getExampleById(activeId)
  const triggerLabel = active?.title ?? 'Elige un ejemplo…'

  const pickExample = useCallback(
    (example: EventLoopExample) => {
      reset()
      onLoadExample(example)
      setOpen(false)
    },
    [reset, onLoadExample],
  )

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="example-selector" ref={rootRef}>
      <span className="example-selector__label" id={`${listId}-label`}>
        Ejemplos
      </span>

      <div className="example-selector__dropdown">
        <button
          type="button"
          className="example-selector__trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-labelledby={`${listId}-label ${listId}-trigger`}
          id={`${listId}-trigger`}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="example-selector__trigger-text">{triggerLabel}</span>
          <span className="example-selector__chevron" aria-hidden>
            {open ? '▴' : '▾'}
          </span>
        </button>

        {open && (
          <ul
            className="example-selector__menu"
            role="listbox"
            id={listId}
            aria-labelledby={`${listId}-label`}
          >
            {EVENT_LOOP_EXAMPLES.map((example) => {
              const selected = example.id === activeId
              return (
                <li key={example.id} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`example-selector__option${selected ? ' is-selected' : ''}`}
                    onClick={() => pickExample(example)}
                  >
                    {example.title}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {active && <p className="example-selector__concept">{active.concept}</p>}
    </div>
  )
}
