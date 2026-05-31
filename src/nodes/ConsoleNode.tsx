import { memo } from 'react'
import { useEventLoopStore } from '../store'
import { ConsoleHandles } from './MultiHandles'
import {
  glowContainerStyle,
  headerStyle,
  titleStyle,
  iconStyle,
  emptyStyle,
  badgeStyle,
} from './nodeStyles'

function ConsoleNodeInner() {
  const consoleLogs = useEventLoopStore((s) => s.consoleLogs)

  return (
    <div style={glowContainerStyle('transparent')}>
      <ConsoleHandles />

      <div style={headerStyle}>
        <span style={iconStyle}>▸</span>
        <h3 style={titleStyle}>Console</h3>
        <span style={badgeStyle}>{consoleLogs.length} líneas</span>
      </div>

      <div style={{
        background: 'rgba(0, 0, 0, 0.4)',
        borderRadius: '8px',
        padding: '10px 12px',
        minHeight: '60px',
        maxHeight: '200px',
        overflowY: 'auto',
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontSize: '13px',
      }}>
        {consoleLogs.length === 0 ? (
          <div style={emptyStyle}>Aún sin salida</div>
        ) : (
          <ol style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}>
            {consoleLogs.map((line, i) => (
              <li
                key={line.id}
                style={{
                  color: '#a5f3fc',
                  display: 'flex',
                  gap: '8px',
                  animation: 'chipEnter 0.3s ease-out',
                }}
              >
                <span style={{
                  color: 'rgba(148, 163, 184, 0.4)',
                  fontSize: '11px',
                  minWidth: '14px',
                  userSelect: 'none',
                }}>
                  {i + 1}
                </span>
                <span>{line.text}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}

export const ConsoleNode = memo(ConsoleNodeInner)
