import { createContext, useContext } from 'react'

export type EdgeBendPatch = { bendX?: number; bendY?: number } | null

export type EdgeBendUpdater = (edgeId: string, patch: EdgeBendPatch) => void

export const EdgeBendContext = createContext<EdgeBendUpdater | null>(null)

export function useEdgeBendUpdate(): EdgeBendUpdater {
  const fn = useContext(EdgeBendContext)
  if (!fn) {
    return () => {}
  }
  return fn
}
