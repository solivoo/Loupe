import { memo, useCallback, useMemo } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  Position,
  useReactFlow,
  type Edge,
  type EdgeMarkerType,
  type EdgeProps,
} from '@xyflow/react'
import { useEventLoopStore } from '../store'
import { useEdgeBendUpdate } from './EdgeBendContext'

/** IDs de aristas alineados con `eventLoopCanvas.initial.ts` y regiones del simulador. */
const FLOW_HINT_TO_EDGE: Record<string, string> = {
  'stack->webapis': 'xy-edge__callStackra-webApislc',
  'stack->console': 'xy-edge__callStackba-consoleta',
  'stack->microtask': 'xy-edge__callStackls-microtaskQueueri',
  'webapis->macrotask': 'xy-edge__webApisr1-macrotaskQueuet3',
  'microtask->stack': 'xy-edge__microtaskQueuerc-callStacklc',
  'macrotask->stack': 'xy-edge__macrotaskQueuerc-callStackla',
}

function emphasizeMarker(marker: EdgeMarkerType | undefined, active: boolean): EdgeMarkerType | undefined {
  if (!marker) return marker
  if (typeof marker === 'string') return marker
  if (typeof marker !== 'object' || !('type' in marker)) return marker
  const w = active ? 18 : 15
  return { ...marker, width: w, height: w }
}

function useSimulatorEdgeHighlight(edgeId: string): { isActive: boolean; dimOthers: boolean } {
  const flowHint = useEventLoopStore((s) => s.flowHint)
  return useMemo(() => {
    if (!flowHint) return { isActive: false, dimOthers: false }
    const key = `${flowHint.from}->${flowHint.to}`
    const activeId = FLOW_HINT_TO_EDGE[key] ?? null
    if (!activeId) return { isActive: false, dimOthers: false }
    return { isActive: activeId === edgeId, dimOthers: true }
  }, [flowHint, edgeId])
}

export type AdjustableStepEdgeData = {
  bendX?: number
  bendY?: number
}

type AdjustableEdge = Edge<AdjustableStepEdgeData, 'adjustableStep'>

/** Arista ortogonal (borderRadius 0) con punto de control arrastrable en ambos ejes vía `getSmoothStepPath` (`centerX` / `centerY`). */
function AdjustableStepEdgeInner(props: EdgeProps<AdjustableEdge>) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition = Position.Bottom,
    targetPosition = Position.Top,
    style,
    markerStart,
    interactionWidth,
    pathOptions,
    data,
    label,
    labelStyle,
    labelShowBg,
    labelBgStyle,
    labelBgPadding,
    labelBgBorderRadius,
    markerEnd: markerEndProp,
    selected = false,
  } = props

  const { isActive: simActive, dimOthers: simDim } = useSimulatorEdgeHighlight(id)

  const { screenToFlowPosition } = useReactFlow()
  const updateBend = useEdgeBendUpdate()

  const clearBend = useCallback(() => {
    updateBend(id, null)
  }, [id, updateBend])

  const po = pathOptions as { offset?: number } | undefined
  const bendX = data?.bendX
  const bendY = data?.bendY

  const [path, labelX, labelY] = useMemo(() => {
    const base = {
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 0,
      offset: po?.offset ?? 8,
      stepPosition: 0.5,
    }
    if (bendX !== undefined && bendY !== undefined) {
      return getSmoothStepPath({ ...base, centerX: bendX, centerY: bendY })
    }
    return getSmoothStepPath(base)
  }, [
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    po?.offset,
    bendX,
    bendY,
  ])

  const mergedStyle = useMemo(() => {
    const baseDash = style?.strokeDasharray
    return {
      ...style,
      strokeWidth: simActive ? 3.25 : (style?.strokeWidth ?? 2),
      strokeDasharray: simActive ? undefined : baseDash,
      opacity: simDim ? (simActive ? 1 : 0.42) : 0.9,
      transition: 'opacity 0.28s ease, stroke-width 0.28s ease',
    }
  }, [style, simActive, simDim])

  const mergedMarkerEnd = useMemo(
    () => emphasizeMarker(markerEndProp as EdgeMarkerType | undefined, simActive),
    [markerEndProp, simActive],
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation()
      e.preventDefault()
      const move = (ev: PointerEvent) => {
        ev.preventDefault()
        const p = screenToFlowPosition({ x: ev.clientX, y: ev.clientY })
        updateBend(id, { bendX: p.x, bendY: p.y })
      }
      const up = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        window.removeEventListener('pointercancel', up)
      }
      window.addEventListener('pointermove', move, { passive: false })
      window.addEventListener('pointerup', up)
      window.addEventListener('pointercancel', up)
    },
    [id, screenToFlowPosition, updateBend],
  )

  const onDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      clearBend()
    },
    [clearBend],
  )

  const labelPad = labelBgPadding ?? [6, 4]
  const labelPadX = labelPad[0] ?? 6
  const labelPadY = labelPad[1] ?? 4

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={mergedStyle}
        markerEnd={mergedMarkerEnd as typeof markerEndProp}
        markerStart={markerStart}
        interactionWidth={interactionWidth}
      />
      <EdgeLabelRenderer>
        {label != null && label !== '' && (
          <div
            className="edge-flow-label nodrag nopan"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'none',
              padding: `${labelPadY}px ${labelPadX}px`,
              borderRadius: labelBgBorderRadius ?? 6,
              background: labelShowBg
                ? (labelBgStyle?.fill as string | undefined) ?? 'rgba(15, 23, 42, 0.92)'
                : undefined,
              fontSize: (labelStyle?.fontSize as number | undefined) ?? 11,
              fontWeight: (labelStyle?.fontWeight as number | undefined) ?? 600,
              color: (labelStyle?.fill as string | undefined) ?? '#cbd5e1',
              whiteSpace: 'nowrap',
              lineHeight: 1.25,
              zIndex: 5,
            }}
          >
            {label}
          </div>
        )}
        {selected && (
          <div
            role="button"
            tabIndex={0}
            title="Arrastra para abrir el trazado · doble clic restablece"
            className="edge-bend-handle nodrag nopan"
            onPointerDown={onPointerDown}
            onDoubleClick={onDoubleClick}
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY + 22}px)`,
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: 'rgba(56, 189, 248, 0.95)',
              border: '1px solid rgba(125, 211, 252, 0.9)',
              boxShadow: '0 0 0 2px rgba(15, 23, 42, 0.5)',
              cursor: 'grab',
              pointerEvents: 'all',
              zIndex: 6,
              touchAction: 'none',
            }}
          />
        )}
      </EdgeLabelRenderer>
    </>
  )
}

export const AdjustableStepEdge = memo(AdjustableStepEdgeInner)
