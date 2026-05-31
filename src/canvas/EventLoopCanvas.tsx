import { useCallback, useEffect, useRef, type RefObject } from 'react'
import {
  addEdge,
  Background,
  ConnectionLineType,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  reconnectEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeTypes,
  type NodeTypes,
} from '@xyflow/react'
import {
  CallStackNode,
  WebApisNode,
  MicrotaskQueueNode,
  MacrotaskQueueNode,
  ConsoleNode,
} from '../nodes'
import {
  EVENT_LOOP_INITIAL_EDGES,
  EVENT_LOOP_INITIAL_NODES,
  type EventLoopStepEdge,
} from './eventLoopCanvas.initial'
import { AdjustableStepEdge } from './AdjustableStepEdge'
import { EdgeBendContext, type EdgeBendUpdater } from './EdgeBendContext'
import { getMinimapNodeColors } from './eventLoopCanvas.minimap'

const nodeTypes: NodeTypes = {
  callStack: CallStackNode,
  webApis: WebApisNode,
  microtaskQueue: MicrotaskQueueNode,
  macrotaskQueue: MacrotaskQueueNode,
  console: ConsoleNode,
}

const edgeTypes = {
  adjustableStep: AdjustableStepEdge,
} as const satisfies EdgeTypes

const FIT_VIEW_OPTS = {
  padding: 0.2,
  minZoom: 0.3,
  maxZoom: 1.4,
  duration: 320,
} as const

/** Centra el grafo en el viewport al montar y al cambiar tamaño del contenedor o la ventana. */
function FitViewController({
  containerRef,
}: {
  containerRef: RefObject<HTMLDivElement | null>
}) {
  const { fitView } = useReactFlow()
  const didMount = useRef(false)

  useEffect(() => {
    const el = containerRef.current
    const schedule = () => {
      requestAnimationFrame(() => {
        fitView({ ...FIT_VIEW_OPTS, duration: didMount.current ? 240 : 0 })
        didMount.current = true
      })
    }

    schedule()

    if (!el) {
      window.addEventListener('resize', schedule)
      return () => window.removeEventListener('resize', schedule)
    }

    let debounce: ReturnType<typeof setTimeout> | undefined
    const debounced = () => {
      if (debounce !== undefined) clearTimeout(debounce)
      debounce = setTimeout(schedule, 64)
    }

    const ro = new ResizeObserver(debounced)
    ro.observe(el)
    window.addEventListener('resize', debounced)

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', debounced)
      if (debounce !== undefined) clearTimeout(debounce)
    }
  }, [containerRef, fitView])

  return null
}

function CanvasInner({
  containerRef,
}: {
  containerRef: RefObject<HTMLDivElement | null>
}) {
  const [nodes, , onNodesChange] = useNodesState(EVENT_LOOP_INITIAL_NODES)
  const [edges, setEdges, onEdgesChange] =
    useEdgesState<EventLoopStepEdge>(EVENT_LOOP_INITIAL_EDGES)

  const onInit = useCallback(() => {}, [])

  const onConnect = useCallback(
    (c: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...c,
            type: 'adjustableStep',
            pathOptions: { offset: 10 },
            style: {
              stroke: '#94a3b8',
              strokeWidth: 2,
              strokeDasharray: '8 6',
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 14,
              height: 14,
              color: '#94a3b8',
            },
            label: 'conexión',
            labelShowBg: true,
            labelBgStyle: { fill: 'rgba(15, 23, 42, 0.92)', fillOpacity: 1 },
            labelBgPadding: [6, 4] as [number, number],
            labelBgBorderRadius: 6,
            labelStyle: { fill: '#cbd5e1', fontSize: 10, fontWeight: 600 },
            selectable: true,
            focusable: true,
            deletable: true,
            reconnectable: true,
          },
          eds,
        ),
      )
    },
    [setEdges],
  )

  const onReconnect = useCallback(
    (oldEdge: EventLoopStepEdge, newConnection: Connection) => {
      setEdges((eds) => reconnectEdge(oldEdge, newConnection, eds))
    },
    [setEdges],
  )

  const isValidConnection = useCallback((c: Connection | Edge) => c.source !== c.target, [])

  const updateEdgeBend = useCallback<EdgeBendUpdater>((edgeId, patch) => {
    setEdges((eds) =>
      eds.map((e) => {
        if (e.id !== edgeId) return e
        if (patch === null) {
          return { ...e, data: {} }
        }
        return {
          ...e,
          data: {
            ...(typeof e.data === 'object' && e.data !== null ? e.data : {}),
            ...patch,
          },
        }
      }),
    )
  }, [setEdges])

  return (
    <EdgeBendContext.Provider value={updateEdgeBend}>
    <ReactFlow
      colorMode="dark"
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onReconnect={onReconnect}
      isValidConnection={isValidConnection}
      nodeTypes={nodeTypes}
      onInit={onInit}
      edgeTypes={edgeTypes}
      connectionLineType={ConnectionLineType.Step}
      connectionLineStyle={{
        strokeDasharray: '12 7',
        strokeWidth: 2,
        opacity: 0.85,
      }}
      elementsSelectable
      nodesDraggable
      nodesConnectable
      connectOnClick={false}
      edgesReconnectable
      edgesFocusable
      selectNodesOnDrag={false}
      deleteKeyCode={['Delete', 'Backspace']}
      snapToGrid
      snapGrid={[24, 24]}
      nodeExtent={[
        [-120, -120],
        [1320, 960],
      ]}
      translateExtent={[
        [-480, -480],
        [2000, 1400],
      ]}
      panOnScroll
      zoomOnScroll
      zoomOnPinch
      zoomOnDoubleClick={false}
      minZoom={0.28}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
      style={{ background: 'transparent' }}
      defaultEdgeOptions={{
        type: 'adjustableStep',
        interactionWidth: 26,
        selectable: true,
        focusable: true,
        deletable: true,
        reconnectable: true,
      }}
      elevateEdgesOnSelect={false}
    >
      <FitViewController containerRef={containerRef} />
      <Background gap={24} size={1} color="rgba(120, 140, 200, 0.1)" />
      <MiniMap
        ariaLabel="Mapa del diagrama del Event Loop"
        position="bottom-right"
        pannable
        zoomable
        zoomStep={12}
        offsetScale={6}
        bgColor="rgba(15, 23, 42, 0.92)"
        maskColor="rgba(2, 6, 23, 0.45)"
        maskStrokeColor="rgba(148, 163, 184, 0.45)"
        maskStrokeWidth={1}
        nodeBorderRadius={6}
        nodeStrokeWidth={1.5}
        nodeColor={(n) => getMinimapNodeColors(n).fill}
        nodeStrokeColor={(n) => getMinimapNodeColors(n).stroke}
        style={{
          borderRadius: 10,
          border: '1px solid rgba(148, 163, 184, 0.2)',
          margin: 10,
        }}
      />
      <Controls
        showInteractive={false}
        style={{
          background: 'rgba(15, 23, 42, 0.85)',
          borderRadius: '10px',
          border: '1px solid rgba(148, 163, 184, 0.18)',
        }}
      />
    </ReactFlow>
    </EdgeBendContext.Provider>
  )
}

export function EventLoopCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={containerRef}
      className="event-loop-canvas-root"
      style={{ width: '100%', height: '100%', minHeight: 0, flex: 1 }}
    >
      <ReactFlowProvider>
        <CanvasInner containerRef={containerRef} />
      </ReactFlowProvider>
    </div>
  )
}
