import type { CSSProperties } from 'react'
import type { Task, EventLoopPhase } from '../store/types'

// ─── Colores por tipo de tarea ───────────────────────────

const TASK_COLORS: Record<Task['type'], { bg: string; border: string; text: string }> = {
  sync:      { bg: '#1e3a5f', border: '#3b82f6', text: '#93c5fd' },
  microtask: { bg: '#3b1f5e', border: '#a855f7', text: '#d8b4fe' },
  macrotask: { bg: '#4a2c17', border: '#f59e0b', text: '#fcd34d' },
  webapi:    { bg: '#1a3a2a', border: '#10b981', text: '#6ee7b7' },
}

// ─── Colores por fase del event loop ─────────────────────

export const PHASE_GLOW: Record<EventLoopPhase, string> = {
  'idle':                'transparent',
  'executing-sync':      'rgba(59, 130, 246, 0.25)',
  'staging-micro':       'rgba(168, 85, 247, 0.22)',
  'draining-microtasks': 'rgba(168, 85, 247, 0.3)',
  'staging-macro':         'rgba(245, 158, 11, 0.22)',
  'awaiting-web-timers': 'rgba(16, 185, 129, 0.28)',
  'timer-callback-queued': 'rgba(245, 158, 11, 0.3)',
  'executing-macrotask': 'rgba(245, 158, 11, 0.25)',
  'finished':            'rgba(16, 185, 129, 0.2)',
}

// ─── Estilos compartidos ─────────────────────────────────

export const nodeContainerStyle: CSSProperties = {
  background: 'rgba(15, 23, 42, 0.85)',
  backdropFilter: 'blur(12px)',
  borderRadius: '16px',
  border: '1px solid rgba(148, 163, 184, 0.15)',
  padding: '16px',
  minWidth: '280px',
  fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
  color: '#e2e8f0',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
}

export const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  marginBottom: '12px',
  paddingBottom: '10px',
  borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
}

export const titleStyle: CSSProperties = {
  fontSize: '15px',
  fontWeight: 700,
  letterSpacing: '0.02em',
  margin: 0,
}

export const iconStyle: CSSProperties = {
  fontSize: '20px',
  lineHeight: 1,
}

export const emptyStyle: CSSProperties = {
  color: 'rgba(148, 163, 184, 0.5)',
  fontStyle: 'italic',
  fontSize: '13px',
  textAlign: 'center',
  padding: '12px 0',
}

export const chipStyle = (type: Task['type']): CSSProperties => {
  const c = TASK_COLORS[type]
  return {
    background: c.bg,
    border: `1px solid ${c.border}`,
    color: c.text,
    borderRadius: '8px',
    padding: '6px 12px',
    fontSize: '13px',
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    animation: 'chipEnter 0.35s ease-out',
  }
}

export const listStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  listStyle: 'none',
  padding: 0,
  margin: 0,
  minHeight: '40px',
}

/** Glow container cuando la fase coincide con la región. */
export const glowContainerStyle = (glowColor: string): CSSProperties => ({
  ...nodeContainerStyle,
  boxShadow: glowColor !== 'transparent'
    ? `0 0 24px ${glowColor}, 0 8px 32px rgba(0, 0, 0, 0.25)`
    : '0 8px 32px rgba(0, 0, 0, 0.25)',
  transition: 'box-shadow 0.4s ease',
})

export const badgeStyle: CSSProperties = {
  background: 'rgba(148, 163, 184, 0.15)',
  borderRadius: '10px',
  padding: '2px 8px',
  fontSize: '11px',
  fontWeight: 600,
  color: 'rgba(148, 163, 184, 0.7)',
  marginLeft: 'auto',
}
