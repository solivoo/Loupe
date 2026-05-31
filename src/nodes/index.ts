/**
 * Fase 3 — Nodos Personalizados para React Flow
 *
 * Cada nodo representa una región del Event Loop.
 * Lee directamente del store Zustand (sin props de snapshot).
 * La UI es 100% reactiva al estado.
 */

export { CallStackNode } from './CallStackNode'
export { WebApisNode } from './WebApisNode'
export { MicrotaskQueueNode } from './MicrotaskQueueNode'
export { MacrotaskQueueNode } from './MacrotaskQueueNode'
export { ConsoleNode } from './ConsoleNode'
export { TaskChip } from './TaskChip'
