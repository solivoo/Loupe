import { create } from 'zustand'
import type {
  EventLoopStore,
  Task,
  FlowHint,
  ConsoleLine,
} from './types'
import {
  abortInstrumentedSession,
} from './instrumentedBridge'
import { getDefaultExample } from '../examples/eventLoopExamples'
import {
  clearDidacticStepLockTimer,
  promoteWebApiTimerToMacro,
} from './eventLoopStoreInternals'
import { runDidacticSimulateStep } from './simulateDidacticStep'

// ─── Helpers ─────────────────────────────────────────────

let _seqId = 0
/** Genera un ID único incremental para tareas y líneas de consola. */
export const nextId = (): string => `t-${++_seqId}`

/** Resetea el contador de IDs (útil para tests). */
export const resetIdCounter = (): void => { _seqId = 0 }

// ─── Estado inicial ──────────────────────────────────────

const initialState = (): Pick<
  EventLoopStore,
  | 'callStack' | 'microtaskQueue' | 'macrotaskQueue'
  | 'webApis' | 'consoleLogs' | 'didacticPromiseBindings' | 'phase' | 'currentStep' | 'simulatedTimeMs'
  | 'stagedDispatch' | 'pendingScriptQueue'
  | 'flowHint' | 'isRunning' | 'sourceCode' | 'highlightedLine'
  | 'executionMode' | 'simCaption' | 'instrumentedError' | 'instrumentedStride'
  | 'stepInputLocked'
> => ({
  callStack: [],
  microtaskQueue: [],
  macrotaskQueue: [],
  webApis: [],
  consoleLogs: [],
  didacticPromiseBindings: [],
  stagedDispatch: null,
  pendingScriptQueue: [],
  phase: 'idle',
  currentStep: 0,
  simulatedTimeMs: 0,
  flowHint: null,
  isRunning: false,
  stepInputLocked: false,
  sourceCode: getDefaultExample().code,
  highlightedLine: null,
  executionMode: 'didactic',
  simCaption: null,
  instrumentedError: null,
  instrumentedStride: 'step',
})

// ─── Store ───────────────────────────────────────────────

export const useEventLoopStore = create<EventLoopStore>((set, get) => ({
  ...initialState(),

  pushToCallStack: (task: Task) =>
    set((s) => ({
      callStack: [...s.callStack, task],
      highlightedLine: task.line ?? s.highlightedLine,
    })),

  popFromCallStack: () => {
    const { callStack } = get()
    if (callStack.length === 0) return undefined
    const popped = callStack.at(-1)
    set({ callStack: callStack.slice(0, -1) })
    return popped
  },

  enqueueMicrotask: (task: Task) =>
    set((s) => ({
      microtaskQueue: [...s.microtaskQueue, { ...task, type: 'microtask' }],
    })),

  dequeueMicrotask: () => {
    const { microtaskQueue } = get()
    if (microtaskQueue.length === 0) return undefined
    const [first, ...rest] = microtaskQueue
    set({ microtaskQueue: rest })
    return first
  },

  enqueueMacrotask: (task: Task) =>
    set((s) => ({
      macrotaskQueue: [...s.macrotaskQueue, { ...task, type: 'macrotask' }],
    })),

  dequeueMacrotask: () => {
    const { macrotaskQueue } = get()
    if (macrotaskQueue.length === 0) return undefined
    const [first, ...rest] = macrotaskQueue
    set({ macrotaskQueue: rest })
    return first
  },

  registerWebApi: (task: Task) =>
    set((s) => ({
      webApis: [
        ...s.webApis,
        { ...task, type: 'webapi', registeredAtSim: s.simulatedTimeMs },
      ],
    })),

  resolveWebApi: (taskId: string) => {
    const { webApis } = get()
    const task = webApis.find((t) => t.id === taskId)
    if (!task) return undefined
    set({ webApis: webApis.filter((t) => t.id !== taskId) })
    return task
  },

  logToConsole: (text: string) =>
    set((s) => {
      const line: ConsoleLine = { id: nextId(), text, timestamp: Date.now() }
      return { consoleLogs: [...s.consoleLogs, line] }
    }),

  setFlowHint: (hint: FlowHint | null) => set({ flowHint: hint }),

  setPhase: (phase) => set({ phase }),
  setIsRunning: (running: boolean) => set({ isRunning: running }),
  setSourceCode: (code: string) => set({ sourceCode: code }),
  setHighlightedLine: (line: number | null) => set({ highlightedLine: line }),

  setPendingScriptQueue: (tasks: Task[]) => set({ pendingScriptQueue: tasks }),

  setInstrumentedStride: (stride) => set({ instrumentedStride: stride }),

  reset: () => {
    const prev = get()
    abortInstrumentedSession()
    clearDidacticStepLockTimer()
    resetIdCounter()
    set({
      ...initialState(),
      sourceCode: prev.sourceCode,
    })
  },

  advanceWebApiSimClock: (deltaSimMs: number) => {
    const s = get()
    if (s.webApis.length === 0 || deltaSimMs <= 0 || s.phase === 'finished') return

    const simNow = s.simulatedTimeMs + deltaSimMs
    set({
      simulatedTimeMs: simNow,
      phase: 'awaiting-web-timers',
    })
  },

  tryAutoPromoteWebApiTimer: () => {
    const s = get()
    if (s.webApis.length === 0 || s.phase === 'finished') return false
    return promoteWebApiTimerToMacro(set, get, s.simulatedTimeMs, s.currentStep + 1, {
      lockStep: false,
    })
  },

  tickWebApiTimerClock: (deltaSimMs: number) => {
    get().advanceWebApiSimClock(deltaSimMs)
    promoteWebApiTimerToMacro(set, get, get().simulatedTimeMs, get().currentStep + 1)
  },

  simulateStep: () => {
    runDidacticSimulateStep({ set, get })
  },
}))
