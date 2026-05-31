// Barrel export para el store
export {
  useEventLoopStore,
  nextId,
  resetIdCounter,
} from './eventLoopStore'
export { parseSnippet, loadScenarioIntoStore } from './scenarioLoader'
export type {
  Task,
  TaskType,
  CallStack,
  MicrotaskQueue,
  MacrotaskQueue,
  WebAPIs,
  ConsoleLine,
  EventLoopPhase,
  ExecutionMode,
  InstrumentedStride,
  FlowRegion,
  FlowHint,
  EventLoopState,
  EventLoopActions,
  EventLoopStore,
} from './types'
export type { ParsedScenario } from './types'
