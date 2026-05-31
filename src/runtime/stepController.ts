import { FLOW_PIPE_TO_CONSOLE_MS } from './flowPipeTiming.ts'

export interface StepMeta {
  line: number
  /**
   * Si la línea es una llamada `setTimeout` con demora numérica conocida,
   * el temporizador aparece en Web APIs ya en la pausa (antes de ejecutar la línea).
   */
  pendingTimerMs?: number
}

/** Región del tablero (para pistas de flujo UI / tests). */
export type FlowRegion = 'stack' | 'web' | 'micro' | 'task' | 'console'

/** Metadatos opcionales al registrar un paso de flujo (UI pedagógica). */
export type FlowHintExtras = {
  concept?: string
  codeFragment?: string
}

/** Última “tubería” destacada: de dónde sale trabajo y a dónde va (modelo pedagógico). */
export type FlowHint = {
  from: FlowRegion
  to: FlowRegion
  label: string
  /** Idea clave (panel flotante). */
  concept?: string
  /** Fragmento de código ilustrativo (no tiene por qué ser el fuente literal). */
  codeFragment?: string
} | null

export type TaskQueueItem = { label: string; trackId: number }

export type MicrotaskQueueItem = { label: string; trackId: number }

/** Promesas ya cumplidas por `Promise.resolve()` (modelo didáctico; no son entradas FIFO de la cola). */
export type DidacticPromiseBinding = { bindingName: string }

export type VisualSnapshot = {
  callStack: string[]
  webTimers: { id: number; ms: number; label: string }[]
  taskQueue: TaskQueueItem[]
  microtaskQueue: MicrotaskQueueItem[]
  /** Variables ligadas a `Promise.resolve()` en esta ejecución (referencia pedagógica). */
  didacticPromiseBindings: DidacticPromiseBinding[]
  consoleLines: string[]
  phase: string
  flowHint: FlowHint
  /** Step/Play bloqueados mientras corre la animación de tubería en el diagrama. */
  stepInputLocked: boolean
}

type Listener = (s: VisualSnapshot) => void

let timerSeq = 0
let microSeq = 0

export class StepController {
  mode: 'step' | 'run' = 'step'

  private aborted = false
  private stack: string[] = []
  private webTimers: VisualSnapshot['webTimers'] = []
  private taskQueue: TaskQueueItem[] = []
  private microtaskQueue: MicrotaskQueueItem[] = []
  private didacticPromiseBindings: DidacticPromiseBinding[] = []
  private consoleLines: string[] = []
  private phase = 'idle'
  private flowHint: FlowHint = null
  /** Cola de líneas aún no mostradas en el panel (esperan el mismo tiempo que la bolita en el trazo). */
  private consolePending: string[] = []
  private consoleRevealHandle: ReturnType<typeof setTimeout> | null = null
  /** FIFO: pausas anidadas (p. ej. `.then` antes de la siguiente línea del script) no deben pisar el resolver. */
  private resumeQueue: Array<() => void> = []
  private listeners: Listener[] = []
  /** Temporizador “vista previa” para líneas setTimeout; lo confirma el runtime al llamar setTimeout. */
  private previewTimerId: number | null = null
  /**
   * Mientras esperamos “Siguiente paso”, el motor real sigue vivo: un setTimeout(0) podría
   * disparar antes de terminar el script síncrono. Retenemos esos disparos y los liberamos
   * al salir del gate (setTimeout(0) nativo, fuera del wrapper instrumentado).
   */
  private steppingPaused = false
  private deferredMacroFires: Array<() => void | Promise<void>> = []
  private deferredMacroFlushHandle: ReturnType<typeof setTimeout> | null = null
  /** Bloqueos activos de animación de trazo (stack→web, web→macro, etc.). */
  private pipeLockCount = 0
  private pipeUnlockHandle: ReturnType<typeof setTimeout> | null = null

  /**
   * `true` mientras hay al menos un probe ejecutando código del usuario.
   * El parche de Promise.prototype.then solo registra microtareas si es true.
   */
  interceptPromises = false

  /**
   * Solo `mode === 'run'`: tras completar cada línea instrumentada (cuando el probe devuelve Promise),
   * espera estos ms antes de `afterStep` para que React pinte la secuencia (Play + “Fiel al navegador”).
   * No altera el orden de la consola respecto al motor real.
   */
  linePacingMs = 0

  setLinePacingMs(ms: number): void {
    this.linePacingMs = Math.max(0, ms)
  }

  subscribe(fn: Listener): () => void {
    this.listeners.push(fn)
    fn(this.snapshot())
    return () => {
      this.listeners = this.listeners.filter((x) => x !== fn)
    }
  }

  private emit(): void {
    const s = this.snapshot()
    this.listeners.forEach((l) => l(s))
  }

  /** Congela Step mientras la UI muestra el recorrido entre regiones del diagrama. */
  private lockStepForPipeAnimation(): void {
    this.pipeLockCount++
    if (this.pipeUnlockHandle !== null) {
      window.clearTimeout(this.pipeUnlockHandle)
    }
    this.pipeUnlockHandle = window.setTimeout(() => {
      this.pipeUnlockHandle = null
      this.pipeLockCount = Math.max(0, this.pipeLockCount - 1)
      this.emit()
    }, FLOW_PIPE_TO_CONSOLE_MS)
  }

  private isStepInputLockedNow(): boolean {
    return (
      this.pipeLockCount > 0 ||
      this.consoleRevealHandle !== null ||
      this.consolePending.length > 0
    )
  }

  /** Expuesto para tests y para que el store no avance Step durante transiciones. */
  get isStepInputLocked(): boolean {
    return this.isStepInputLockedNow()
  }

  snapshot(): VisualSnapshot {
    return {
      callStack: [...this.stack],
      webTimers: [...this.webTimers],
      taskQueue: [...this.taskQueue],
      microtaskQueue: [...this.microtaskQueue],
      didacticPromiseBindings: [...this.didacticPromiseBindings],
      consoleLines: [...this.consoleLines],
      phase: this.phase,
      flowHint: this.flowHint,
      stepInputLocked: this.isStepInputLockedNow(),
    }
  }

  /**
   * Didáctica: `let x = Promise.resolve()` crea una Promise ya cumplida (síncrono).
   * No es una microtarea en la cola hasta que se use `await x` o `x.then(...)`.
   */
  recordPromiseResolvedBinding(bindingName: string): void {
    if (!this.didacticPromiseBindings.some((b) => b.bindingName === bindingName)) {
      this.didacticPromiseBindings.push({ bindingName })
    }
    this.flowHint = {
      from: 'stack',
      to: 'micro',
      label: `«${bindingName}» ← Promise.resolve()`,
      concept:
        'Esta línea crea un objeto Promise ya cumplido; no encola una microtarea por sí sola. Al hacer await o encadenar .then, el motor sí programará reacciones en la cola de microtareas (p. ej. await previous en un mutex).',
      codeFragment: `let ${bindingName} = Promise.resolve();`,
    }
    this.emit()
  }

  logConsole(line: string, extras?: FlowHintExtras): void {
    this.flowHint = {
      from: 'stack',
      to: 'console',
      label: 'console.log',
      concept:
        extras?.concept ??
        'La salida refleja el orden real de ejecución en el hilo (y microtareas antes que la siguiente macrotarea).',
      codeFragment: extras?.codeFragment ?? 'console.log(...)',
    }
    this.lockStepForPipeAnimation()
    this.emit()
    this.consolePending.push(line)
    this.armConsoleReveal()
  }

  private armConsoleReveal(): void {
    if (this.consoleRevealHandle !== null) return
    this.consoleRevealHandle = window.setTimeout(() => {
      this.consoleRevealHandle = null
      this.drainOneConsoleLine()
    }, FLOW_PIPE_TO_CONSOLE_MS)
  }

  private drainOneConsoleLine(): void {
    const line = this.consolePending.shift()
    if (line === undefined) return
    this.consoleLines.push(line)
    this.emit()
    if (this.consolePending.length > 0) {
      this.consoleRevealHandle = window.setTimeout(() => {
        this.consoleRevealHandle = null
        this.drainOneConsoleLine()
      }, FLOW_PIPE_TO_CONSOLE_MS)
    }
  }

  private flushPendingConsoleLinesImmediate(): void {
    if (this.consoleRevealHandle !== null) {
      window.clearTimeout(this.consoleRevealHandle)
      this.consoleRevealHandle = null
    }
    while (this.consolePending.length > 0) {
      const line = this.consolePending.shift()
      if (line !== undefined) this.consoleLines.push(line)
    }
  }

  pushMicrotask(label: string, extras?: FlowHintExtras): void {
    this.flowHint = {
      from: 'stack',
      to: 'micro',
      label,
      concept:
        extras?.concept ??
        'Se programa trabajo en la cola de microtareas: tiene prioridad sobre la cola de macrotareas.',
      codeFragment: extras?.codeFragment ?? label,
    }
    const trackId = ++microSeq
    this.microtaskQueue.push({ label, trackId })
    this.lockStepForPipeAnimation()
    this.emit()
  }

  shiftMicrotask(): void {
    this.flowHint = {
      from: 'micro',
      to: 'stack',
      label: 'Ejecutar microtarea',
      concept:
        'El motor vacía todas las microtareas pendientes antes de tomar la siguiente macrotarea (p. ej. un setTimeout).',
      codeFragment: '(reacción Promise.then / queueMicrotask)',
    }
    this.microtaskQueue.shift()
    this.lockStepForPipeAnimation()
    this.emit()
  }

  enqueueTask(label: string, trackId: number): void {
    this.flowHint = {
      from: 'web',
      to: 'task',
      label,
      concept:
        'Cuando el temporizador del navegador vence, el callback entra en la cola de tareas (macrotareas).',
      codeFragment: 'setTimeout(() => { ... }, ms)',
    }
    this.taskQueue.push({ label, trackId })
    this.lockStepForPipeAnimation()
    this.emit()
  }

  shiftTask(): void {
    this.flowHint = {
      from: 'task',
      to: 'stack',
      label: 'Ejecutar macrotarea',
      concept:
        'El event loop saca una macrotarea de la cola y ejecuta su callback en el call stack.',
      codeFragment: '(callback programado con setTimeout / tareas del navegador)',
    }
    this.taskQueue.shift()
    this.lockStepForPipeAnimation()
    this.emit()
  }

  /** Interrumpe una pausa y hace fallar el paso actual (p. ej. al pulsar Reiniciar). */
  abort(): void {
    this.aborted = true
    this.flushPendingConsoleLinesImmediate()
    const wake = this.resumeQueue.splice(0)
    for (const r of wake) r()
    this.steppingPaused = false
    if (this.deferredMacroFlushHandle !== null) {
      window.clearTimeout(this.deferredMacroFlushHandle)
      this.deferredMacroFlushHandle = null
    }
    this.deferredMacroFires = []
    this.didacticPromiseBindings = []
    this.pipeLockCount = 0
    if (this.pipeUnlockHandle !== null) {
      window.clearTimeout(this.pipeUnlockHandle)
      this.pipeUnlockHandle = null
    }
    this.phase = 'idle'
    this.flowHint = null
    if (this.previewTimerId !== null) {
      this.removeWebTimer(this.previewTimerId)
      this.previewTimerId = null
    }
    this.emit()
  }

  private async gateWithPhase(phaseLine: string): Promise<void> {
    if (this.mode === 'run') return
    if (this.aborted) {
      throw new DOMException('Ejecución cancelada', 'AbortError')
    }
    this.phase = phaseLine
    this.emit()
    this.steppingPaused = true
    await new Promise<void>((r) => {
      this.resumeQueue.push(r)
    })
    this.steppingPaused = this.resumeQueue.length > 0
    if (this.aborted) {
      throw new DOMException('Ejecución cancelada', 'AbortError')
    }
    this.phase = 'Ejecutando'
    this.emit()
    this.scheduleDeferredMacroFlush()
  }

  private async gate(meta: StepMeta): Promise<void> {
    await this.gateWithPhase(`Pausado antes de línea ${meta.line}`)
  }

  /**
   * Tras encolar el callback del temporizador en la cola de macrotareas: en modo paso,
   * pausa explícita para poder ver la tarjeta “Cola de tareas” antes de ejecutar el callback.
   */
  async gateAfterTaskEnqueued(taskLabel: string): Promise<void> {
    await this.gateWithPhase(`Pausado: macrotarea en cola (${taskLabel})`)
  }

  continueStep(): void {
    this.resumeQueue.shift()?.()
  }

  /** `true` mientras un `gate` espera `continueStep` (útil en tests). */
  get awaitingManualStep(): boolean {
    return this.resumeQueue.length > 0
  }

  /**
   * Primer callback de setTimeout instrumentado: si estamos en pausa de paso, no ejecutar
   * hasta que el gate libere el hilo (evita macrotareas antes de “fin” y estados incoherentes).
   */
  runMacroFireWhenAllowed(fn: () => void | Promise<void>): void {
    if (this.mode === 'step' && this.steppingPaused) {
      this.deferredMacroFires.push(fn)
      return
    }
    void Promise.resolve(fn()).then(undefined, () => {})
  }

  private scheduleDeferredMacroFlush(): void {
    if (this.deferredMacroFires.length === 0) return
    if (this.deferredMacroFlushHandle !== null) return
    this.deferredMacroFlushHandle = window.setTimeout(() => {
      this.deferredMacroFlushHandle = null
      const batch = this.deferredMacroFires.splice(0)
      void (async () => {
        for (const f of batch) {
          await Promise.resolve(f())
        }
        if (this.deferredMacroFires.length > 0 && !this.steppingPaused) {
          this.scheduleDeferredMacroFlush()
        }
      })()
    }, 0)
  }

  /** Parte síncrona de “antes de línea” (stack, vista previa de timer, emit). */
  private applyLineProbeSetup(meta: StepMeta): void {
    this.stack.push(`línea ${meta.line}`)
    if (meta.pendingTimerMs !== undefined) {
      this.previewTimerId = this.addWebTimer(
        meta.pendingTimerMs,
        `callback (${meta.pendingTimerMs}ms)`,
      )
    }
    this.emit()
  }

  async beforeStep(meta: StepMeta): Promise<void> {
    this.applyLineProbeSetup(meta)
    await this.gate(meta)
  }

  afterStep(): void {
    if (this.previewTimerId !== null) {
      this.removeWebTimer(this.previewTimerId)
      this.previewTimerId = null
    }
    this.stack.pop()
    this.emit()
  }

  addWebTimer(ms: number, label: string): number {
    this.flowHint = {
      from: 'stack',
      to: 'web',
      label: `Timer Web API (${ms}ms)`,
      concept:
        'El hilo registra el temporizador en el entorno (Web APIs); el script sigue sin bloquearse.',
      codeFragment: `setTimeout(fn, ${ms})`,
    }
    const id = ++timerSeq
    this.webTimers.push({ id, ms, label })
    this.lockStepForPipeAnimation()
    this.emit()
    return id
  }

  removeWebTimer(id: number): void {
    this.webTimers = this.webTimers.filter((t) => t.id !== id)
    this.emit()
  }

  /**
   * Reutiliza el temporizador de vista previa (mismo id en Web APIs) o crea uno nuevo.
   */
  takePreviewTimerOrAdd(ms: number, label: string): number {
    if (this.previewTimerId !== null) {
      this.flowHint = {
        from: 'stack',
        to: 'web',
        label: `setTimeout → Web API (${ms}ms)`,
        concept:
          'Al evaluar setTimeout, el navegador deja el timer en Web APIs hasta que cumpla el plazo (0 ms = lo antes posible tras microtareas).',
        codeFragment: `setTimeout(() => { ... }, ${ms})`,
      }
      const id = this.previewTimerId
      this.previewTimerId = null
      const row = this.webTimers.find((t) => t.id === id)
      if (row) {
        row.ms = ms
        row.label = label
        this.lockStepForPipeAnimation()
        this.emit()
        return id
      }
    }
    return this.addWebTimer(ms, label)
  }

  makeProbe(): (meta: StepMeta, fn: () => void | Promise<unknown>) => unknown {
    return (meta, fn) => {
      if (this.mode === 'run') {
        this.applyLineProbeSetup(meta)
        this.interceptPromises = true
        let result: unknown
        try {
          result = fn()
        } catch (e) {
          this.interceptPromises = false
          throw e
        }

        /**
         * Mientras la línea instrumentada sigue en curso (async/await, .then, etc.),
         * el parche de Promise.prototype.then debe seguir activo — si no, el orden de consola
         * y la cola de microtareas dejan de coincidir con el navegador.
         */
        const finalizeRunLine = async (): Promise<void> => {
          this.interceptPromises = false
          if (this.linePacingMs > 0) {
            await new Promise<void>((r) => setTimeout(r, this.linePacingMs))
          }
          this.afterStep()
        }

        if (result != null && typeof (result as { then?: unknown }).then === 'function') {
          return Promise.resolve(result as PromiseLike<unknown>).finally(() => finalizeRunLine())
        }

        this.interceptPromises = false
        this.afterStep()
        return result
      }

      return (async () => {
        await this.beforeStep(meta)
        this.interceptPromises = true
        try {
          const result = fn() as unknown
          if (result != null && typeof (result as { then?: unknown }).then === 'function') {
            await result
          }
          return result
        } finally {
          this.interceptPromises = false
          this.afterStep()
        }
      })()
    }
  }
}
