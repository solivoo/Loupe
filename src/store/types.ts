// ─────────────────────────────────────────────────────────
// Fase 1 — Modelado de Datos del Event Loop
// ─────────────────────────────────────────────────────────

// ─── Tipos base ──────────────────────────────────────────

/** Origen semántico de una tarea dentro del Event Loop. */
export type TaskType =
  | 'sync'          // Código síncrono del script principal
  | 'microtask'     // Promise.then / queueMicrotask / MutationObserver
  | 'macrotask'     // setTimeout / setInterval / I/O
  | 'webapi'        // Timer pendiente en Web APIs (aún no venció)

/** Una unidad de trabajo que viaja entre las regiones del Event Loop. */
export interface Task {
  /** Identificador único (incremental, para keys de React y animaciones). */
  id: string
  /** Fragmento de código que representa esta tarea (para mostrar en la UI). */
  code: string
  /** Etiqueta corta descriptiva (ej. "setTimeout cb", "then #1"). */
  label: string
  /** Clasificación semántica. */
  type: TaskType
  /** Línea del código fuente original (opcional, para highlight). */
  line?: number
  /** Delay en ms (solo para timers en Web APIs). */
  delayMs?: number
  /**
   * Tiempo simulado en que el timer entró a Web APIs (ms, reloj del simulador).
   * No usar Date.now(): el avance es por pasos para que paso a paso sea usable.
   */
  registeredAtSim?: number

  /**
   * Fragmento del script principal antes de subir al Call Stack (cola FIFO).
   * `registerThen` / `registerTimeout` ejecutan efecto al salir del stack.
   */
  syncKind?:
    | 'statement'
    | 'registerThen'
    | 'registerTimeout'
    | 'registerAwait'
    | 'invokeFunction'
    | 'functionFrame'
    | 'returnFromFunction'
  /**
   * Al ejecutar `invokeFunction`: cuerpo de la función (se encola al entrar).
   */
  functionBodyTasks?: Task[]
  /**
   * Al ejecutar `registerThen`: microtareas encoladas en FIFO.
   * Cadena `.then().then()`: idealización didáctica — todas visibles en cola.
   */
  microtasksToEnqueue?: Task[]
  /** @deprecated Usar microtasksToEnqueue */
  linkedMicrotask?: Task
  /** Al ejecutar `registerTimeout`, se registra en Web APIs (delay en `delayMs`). */
  macroCallback?: Task
}

// ─── Regiones del Event Loop ─────────────────────────────

/**
 * Call Stack — LIFO.
 * El último elemento es el tope del stack (lo que se está ejecutando).
 */
export type CallStack = Task[]

/**
 * Microtask Queue — FIFO.
 * Se drenan TODAS antes de tomar la siguiente macrotarea.
 * Ej: Promise.then(), queueMicrotask(), MutationObserver.
 */
export type MicrotaskQueue = Task[]

/**
 * Macrotask Queue (Task Queue) — FIFO.
 * Se toma UNA por ciclo del event loop, después de drenar microtareas.
 * Ej: setTimeout, setInterval, I/O callbacks.
 */
export type MacrotaskQueue = Task[]

/**
 * Web APIs — Timers y operaciones asíncronas pendientes.
 * Cada entry tiene un delay; cuando "vence", se mueve a MacrotaskQueue.
 */
export type WebAPIs = Task[]

/** Resultado de parseSnippet: secuencia de tareas del script principal para el canvas. */
export interface ParsedScenario {
  scriptSequence: Task[]
}

// ─── Console ─────────────────────────────────────────────

/** Una línea de salida en la consola simulada. */
export interface ConsoleLine {
  id: string
  text: string
  /** Momento en que se imprimió (para ordenar). */
  timestamp: number
}

/**
 * Variable ligada a `Promise.resolve()` en el runtime instrumentado (modelo didáctico).
 * No representa una entrada FIFO de la cola de microtareas.
 */
export interface DidacticPromiseBindingItem {
  id: string
  bindingName: string
}

// ─── Fase del Event Loop ─────────────────────────────────

/**
 * Fase actual del ciclo del event loop.
 * La UI puede usar esto para resaltar la región activa.
 */
export type EventLoopPhase =
  | 'idle'                // No hay ejecución en curso (antes del primer paso o tras reset)
  | 'executing-sync'      // Ejecutando código síncrono (call stack)
  | 'staging-micro'       // Microtarea entra al Call Stack (un paso: cola → stack)
  | 'draining-microtasks' // Drenando cola de microtareas (compat / hints)
  | 'staging-macro'       // Macrotarea entra al Call Stack (un paso: cola → stack)
  | 'awaiting-web-timers' // Timers en Web APIs: tiempo simulado avanza hasta vencer
  | 'timer-callback-queued' // Un paso: callback pasó de Web APIs a la cola de macrotareas
  | 'executing-macrotask' // Ejecutando una macrotarea
  | 'finished'            // Todas las colas vacías, ejecución completa

/** Motor del canvas: fragmentos didácticos o ejecución JS instrumentada (StepController). */
export type ExecutionMode = 'didactic' | 'instrumented'

/**
 * Cómo instrumentar el código al cargar:
 * - `browser`: orden de consola y microtareas como en el motor real (sin pausa por línea).
 * - `step`: `await` en cada línea para enseñar paso a paso (la consola puede diferir del navegador).
 */
export type InstrumentedStride = 'browser' | 'step'

// ─── Flow Hint (flechas animadas) ────────────────────────

/** Regiones del tablero para las flechas de flujo. */
export type FlowRegion = 'stack' | 'webapis' | 'microtask' | 'macrotask' | 'console'

/** Pista visual: de dónde sale una tarea y a dónde va. */
export interface FlowHint {
  from: FlowRegion
  to: FlowRegion
  label: string
  /** Idea clave pedagógica para un tooltip. */
  concept: string
}

// ─── Estado Global del Store ─────────────────────────────

/** Tarea “en tránsito” entre una cola y el Call Stack (un tick didáctico). */
export interface StagedDispatch {
  task: Task
  from: 'micro' | 'macro'
}

/** Snapshot completo del estado del Event Loop en un instante dado. */
export interface EventLoopState {
  // ── Regiones ──
  callStack: CallStack
  microtaskQueue: MicrotaskQueue
  macrotaskQueue: MacrotaskQueue
  webApis: WebAPIs
  consoleLogs: ConsoleLine[]

  /**
   * Referencias pedagógicas a promesas ya cumplidas (`Promise.resolve()`), no la cola FIFO real.
   */
  didacticPromiseBindings: DidacticPromiseBindingItem[]

  /** Micro/macro ya desencoladas; el siguiente tick las empuja al Call Stack. */
  stagedDispatch: StagedDispatch | null

  /**
   * Script principal: fragmentos pendientes de entrar al Call Stack (FIFO).
   * Un tick hace push del siguiente; el siguiente tick lo ejecuta.
   */
  pendingScriptQueue: Task[]

  // ── Metadatos de ejecución ──
  phase: EventLoopPhase
  currentStep: number          // Contador de ticks ejecutados
  /** Reloj simulado (ms) para vencimiento de timers; avanza al esperar en Web APIs. */
  simulatedTimeMs: number
  flowHint: FlowHint | null    // Flecha animada activa (null = ninguna)
  isRunning: boolean           // true si hay un auto-play activo
  /** Step bloqueado mientras corre animación de trazo (p. ej. stack→Web APIs→macro). */
  stepInputLocked: boolean

  // ── Código fuente ──
  sourceCode: string           // Código del usuario en el editor
  highlightedLine: number | null // Línea actualmente ejecutándose

  /** `instrumented`: estado viene de `StepController` + código real instrumentado. */
  executionMode: ExecutionMode
  /** Texto de fase del runtime instrumentado (p. ej. "Pausado antes de línea 3"). */
  simCaption: string | null
  /** Si falla la instrumentación o la ejecución, mensaje breve para la UI. */
  instrumentedError: string | null
  /** Solo aplica cuando `executionMode === 'instrumented'` tras el próximo Cargar. */
  instrumentedStride: InstrumentedStride
}

/** Acciones que el store expone para mutar el estado. */
export interface EventLoopActions {
  // ── Acciones sobre el Call Stack ──
  pushToCallStack: (task: Task) => void
  popFromCallStack: () => Task | undefined

  // ── Acciones sobre Microtask Queue ──
  enqueueMicrotask: (task: Task) => void
  dequeueMicrotask: () => Task | undefined

  // ── Acciones sobre Macrotask Queue ──
  enqueueMacrotask: (task: Task) => void
  dequeueMacrotask: () => Task | undefined

  // ── Acciones sobre Web APIs ──
  registerWebApi: (task: Task) => void
  resolveWebApi: (taskId: string) => Task | undefined

  // ── Console ──
  logToConsole: (text: string) => void

  // ── Flow Hints ──
  setFlowHint: (hint: FlowHint | null) => void

  // ── Control de ejecución ──
  /** Avanza un "tick" del event loop simulado. */
  simulateStep: () => void
  /**
   * Avanza el reloj simulado de Web APIs (automático mientras el hilo principal está libre).
   */
  advanceWebApiSimClock: (deltaSimMs: number) => void
  /** Promueve un timer vencido a macrotareas si el hilo principal puede ceder el turno. */
  tryAutoPromoteWebApiTimer: () => boolean
  /**
   * Avanza reloj + intenta promover (usado por Step manual como “fast-forward”).
   */
  tickWebApiTimerClock: (deltaSimMs: number) => void
  /** Reinicia el estado completo a su valor inicial. */
  reset: () => void
  /** Carga nuevo código fuente. */
  setSourceCode: (code: string) => void
  /** Activa/desactiva auto-play. */
  setIsRunning: (running: boolean) => void
  /** Establece la fase actual. */
  setPhase: (phase: EventLoopPhase) => void
  /** Resalta una línea del editor. */
  setHighlightedLine: (line: number | null) => void
  /** Cola de fragmentos del script (carga del escenario). */
  setPendingScriptQueue: (tasks: Task[]) => void

  /** Preferencia de instrumentación (Step / Play vuelven a preparar si cambia). */
  setInstrumentedStride: (stride: InstrumentedStride) => void
}

/** Tipo completo del store: estado + acciones. */
export type EventLoopStore = EventLoopState & EventLoopActions
