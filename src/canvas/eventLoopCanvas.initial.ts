import { MarkerType, type Edge, type Node } from '@xyflow/react'

const dash = { strokeDasharray: '12 7' as const }

const LABEL_DEFAULTS = {
  labelShowBg: true,
  labelBgStyle: { fill: 'rgba(15, 23, 42, 0.92)', fillOpacity: 1 },
  labelBgPadding: [6, 4] as [number, number],
  labelBgBorderRadius: 6,
} as const

const edgeDefaults = {
  type: 'adjustableStep' as const,
  pathOptions: { offset: 10 },
  selectable: true,
  focusable: true,
  deletable: true,
  animated: false,
  reconnectable: true,
}

function marker(color: string) {
  return {
    type: MarkerType.ArrowClosed,
    width: 15,
    height: 15,
    color,
  }
}

export type EventLoopStepEdge = Edge & {
  type: 'adjustableStep'
  pathOptions?: { offset?: number }
  data?: { bendX?: number; bendY?: number }
}

/** Layout por defecto (ordenación guardada). */
export const EVENT_LOOP_INITIAL_NODES: Node[] = [
  { id: 'callStack', type: 'callStack', position: { x: 936, y: 408 }, data: {}, draggable: true, selectable: true, connectable: true, deletable: false },
  { id: 'webApis', type: 'webApis', position: { x: 864, y: 192 }, data: {}, draggable: true, selectable: true, connectable: true, deletable: false },
  { id: 'microtaskQueue', type: 'microtaskQueue', position: { x: 336, y: 432 }, data: {}, draggable: true, selectable: true, connectable: true, deletable: false },
  { id: 'macrotaskQueue', type: 'macrotaskQueue', position: { x: 336, y: 192 }, data: {}, draggable: true, selectable: true, connectable: true, deletable: false },
  { id: 'console', type: 'console', position: { x: 624, y: 624 }, data: {}, draggable: true, selectable: true, connectable: true, deletable: false },
]

export const EVENT_LOOP_INITIAL_EDGES: EventLoopStepEdge[] = [
  {
    ...edgeDefaults,
    id: 'xy-edge__webApisr1-macrotaskQueuet3',
    source: 'webApis',
    target: 'macrotaskQueue',
    sourceHandle: 'r1',
    targetHandle: 't3',
    pathOptions: { offset: 10 },
    style: { stroke: '#f59e0b', strokeWidth: 2, ...dash },
    markerEnd: marker('#f59e0b'),
    label: 'timer listo',
    ...LABEL_DEFAULTS,
    labelStyle: { fill: '#fcd34d', fontSize: 11, fontWeight: 600 },
  },
  {
    ...edgeDefaults,
    id: 'xy-edge__callStackls-microtaskQueueri',
    source: 'callStack',
    target: 'microtaskQueue',
    sourceHandle: 'ls',
    targetHandle: 'ri',
    pathOptions: { offset: 10 },
    style: { stroke: '#a855f7', strokeWidth: 2, ...dash },
    markerEnd: marker('#a855f7'),
    label: '.then()',
    ...LABEL_DEFAULTS,
    labelStyle: { fill: '#d8b4fe', fontSize: 11, fontWeight: 600 },
  },
  {
    ...edgeDefaults,
    id: 'xy-edge__microtaskQueuerc-callStacklc',
    source: 'microtaskQueue',
    target: 'callStack',
    sourceHandle: 'rc',
    targetHandle: 'lc',
    pathOptions: { offset: 10 },
    style: { stroke: '#a855f7', strokeWidth: 2, ...dash },
    markerEnd: marker('#a855f7'),
    label: 'ejecutar micro',
    ...LABEL_DEFAULTS,
    labelStyle: { fill: '#d8b4fe', fontSize: 11, fontWeight: 600 },
  },
  {
    ...edgeDefaults,
    id: 'xy-edge__macrotaskQueuerc-callStackla',
    source: 'macrotaskQueue',
    target: 'callStack',
    sourceHandle: 'rc',
    targetHandle: 'la',
    pathOptions: { offset: 10 },
    style: { stroke: '#f59e0b', strokeWidth: 2, ...dash },
    markerEnd: marker('#f59e0b'),
    label: 'ejecutar macro',
    ...LABEL_DEFAULTS,
    labelStyle: { fill: '#fcd34d', fontSize: 11, fontWeight: 600 },
  },
  {
    ...edgeDefaults,
    id: 'xy-edge__callStackba-consoleta',
    source: 'callStack',
    target: 'console',
    sourceHandle: 'ba',
    targetHandle: 'ta',
    pathOptions: { offset: 10 },
    data: { bendX: 1056, bendY: 600 },
    style: { stroke: '#06b6d4', strokeWidth: 2, ...dash },
    markerEnd: marker('#06b6d4'),
    label: 'console.log()',
    ...LABEL_DEFAULTS,
    labelStyle: { fill: '#a5f3fc', fontSize: 11, fontWeight: 600 },
  },
  {
    ...edgeDefaults,
    id: 'xy-edge__callStackra-webApislc',
    source: 'callStack',
    target: 'webApis',
    sourceHandle: 'ra',
    targetHandle: 'lc',
    pathOptions: { offset: 10 },
    style: { stroke: '#10b981', strokeWidth: 2, ...dash },
    markerEnd: marker('#10b981'),
    label: 'setTimeout()',
    ...LABEL_DEFAULTS,
    labelStyle: { fill: '#6ee7b7', fontSize: 11, fontWeight: 600 },
  },
]
