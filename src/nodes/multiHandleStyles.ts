import type { CSSProperties } from 'react'

/** Punto de conexión visible (API `Handle` + posición en % del lado). */
export function handleDot(topOrLeft: string, side: 'top' | 'left' | 'right' | 'bottom'): CSSProperties {
  const base: CSSProperties = {
    width: 9,
    height: 9,
    borderRadius: '50%',
    opacity: 1,
    border: '1px solid rgba(148, 163, 184, 0.55)',
    background: 'rgba(15, 23, 42, 0.95)',
    boxShadow: '0 0 0 1px rgba(0,0,0,0.35)',
  }
  if (side === 'left' || side === 'right') {
    return { ...base, top: topOrLeft }
  }
  return { ...base, left: topOrLeft }
}
