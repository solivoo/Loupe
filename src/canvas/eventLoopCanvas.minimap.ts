import type { Node } from '@xyflow/react'

/** Colores del MiniMap (`nodeColor` / `nodeStrokeColor` en la API). */
const MINIMAP_NODE_COLORS: Record<string, { fill: string; stroke: string }> = {
  callStack: { fill: 'rgba(59, 130, 246, 0.85)', stroke: '#93c5fd' },
  webApis: { fill: 'rgba(16, 185, 129, 0.85)', stroke: '#6ee7b7' },
  microtaskQueue: { fill: 'rgba(168, 85, 247, 0.85)', stroke: '#d8b4fe' },
  macrotaskQueue: { fill: 'rgba(245, 158, 11, 0.85)', stroke: '#fcd34d' },
  console: { fill: 'rgba(6, 182, 212, 0.85)', stroke: '#a5f3fc' },
}

export function getMinimapNodeColors(node: Node): { fill: string; stroke: string } {
  const t = node.type ?? ''
  return MINIMAP_NODE_COLORS[t] ?? { fill: 'rgba(100, 116, 139, 0.8)', stroke: '#94a3b8' }
}
