import { memo } from 'react'
import { useEventLoopStore } from '../store'
import { getWebApiReadyAtSim } from '../store/webApiTimerSimulation'
import { TaskChip } from './TaskChip'
import { WebApisHandles } from './MultiHandles'
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

function WebApisNodeInner() {
  const webApis = useEventLoopStore((s) => s.webApis)
  const simulatedTimeMs = useEventLoopStore((s) => s.simulatedTimeMs)
  const phase = useEventLoopStore((s) => s.phase)
  const glow =
    phase === 'awaiting-web-timers'
      ? PHASE_GLOW[phase]
      : 'transparent'

  return (
    <div style={glowContainerStyle(glow)}>
      <WebApisHandles />

      <div style={headerStyle}>
        <span style={iconStyle}>⏲</span>
        <h3 style={titleStyle}>Web APIs</h3>
        <span style={badgeStyle}>Timers</span>
      </div>


      <ul style={listStyle}>
        {webApis.length === 0 ? (
          <li style={emptyStyle}>Sin temporizadores activos</li>
        ) : (
          webApis.map((task, i) => {
            const remaining =
              task.type === 'webapi'
                ? Math.max(0, getWebApiReadyAtSim(task) - simulatedTimeMs)
                : 0
            return (
              <TaskChip
                key={task.id}
                task={task}
                index={i}
                webApiRemainingSimMs={task.type === 'webapi' ? remaining : undefined}
              />
            )
          })
        )}
      </ul>
    </div>
  )
}

export const WebApisNode = memo(WebApisNodeInner)
