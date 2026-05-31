import { memo } from 'react'
import { useEventLoopStore } from '../store'
import { TaskChip } from './TaskChip'
import { CallStackHandles } from './MultiHandles'
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

function CallStackNodeInner() {
  const callStack = useEventLoopStore((s) => s.callStack)
  const phase = useEventLoopStore((s) => s.phase)

  const isActive =
    phase === 'executing-sync' ||
    phase === 'executing-macrotask' ||
    phase === 'draining-microtasks' ||
    phase === 'staging-micro' ||
    phase === 'staging-macro'
  const glow = isActive ? PHASE_GLOW[phase] : 'transparent'

  return (
    <div style={glowContainerStyle(glow)}>
      <CallStackHandles />

      <div style={headerStyle}>
        <span style={iconStyle}>⎔</span>
        <h3 style={titleStyle}>Call Stack</h3>
        <span style={badgeStyle}>LIFO</span>
      </div>

      <ul style={listStyle}>
        {callStack.length === 0 ? (
          <li style={emptyStyle}>Vacío — hilo principal libre</li>
        ) : (
          // Mostrar en orden inverso (tope arriba)
          [...callStack].reverse().map((task, i) => (
            <TaskChip key={task.id} task={task} index={callStack.length - 1 - i} />
          ))
        )}
      </ul>
    </div>
  )
}

export const CallStackNode = memo(CallStackNodeInner)
