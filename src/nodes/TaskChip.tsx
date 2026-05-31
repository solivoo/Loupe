import { memo } from 'react'
import type { CSSProperties } from 'react'
import type { Task } from '../store/types'
import { formatDidacticTimerDelay, effectiveWebApiDelayMs, estimatedRealSecondsRemaining } from '../store/webApiTimerSimulation'
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
  const isWebApiTimer =
    task.type === 'webapi' && webApiRemainingSimMs !== undefined
  const totalSimMs =
    isWebApiTimer && task.delayMs !== undefined
      ? effectiveWebApiDelayMs(task.delayMs)
      : 0
  const remainingSimMs = webApiRemainingSimMs ?? 0
  const timerProgress =
    isWebApiTimer && totalSimMs > 0
      ? Math.min(1, Math.max(0, (totalSimMs - remainingSimMs) / totalSimMs))
      : 0
  const timerReady = isWebApiTimer && remainingSimMs <= 0

  const rowStyle: CSSProperties =
    isWebApiTimer || stagingCaption
      ? {
          ...base,
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: '6px',
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          overflow: 'hidden',
          borderStyle: stagingCaption ? 'dashed' : base.borderStyle,
          opacity: stagingCaption ? 0.95 : base.opacity,
        }
      : base

  return (
    <li style={rowStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', minWidth: 0 }}>
        {index !== undefined && (
          <span style={{
            opacity: 0.5,
            fontSize: '11px',
            fontWeight: 600,
            minWidth: '18px',
            flexShrink: 0,
          }}>
            #{index + 1}
          </span>
        )}
        <code
          style={{
            fontSize: '12px',
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={
            isWebApiTimer && task.delayMs !== undefined
              ? `${task.label} · ${formatDidacticTimerDelay(task.delayMs)}`
              : task.label
          }
        >
          {task.label}
        </code>
        {task.syncKind === 'functionFrame' && (
          <span
            style={{
              fontSize: '10px',
              opacity: 0.85,
              background: 'rgba(59, 130, 246, 0.2)',
              borderRadius: '4px',
              padding: '1px 6px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
            title="Frame de función — sale de la pila en return o await"
          >
            frame
          </span>
        )}
        {task.delayMs !== undefined && !isWebApiTimer && (
          <span style={{
            fontSize: '11px',
            opacity: 0.6,
            background: 'rgba(255,255,255,0.06)',
            borderRadius: '4px',
            padding: '1px 6px',
            flexShrink: 0,
          }}>
            {`${task.delayMs}ms`}
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
      {isWebApiTimer && (
        <>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(timerProgress * 100)}
            aria-label={
              timerReady
                ? 'Timer listo para macrotareas'
                : `Timer en curso, ${Math.round(timerProgress * 100)}% transcurrido`
            }
            style={{
              height: 5,
              borderRadius: 999,
              background: 'rgba(0, 0, 0, 0.28)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${timerProgress * 100}%`,
                borderRadius: 999,
                background: timerReady
                  ? 'linear-gradient(90deg, #34d399, #6ee7b7)'
                  : 'linear-gradient(90deg, #059669, #10b981)',
                transition: 'width 0.12s linear',
              }}
            />
          </div>
          <span style={{
            fontSize: '10px',
            opacity: 0.85,
            color: 'rgba(110, 231, 183, 0.95)',
            lineHeight: 1.35,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {timerReady
              ? 'Listo → macrotareas'
              : `~${Math.ceil(estimatedRealSecondsRemaining(remainingSimMs))} s · ${Math.ceil(remainingSimMs)} ms sim`}
          </span>
        </>
      )}
    </li>
  )
}

export const TaskChip = memo(TaskChipInner)
