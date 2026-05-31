import { memo } from 'react'
import { useEventLoopStore } from '../store'
import { TaskChip } from './TaskChip'
import { MacrotaskQueueHandles } from './MultiHandles'
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

function MacrotaskQueueNodeInner() {
  const macrotaskQueue = useEventLoopStore((s) => s.macrotaskQueue)
  const phase = useEventLoopStore((s) => s.phase)

  const isActive =
    phase === 'executing-macrotask' ||
    phase === 'staging-macro' ||
    phase === 'timer-callback-queued'
  const glow = isActive ? PHASE_GLOW[phase] : 'transparent'

  return (
    <div style={glowContainerStyle(glow)}>
      <MacrotaskQueueHandles />

      <div style={headerStyle}>
        <span style={iconStyle}>📬</span>
        <h3 style={titleStyle}>Macrotask Queue</h3>
        <span style={badgeStyle}>FIFO</span>
      </div>

      <p style={{
        fontSize: '11px',
        color: 'rgba(245, 158, 11, 0.7)',
        margin: '0 0 8px',
        lineHeight: 1.3,
      }}>
        setTimeout · setInterval — se toma UNA por ciclo del event loop
      </p>

      <ul style={listStyle}>
        {macrotaskQueue.length === 0 ? (
          <li style={emptyStyle}>Sin macrotareas pendientes</li>
        ) : (
          macrotaskQueue.map((task, i) => (
            <TaskChip key={task.id} task={task} index={i} />
          ))
        )}
      </ul>
    </div>
  )
}

export const MacrotaskQueueNode = memo(MacrotaskQueueNodeInner)
