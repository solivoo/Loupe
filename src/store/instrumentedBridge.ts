import { instrumentSource } from '../instrumentation/instrumentImpl.ts'
import { executeInstrumented } from '../runtime/executeUserCode.ts'
import { StepController, type VisualSnapshot } from '../runtime/stepController.ts'
import type {
  ConsoleLine,
  EventLoopPhase,
  FlowHint,
  InstrumentedStride,
  Task,
} from './types'

import type { FlowRegion as StoreFlowRegion } from './types'

function mapRuntimeFlowHint(h: VisualSnapshot['flowHint']): FlowHint | null {
  if (!h) return null
  const from = mapRegion(h.from as 'stack' | 'web' | 'micro' | 'task' | 'console')
  const to = mapRegion(h.to as 'stack' | 'web' | 'micro' | 'task' | 'console')
  return {
    from,
    to,
    label: h.label,
    concept: h.concept ?? '',
  }
}

function mapRegion(
  r: 'stack' | 'web' | 'micro' | 'task' | 'console',
): StoreFlowRegion {
  switch (r) {
    case 'web':
      return 'webapis'
    case 'micro':
      return 'microtask'
    case 'task':
      return 'macrotask'
    default:
      return r
  }
}

/** Extrae número de línea de etiquetas tipo "línea 39" del call stack visual. */
export function lineFromStackLabel(label: string): number | undefined {
  const m = /^línea\s+(\d+)/i.exec(label.trim())
  if (!m) return undefined
  return Number.parseInt(m[1], 10)
}

function mapPhaseString(phase: string): EventLoopPhase {
  if (phase === 'idle') return 'idle'
  if (phase === 'finished') return 'finished'
  if (phase.includes('Pausado') || phase === 'Ejecutando') return 'executing-sync'
  return 'executing-sync'
}

export function visualSnapshotToStorePatch(
  snap: VisualSnapshot,
  nextId: () => string,
): Partial<
  Pick<
    import('./types').EventLoopStore,
    | 'callStack'
    | 'microtaskQueue'
    | 'macrotaskQueue'
    | 'webApis'
    | 'consoleLogs'
    | 'didacticPromiseBindings'
    | 'flowHint'
    | 'phase'
    | 'highlightedLine'
    | 'simCaption'
    | 'stagedDispatch'
    | 'pendingScriptQueue'
    | 'stepInputLocked'
  >
> {
  const callStack: Task[] = snap.callStack.map((label) => {
    const line = lineFromStackLabel(label)
    return {
      id: nextId(),
      label,
      code: label,
      type: 'sync' as const,
      line,
    }
  })

  const topLine = callStack.length > 0 ? callStack[callStack.length - 1].line : undefined

  const microtaskQueue: Task[] = snap.microtaskQueue.map((m) => ({
    id: nextId(),
    label: m.label,
    code: m.label,
    type: 'microtask' as const,
    line: undefined,
  }))

  const macrotaskQueue: Task[] = snap.taskQueue.map((m) => ({
    id: nextId(),
    label: m.label,
    code: m.label,
    type: 'macrotask' as const,
    line: undefined,
  }))

  const webApis: Task[] = snap.webTimers.map((w) => ({
    id: `wt-${w.id}`,
    label: w.label,
    code: w.label,
    type: 'webapi' as const,
    delayMs: w.ms,
  }))

  const consoleLogs: ConsoleLine[] = snap.consoleLines.map((text) => ({
    id: nextId(),
    text,
    timestamp: Date.now(),
  }))

  const didacticPromiseBindings = snap.didacticPromiseBindings.map((b) => ({
    id: nextId(),
    bindingName: b.bindingName,
  }))

  return {
    callStack,
    microtaskQueue,
    macrotaskQueue,
    webApis,
    consoleLogs,
    didacticPromiseBindings,
    flowHint: mapRuntimeFlowHint(snap.flowHint),
    phase: mapPhaseString(snap.phase),
    highlightedLine: topLine ?? null,
    simCaption: snap.phase,
    stagedDispatch: null,
    pendingScriptQueue: [],
    stepInputLocked: snap.stepInputLocked,
  }
}

let activeController: StepController | null = null
let unsubscribeSnapshot: (() => void) | null = null
/** Código listo para `executeInstrumented` tras `prepareInstrumentedSession`. */
let pendingInstrumentedCode: string | null = null
/** Fuente con la que se hizo el último `prepare` (para no re-instrumentar sin cambios). */
let preparedSourceSnapshot: string | null = null
/** `stride` usado en el último prepare. */
let preparedStrideSnapshot: InstrumentedStride | null = null
/** `true` mientras `executeInstrumented` está en curso o hasta que termina (luego se pone en false). */
let instrumentedRunStarted = false

export function getActiveInstrumentedController(): StepController | null {
  return activeController
}

export function abortInstrumentedSession(): void {
  if (unsubscribeSnapshot) {
    unsubscribeSnapshot()
    unsubscribeSnapshot = null
  }
  if (activeController) {
    activeController.setLinePacingMs(0)
    activeController.abort()
    activeController = null
  }
  pendingInstrumentedCode = null
  preparedSourceSnapshot = null
  preparedStrideSnapshot = null
  instrumentedRunStarted = false
}

type StoreSetter = (
  partial:
    | Partial<import('./types').EventLoopStore>
    | ((s: import('./types').EventLoopStore) => Partial<import('./types').EventLoopStore>),
) => void

function instrumentOptionsForStride(stride: InstrumentedStride): {
  awaitSyncProbes: boolean
  controllerMode: 'step' | 'run'
} {
  if (stride === 'browser') {
    return { awaitSyncProbes: false, controllerMode: 'run' }
  }
  return { awaitSyncProbes: true, controllerMode: 'step' }
}

/**
 * Instrumenta el código y enlaza el `StepController` al store.
 * **No ejecuta** el snippet: hay que llamar a `beginInstrumentedExecution` (p. ej. al pulsar Step o Play).
 *
 * - `browser`: consola como el motor real (sin `await` entre líneas síncronas).
 * - `step`: pausa pedagógica antes de cada línea.
 */
export function prepareInstrumentedSession(
  set: StoreSetter,
  source: string,
  nextIdFn: () => string,
  stride: InstrumentedStride = 'step',
): { ok: true } | { ok: false; error: string } {
  abortInstrumentedSession()

  const { awaitSyncProbes, controllerMode } = instrumentOptionsForStride(stride)
  const { code, error } = instrumentSource(source, { awaitSyncProbes })
  if (error || !code) {
    return { ok: false, error: error ?? 'No se pudo instrumentar el código.' }
  }

  pendingInstrumentedCode = code

  const ctl = new StepController()
  ctl.mode = controllerMode
  activeController = ctl

  preparedSourceSnapshot = source
  preparedStrideSnapshot = stride

  unsubscribeSnapshot = ctl.subscribe((snap) => {
    set((s) => {
      const patch = visualSnapshotToStorePatch(snap, nextIdFn)
      const keepPreviousConsole =
        snap.consoleLines.length === 0 && s.consoleLogs.length > 0
      return {
        ...patch,
        ...(keepPreviousConsole ? { consoleLogs: s.consoleLogs } : {}),
        executionMode: 'instrumented',
      }
    })
  })

  return { ok: true }
}

/**
 * Garantiza sesión instrumentada lista para el fuente y el stride actuales (sin ejecutar).
 * Si el editor está vacío, devuelve `false`.
 */
export function ensureInstrumentedReady(
  set: StoreSetter,
  source: string,
  nextIdFn: () => string,
  stride: InstrumentedStride,
): boolean {
  if (source.trim() === '') {
    set({ simCaption: 'Escribe código en el editor' })
    return false
  }
  const samePrep =
    activeController &&
    pendingInstrumentedCode &&
    preparedSourceSnapshot === source &&
    preparedStrideSnapshot === stride
  if (samePrep) {
    return true
  }
  const r = prepareInstrumentedSession(set, source, nextIdFn, stride)
  if (r.ok) {
    set({
      instrumentedError: null,
      simCaption: 'Pulsa Step o Play para ejecutar',
      phase: 'idle',
      currentStep: 0,
    })
    return true
  }
  set({
    executionMode: 'didactic',
    instrumentedError: r.error,
    simCaption: null,
  })
  return false
}

/**
 * Arranca `executeInstrumented` una sola vez por sesión preparada. Idempotente si ya se inició.
 */
export function beginInstrumentedExecution(set: StoreSetter): boolean {
  if (!activeController || pendingInstrumentedCode === null || instrumentedRunStarted) {
    return false
  }
  instrumentedRunStarted = true
  const code = pendingInstrumentedCode
  const ctl = activeController

  void executeInstrumented(code, ctl, 0)
    .then(() => {
      instrumentedRunStarted = false
      if (activeController !== ctl) return
      ctl.setLinePacingMs(0)
      set({
        phase: 'finished',
        simCaption: 'Completado',
        flowHint: null,
        isRunning: false,
      })
    })
    .catch((e: unknown) => {
      instrumentedRunStarted = false
      if (activeController !== ctl) return
      ctl.setLinePacingMs(0)
      const msg = e instanceof Error ? e.message : String(e)
      set({
        phase: 'idle',
        simCaption: `Error: ${msg}`,
        instrumentedError: msg,
        isRunning: false,
        executionMode: 'didactic',
      })
    })

  return true
}
