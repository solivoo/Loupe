import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'

const GLOSSARY_ENTRIES = [
  {
    term: 'FIFO',
    full: 'First In, First Out',
    def: 'Colas micro/macro: primero en entrar, primero en salir.',
  },
  {
    term: 'LIFO',
    full: 'Last In, First Out',
    def: 'Call Stack: último en entrar, primero en salir.',
  },
  {
    term: 'Sync',
    full: 'Síncrono',
    def: 'Corre de inmediato en el Call Stack, sin pasar por colas.',
  },
  {
    term: 'Microtarea',
    def: 'Callbacks de .then o tras await. Todas se drenan antes de la siguiente macro.',
  },
  {
    term: 'Macrotarea',
    def: 'Callbacks de setTimeout / setInterval. Una por turno del loop (tras las micros).',
  },
  {
    term: 'Web APIs',
    def: 'Timers del navegador. El delay decide cuándo está listo el callback.',
  },
  {
    term: 'Frame',
    def: 'Entrada en la pila por cada llamada a función; sale con return o await.',
  },
] as const

interface PanelLayout {
  top: number
  right: number
  maxHeight: number
  width: number
}

function computePanelLayout(trigger: HTMLElement): PanelLayout {
  const rect = trigger.getBoundingClientRect()
  const simBar = document.querySelector('.app-sim-bar')
  const anchorBottom = simBar?.getBoundingClientRect().bottom ?? rect.bottom
  const top = anchorBottom + 8
  const right = Math.max(16, window.innerWidth - rect.right)
  const maxHeight = Math.max(120, window.innerHeight - top - 16)
  const width = Math.min(360, window.innerWidth - 32)

  return { top, right, maxHeight, width }
}

export function DidacticGlossary() {
  const [open, setOpen] = useState(false)
  const [layout, setLayout] = useState<PanelLayout | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  const updateLayout = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    setLayout(computePanelLayout(trigger))
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setLayout(null)
      return
    }
    updateLayout()
  }, [open, updateLayout])

  useEffect(() => {
    if (!open) return

    const onResize = () => updateLayout()
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, true)

    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
    }
  }, [open, updateLayout])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
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

  const panel =
    open &&
    layout &&
    createPortal(
      <div
        ref={panelRef}
        id={panelId}
        className="didactic-glossary__panel"
        role="dialog"
        aria-label="Glosario del event loop"
        style={{
          top: layout.top,
          right: layout.right,
          width: layout.width,
          maxHeight: layout.maxHeight,
        }}
      >
        <p className="didactic-glossary__intro">
          Términos clave del diagrama y la simulación.
        </p>
        <dl className="didactic-glossary__list">
          {GLOSSARY_ENTRIES.map((entry) => (
            <div key={entry.term} className="didactic-glossary__item">
              <dt className="didactic-glossary__term">
                {entry.term}
                {'full' in entry && entry.full ? (
                  <span className="didactic-glossary__full"> · {entry.full}</span>
                ) : null}
              </dt>
              <dd className="didactic-glossary__def">{entry.def}</dd>
            </div>
          ))}
        </dl>
      </div>,
      document.body,
    )

  return (
    <div className="didactic-glossary">
      <button
        ref={triggerRef}
        type="button"
        className="didactic-glossary__trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="didactic-glossary__icon" aria-hidden>
          ?
        </span>
        Glosario
      </button>
      {panel}
    </div>
  )
}
