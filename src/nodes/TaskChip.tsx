import { memo } from 'react'
import type { CSSProperties } from 'react'
import type { Task } from '../store/types'
import { formatDidacticTimerDelay } from '../store/webApiTimerSimulation'
import { chipStyle } from './nodeStyles'

interface TaskChipProps {
  task: Task
  /** Índice visual (para labels como "#1", "#2"). */
  index?: number
  /** Texto bajo la fila (p. ej. paso intermedio didáctico). */
  stagingCaption?: string
  /** Ms simulados que faltan para ir a la cola macro (solo timers en Web APIs). */
  webApiRemainingSimMs?: number
}

/** Chip visual que representa una tarea individual en cualquier cola/stack. */
function TaskChipInner({
  task,
  index,
  stagingCaption,
  webApiRemainingSimMs,
}: TaskChipProps) {
  const base = chipStyle(task.type)
  const rowStyle: CSSProperties = stagingCaption
    ? {
        ...base,
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: '6px',
        borderStyle: 'dashed',
        opacity: 0.95,
      }
    : base

  return (
    <li style={rowStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
        {index !== undefined && (
          <span style={{
            opacity: 0.5,
            fontSize: '11px',
            fontWeight: 600,
            minWidth: '18px',
          }}>
            #{index + 1}
          </span>
        )}
        <code style={{ fontSize: '12px', flex: 1 }}>{task.label}</code>
        {task.syncKind === 'functionFrame' && (
          <span
            style={{
              fontSize: '10px',
              opacity: 0.85,
              background: 'rgba(59, 130, 246, 0.2)',
              borderRadius: '4px',
              padding: '1px 6px',
              whiteSpace: 'nowrap',
            }}
            title="Frame de función — sale de la pila en return o await"
          >
            frame
          </span>
        )}
        {task.delayMs !== undefined && (
          <span style={{
            fontSize: '11px',
            opacity: 0.6,
            background: 'rgba(255,255,255,0.06)',
            borderRadius: '4px',
            padding: '1px 6px',
          }}
            title={
              task.type === 'webapi'
                ? 'Delay en tu código → tiempo simulado en Web APIs (escala didáctica para ver la transición).'
                : undefined
            }
          >
            {task.type === 'webapi'
              ? formatDidacticTimerDelay(task.delayMs)
              : `${task.delayMs}ms`}
          </span>
        )}
      </div>
      {stagingCaption !== undefined && stagingCaption.length > 0 && (
        <span style={{
          fontSize: '10px',
          opacity: 0.75,
          fontStyle: 'italic',
        }}>
          {stagingCaption}
        </span>
      )}
      {task.type === 'webapi' && webApiRemainingSimMs !== undefined && (
        <span style={{
          fontSize: '10px',
          opacity: 0.8,
          color: 'rgba(110, 231, 183, 0.95)',
          lineHeight: 1.35,
        }}>
          {webApiRemainingSimMs > 0
            ? `→ cola macro en ~${Math.ceil(webApiRemainingSimMs)} ms sim (paralelo al sync)`
            : 'Listo — entra en macrotareas automáticamente'}
        </span>
      )}
    </li>
  )
}

export const TaskChip = memo(TaskChipInner)
