import { memo } from 'react'
import { useEventLoopStore } from '../store'
import { TaskChip } from './TaskChip'
import { MicrotaskQueueHandles } from './MultiHandles'
import {
  glowContainerStyle,
  headerStyle,
  titleStyle,
  iconStyle,
  listStyle,
  emptyStyle,
  badgeStyle,
  PHASE_GLOW,
} from './nodeStyles'

function MicrotaskQueueNodeInner() {
  const microtaskQueue = useEventLoopStore((s) => s.microtaskQueue)
  const didacticPromiseBindings = useEventLoopStore((s) => s.didacticPromiseBindings)
  const phase = useEventLoopStore((s) => s.phase)

  const isActive = phase === 'draining-microtasks' || phase === 'staging-micro'
  const glow = isActive ? PHASE_GLOW[phase] : 'transparent'

  return (
    <div style={glowContainerStyle(glow)}>
      <MicrotaskQueueHandles />

      <div style={headerStyle}>
        <span style={iconStyle}>⚡</span>
        <h3 style={titleStyle}>Microtask Queue</h3>
        <span style={badgeStyle}>FIFO</span>
      </div>

      <p style={{
        fontSize: '11px',
        color: 'rgba(168, 85, 247, 0.7)',
        margin: '0 0 8px',
        lineHeight: 1.3,
      }}>
        Promise.then · queueMicrotask — se drenan TODAS antes de la siguiente macrotarea
      </p>

      {didacticPromiseBindings.length > 0 ? (
        <div
          style={{
            marginBottom: 10,
            padding: '8px 10px',
            borderRadius: 8,
            background: 'rgba(168, 85, 247, 0.08)',
            border: '1px solid rgba(168, 85, 247, 0.25)',
          }}
        >
          <p
            style={{
              fontSize: '10px',
              color: 'rgba(226, 232, 240, 0.85)',
              margin: '0 0 6px',
              lineHeight: 1.35,
            }}
          >
            Promesas ya cumplidas (referencia, no entran en la FIFO hasta{' '}
            <code style={{ fontSize: '10px' }}>await</code> /{' '}
            <code style={{ fontSize: '10px' }}>.then</code>):
          </p>
          <ul style={{ ...listStyle, margin: 0 }}>
            {didacticPromiseBindings.map((b) => (
              <li
                key={b.id}
                style={{
                  fontSize: '11px',
                  fontFamily: 'ui-monospace, monospace',
                  color: 'rgba(196, 181, 253, 0.95)',
                  listStyle: 'none',
                }}
              >
                {b.bindingName} ← Promise.resolve()
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ul style={listStyle}>
        {microtaskQueue.length === 0 ? (
          <li style={emptyStyle}>Sin microtareas pendientes (cola FIFO)</li>
        ) : (
          microtaskQueue.map((task, i) => (
            <TaskChip key={task.id} task={task} index={i} />
          ))
        )}
      </ul>
    </div>
  )
}

export const MicrotaskQueueNode = memo(MicrotaskQueueNodeInner)
