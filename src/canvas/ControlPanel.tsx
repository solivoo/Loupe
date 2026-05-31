import { useCallback, useEffect } from 'react'
import {
  useEventLoopStore,
  loadScenarioIntoStore,
  resetIdCounter,
} from '../store'
import {
  WEB_API_PARALLEL_CLOCK_INTERVAL_MS,
  WEB_API_PARALLEL_CLOCK_SIM_MS,
} from '../store/webApiTimerSimulation'

/** Etiqueta + color por fase. */
const PHASE_CONFIG: Record<string, { label: string; color: string }> = {
  'idle':                  { label: '⏸ Esperando',            color: 'rgba(148, 163, 184, 0.5)' },
  'executing-sync':        { label: '▶ Ejecutando síncrono',  color: '#3b82f6' },
  'staging-micro':         { label: '📤 Micro → stack',       color: '#c084fc' },
  'draining-microtasks':   { label: '⚡ Drenando microtareas', color: '#a855f7' },
  'staging-macro':         { label: '📤 Macro → stack',       color: '#fbbf24' },
  'awaiting-web-timers':   { label: '⏲ Timer en Web APIs',    color: '#34d399' },
  'timer-callback-queued': { label: '📬 Callback → cola macro', color: '#fbbf24' },
  'executing-macrotask':   { label: '📬 Ejecutando macrotarea', color: '#f59e0b' },
  'finished':              { label: '✅ Completado',           color: '#10b981' },
}

export function ControlPanel() {
  const phase = useEventLoopStore((s) => s.phase)
  const currentStep = useEventLoopStore((s) => s.currentStep)
  const isBeforeFirstStep = currentStep === 0
  const sourceCode = useEventLoopStore((s) => s.sourceCode)
  const callStack = useEventLoopStore((s) => s.callStack)
  const microtaskQueue = useEventLoopStore((s) => s.microtaskQueue)
  const macrotaskQueue = useEventLoopStore((s) => s.macrotaskQueue)
  const webApis = useEventLoopStore((s) => s.webApis)
  const pendingScript = useEventLoopStore((s) => s.pendingScriptQueue.length)
  const stepInputLocked = useEventLoopStore((s) => s.stepInputLocked)
  const simulateStep = useEventLoopStore((s) => s.simulateStep)
  const reset = useEventLoopStore((s) => s.reset)

  const isFinished = phase === 'finished'
  const isIdle = phase === 'idle'

  // Reloj automático: avanza ms sim (1:1) y promueve timers vencidos sin Step extra.
  useEffect(() => {
    if (webApis.length === 0 || phase === 'finished') return
    const id = globalThis.setInterval(() => {
      const s = useEventLoopStore.getState()
      if (s.webApis.length === 0 || s.phase === 'finished') return
      s.advanceWebApiSimClock(WEB_API_PARALLEL_CLOCK_SIM_MS)
      s.tryAutoPromoteWebApiTimer()
    }, WEB_API_PARALLEL_CLOCK_INTERVAL_MS)
    return () => globalThis.clearInterval(id)
  }, [webApis.length, phase])

  const handleStep = useCallback(() => {
    if (useEventLoopStore.getState().stepInputLocked) return
    if (isIdle && isBeforeFirstStep && sourceCode.trim() !== '') {
      resetIdCounter()
      loadScenarioIntoStore(useEventLoopStore.getState(), sourceCode)
      return
    }
    simulateStep()
  }, [isIdle, isBeforeFirstStep, sourceCode, simulateStep])

  const handleReset = useCallback(() => {
    reset()
  }, [reset])

  const pc = PHASE_CONFIG[phase] ?? PHASE_CONFIG['idle']

  return (
    <div className="ctrl-panel">
      <div className="ctrl-phase" style={{ borderLeftColor: pc.color }}>
        <span className="ctrl-phase__label">{pc.label}</span>
        <span className="ctrl-phase__step">Tick #{currentStep}</span>
      </div>

      <div className="ctrl-summary">
        <span className="ctrl-summary__item" data-accent="script" title="Fragmentos del script aún no entrados al stack">
          Pend.: {pendingScript}
        </span>
        <span className="ctrl-summary__item" data-accent="stack">
          Stack: {callStack.length}
        </span>
        <span className="ctrl-summary__item" data-accent="micro">
          Micro: {microtaskQueue.length}
        </span>
        <span className="ctrl-summary__item" data-accent="macro">
          Macro: {macrotaskQueue.length}
        </span>
        <span className="ctrl-summary__item" data-accent="web">
          APIs: {webApis.length}
        </span>
      </div>

      <div className="ctrl-buttons ctrl-buttons--two">
        <button
          className="ctrl-btn ctrl-btn--step"
          onClick={handleStep}
          disabled={isFinished || stepInputLocked}
          title={
            stepInputLocked
              ? 'Esperá a que termine la transición en el diagrama…'
              : 'Avanza un paso del event loop (el primer clic carga el código en la gráfica).'
          }
        >
          ⏭ Step
        </button>

        <button
          className="ctrl-btn ctrl-btn--reset"
          onClick={handleReset}
          title="Vacía la gráfica y la consola; conserva el código del editor."
        >
          🔄 Reset
        </button>
      </div>

      <FlowHintDisplay />
    </div>
  )
}

function FlowHintDisplay() {
  const flowHint = useEventLoopStore((s) => s.flowHint)

  if (!flowHint) return null

  return (
    <div className="ctrl-hint">
      <div className="ctrl-hint__arrow">
        {flowHint.from} → {flowHint.to}
      </div>
      <p className="ctrl-hint__concept">{flowHint.concept}</p>
    </div>
  )
}
