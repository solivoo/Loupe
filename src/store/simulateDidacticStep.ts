import type { EventLoopPhase, EventLoopStore, Task } from './types'
import { parseSimpleConsoleLog } from './consoleLogPattern'
import {
  WEB_API_PARALLEL_CLOCK_SIM_MS,
  WEB_API_DELAY_SCALE,
  formatTimerPendingLabel,
} from './webApiTimerSimulation'
import { promoteWebApiTimerToMacro } from './eventLoopStoreInternals'
import { nextId } from './eventLoopStore'

export type SimulateStepContext = {
  set: (partial: Partial<EventLoopStore>) => void
  get: () => EventLoopStore
}

function phaseForExecutingTask(task: Task): EventLoopPhase {
  if (task.type === 'microtask') return 'draining-microtasks'
  if (task.type === 'macrotask') return 'executing-macrotask'
  return 'executing-sync'
}

function truncateTaskLabel(label: string, max = 48): string {
  if (label.length <= max) return label
  return `${label.slice(0, max - 1)}…`
}

function handleRegisterThen(
  ctx: SimulateStepContext,
  executing: Task,
  step: number,
): boolean {
  const micros =
    executing.microtasksToEnqueue ??
    (executing.linkedMicrotask ? [executing.linkedMicrotask] : [])
  if (executing.syncKind !== 'registerThen' || micros.length === 0) return false

  const chain = micros.length
  ctx.set({
    currentStep: step,
    phase: 'executing-sync',
    flowHint: {
      from: 'stack',
      to: 'microtask',
      label:
        chain > 1
          ? `Registrar ${chain} microtareas (.then×${chain})`
          : 'Registrar microtarea (.then)',
      concept:
        chain > 1
          ? 'Idealización didáctica: cada .then de la cadena entra a la cola FIFO; se drenan todas antes de la siguiente macrotarea.'
          : 'Durante el script síncrono, el motor encola el callback de Promise; las microtareas se ejecutan después de todo el síncrono.',
    },
    highlightedLine: executing.line ?? null,
  })
  for (const micro of micros) {
    ctx.get().enqueueMicrotask(micro)
  }
  ctx.get().popFromCallStack()
  return true
}

function popFunctionFrameIfPresent(ctx: SimulateStepContext): void {
  const frame = ctx.get().callStack.at(-1)
  if (frame?.syncKind === 'functionFrame') {
    ctx.get().popFromCallStack()
  }
}

function handleInvokeFunction(
  ctx: SimulateStepContext,
  executing: Task,
  step: number,
): boolean {
  if (executing.syncKind !== 'invokeFunction' || !executing.functionBodyTasks) return false

  ctx.set({
    currentStep: step,
    phase: 'executing-sync',
    flowHint: {
      from: 'stack',
      to: 'stack',
      label: `${executing.label} → frame en pila`,
      concept:
        'Llamar a una función empuja un frame al Call Stack (LIFO). El cuerpo corre encima; al return/await el frame sale.',
    },
    highlightedLine: executing.line ?? null,
  })

  const stack = ctx.get().callStack
  const frame: Task = {
    ...executing,
    syncKind: 'functionFrame',
  }
  const pending = ctx.get().pendingScriptQueue
  ctx.set({
    callStack: [...stack.slice(0, -1), frame],
    pendingScriptQueue: [...executing.functionBodyTasks, ...pending],
  })
  return true
}

function handleReturnFromFunction(
  ctx: SimulateStepContext,
  executing: Task,
  step: number,
): boolean {
  if (executing.syncKind !== 'returnFromFunction') return false

  ctx.set({
    currentStep: step,
    phase: 'executing-sync',
    flowHint: {
      from: 'stack',
      to: 'stack',
      label: 'return → pop frame',
      concept: 'Al salir de la función se hace pop del frame en la cima de la pila (LIFO).',
    },
    highlightedLine: executing.line ?? null,
  })
  ctx.get().popFromCallStack()
  popFunctionFrameIfPresent(ctx)
  return true
}

function handleRegisterAwait(
  ctx: SimulateStepContext,
  executing: Task,
  step: number,
): boolean {
  const micros = executing.microtasksToEnqueue ?? []
  if (executing.syncKind !== 'registerAwait' || micros.length === 0) return false

  ctx.set({
    currentStep: step,
    phase: 'executing-sync',
    flowHint: {
      from: 'stack',
      to: 'microtask',
      label: 'await → pop main() + microtarea',
      concept:
        'await suspende la función async: main() sale del Call Stack (pop) y el código que sigue pasa a la cola de microtareas. El script síncrono puede continuar.',
    },
    highlightedLine: executing.line ?? null,
  })
  for (const micro of micros) {
    ctx.get().enqueueMicrotask(micro)
  }
  ctx.get().popFromCallStack()
  popFunctionFrameIfPresent(ctx)
  return true
}

function handleRegisterTimeout(
  ctx: SimulateStepContext,
  executing: Task,
  step: number,
): boolean {
  if (executing.syncKind !== 'registerTimeout' || !executing.macroCallback) return false
  const d = executing.delayMs ?? 0
  ctx.set({
    currentStep: step,
    phase: 'executing-sync',
    flowHint: {
      from: 'stack',
      to: 'webapis',
      label: `setTimeout → Web APIs (${d} ms)`,
      concept:
        `El callback entra en Web APIs y arranca el reloj en paralelo: delay 0 → mínimo del motor (~4 ms × ${WEB_API_DELAY_SCALE}); delay N → N × ${WEB_API_DELAY_SCALE} ms sim.`,
    },
    highlightedLine: executing.line ?? null,
  })
  ctx.get().registerWebApi({ ...executing.macroCallback, delayMs: d })
  ctx.get().popFromCallStack()
  return true
}

function handleCallStackExecution(ctx: SimulateStepContext, s: EventLoopStore, step: number): boolean {
  const executing = s.callStack.at(-1)
  if (!executing) return false

  if (executing.syncKind === 'functionFrame') return false

  if (handleRegisterThen(ctx, executing, step)) return true
  if (handleRegisterAwait(ctx, executing, step)) return true
  if (handleInvokeFunction(ctx, executing, step)) return true
  if (handleReturnFromFunction(ctx, executing, step)) return true
  if (handleRegisterTimeout(ctx, executing, step)) return true

  const logText = parseSimpleConsoleLog(executing.code)
  const isConsoleLog = logText !== null

  ctx.set({
    currentStep: step,
    phase: phaseForExecutingTask(executing),
    flowHint: {
      from: 'stack',
      to: isConsoleLog ? 'console' : 'stack',
      label: executing.label,
      concept: isConsoleLog
        ? 'console.log escribe en la consola. La salida refleja el orden real de ejecución.'
        : 'El motor ejecuta la función del tope del Call Stack.',
    },
    highlightedLine: executing.line ?? null,
  })

  if (logText !== null) {
    ctx.get().logToConsole(logText)
  }
  ctx.get().popFromCallStack()
  return true
}

function handlePendingScript(ctx: SimulateStepContext, s: EventLoopStore, step: number): boolean {
  if (s.pendingScriptQueue.length === 0) return false
  const [next, ...rest] = s.pendingScriptQueue
  ctx.set({
    currentStep: step,
    pendingScriptQueue: rest,
    phase: 'executing-sync',
    flowHint: {
      from: 'stack',
      to: 'stack',
      label: `Script → stack: ${truncateTaskLabel(next.label)}`,
      concept:
        'Cada fragmento del programa entra al Call Stack en un paso; el siguiente paso lo ejecuta (LIFO).',
    },
    highlightedLine: next.line ?? null,
  })
  ctx.get().pushToCallStack(next)
  return true
}

/** Microtarea: un solo paso de cola FIFO → Call Stack (sin staging intermedio). */
function handleMicrotaskDispatch(ctx: SimulateStepContext, s: EventLoopStore, step: number): boolean {
  if (s.pendingScriptQueue.length > 0 || s.microtaskQueue.length === 0) return false
  const micro = s.microtaskQueue[0]
  ctx.get().dequeueMicrotask()
  const task: Task = { ...micro, type: 'microtask' }
  ctx.set({
    currentStep: step,
    phase: 'staging-micro',
    flowHint: {
      from: 'microtask',
      to: 'stack',
      label: 'Microtarea → Call Stack',
      concept:
        'Se drenan TODAS las microtareas en orden FIFO antes de la siguiente macrotarea. Cada una sube al Call Stack para ejecutarse.',
    },
    highlightedLine: task.line ?? null,
  })
  ctx.get().pushToCallStack(task)
  return true
}

function handleWebApiTimers(ctx: SimulateStepContext, s: EventLoopStore, step: number): boolean {
  if (s.pendingScriptQueue.length > 0 || s.webApis.length === 0) return false
  if (s.microtaskQueue.length > 0 || s.macrotaskQueue.length > 0) return false

  if (promoteWebApiTimerToMacro(ctx.set, ctx.get, s.simulatedTimeMs, step)) return true

  ctx.get().advanceWebApiSimClock(WEB_API_PARALLEL_CLOCK_SIM_MS)
  if (promoteWebApiTimerToMacro(ctx.set, ctx.get, ctx.get().simulatedTimeMs, step)) return true

  const after = ctx.get()
  if (after.webApis.length === 0) return false

  ctx.set({
    currentStep: step,
    phase: 'awaiting-web-timers',
    flowHint: {
      from: 'webapis',
      to: 'webapis',
      label: formatTimerPendingLabel(after.webApis, after.simulatedTimeMs),
      concept:
        'El contador corre en paralelo (misma escala ×10 en todos los ejemplos). Step avanza un tick del reloj si quieres; también corre solo mientras el timer está en Web APIs.',
    },
  })
  return true
}

/** Macrotarea: un solo paso de cola FIFO → Call Stack (sin staging intermedio). */
function handleMacrotaskDispatch(ctx: SimulateStepContext, s: EventLoopStore, step: number): boolean {
  if (
    s.pendingScriptQueue.length > 0 ||
    s.microtaskQueue.length > 0 ||
    s.macrotaskQueue.length === 0
  ) {
    return false
  }
  const macro = s.macrotaskQueue[0]
  ctx.get().dequeueMacrotask()
  const task: Task = { ...macro, type: 'macrotask' }
  ctx.set({
    currentStep: step,
    phase: 'staging-macro',
    flowHint: {
      from: 'macrotask',
      to: 'stack',
      label: 'Macrotarea → Call Stack',
      concept:
        'El event loop toma UNA macrotarea de la cola (FIFO) y la pone en el Call Stack para ejecutarla.',
    },
    highlightedLine: task.line ?? null,
  })
  ctx.get().pushToCallStack(task)
  return true
}

function handleFinished(ctx: SimulateStepContext, step: number): void {
  ctx.set({
    currentStep: step,
    phase: 'finished',
    flowHint: null,
    highlightedLine: null,
  })
}

/** Un paso del simulador didáctico (extraído para reducir complejidad cognitiva). */
export function runDidacticSimulateStep(ctx: SimulateStepContext): void {
  const s = ctx.get()
  if (s.stepInputLocked) return

  const step = s.currentStep + 1

  if (handleCallStackExecution(ctx, s, step)) return
  if (handlePendingScript(ctx, s, step)) return
  if (handleMicrotaskDispatch(ctx, s, step)) return
  if (handleMacrotaskDispatch(ctx, s, step)) return
  if (handleWebApiTimers(ctx, s, step)) return
  handleFinished(ctx, step)
}
