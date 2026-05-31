import type { Task } from './types'

/**
 * Escala didáctica del reloj en Web APIs.
 * Delay N en código → N × este factor en ms simulados.
 */
export const WEB_API_DELAY_SCALE = 10

/**
 * Mínimo del motor (HTML ~4 ms). setTimeout(0) no es instantáneo: es el delay mínimo.
 * En simulador: {@link WEB_API_MIN_DELAY_MS} × {@link WEB_API_DELAY_SCALE} ms sim.
 */
export const WEB_API_MIN_DELAY_MS = 4

/** Delay efectivo simulado para setTimeout(…, 0). */
export const WEB_API_ZERO_DELAY_SIM_MS = WEB_API_MIN_DELAY_MS * WEB_API_DELAY_SCALE

/**
 * Reloj paralelo en Web APIs (mismo tick en UI automática y Step manual).
 *
 * Cada {@link WEB_API_PARALLEL_CLOCK_INTERVAL_MS} ms **reales** avanzan
 * {@link WEB_API_PARALLEL_CLOCK_SIM_MS} ms **simulados** (~1:10 → lento y legible).
 *
 * Duración visible aproximada:
 * - `setTimeout(0)`  → 40 ms sim  ≈ 0,4 s
 * - `setTimeout(50)` → 500 ms sim ≈ 5 s
 * - `setTimeout(100)`→ 1000 ms sim ≈ 10 s
 */
export const WEB_API_PARALLEL_CLOCK_INTERVAL_MS = 100
export const WEB_API_PARALLEL_CLOCK_SIM_MS = 10

/** Con Play activo, cada tick avanza más tiempo simulado. */
export const WEB_API_SIM_MS_AUTO_STEP = 1200

/**
 * Delay efectivo hasta que el callback puede salir de Web APIs hacia macrotareas.
 * - 0 o negativo → mínimo del motor × escala (~4 × 10 = 40 ms sim).
 * - &gt; 0 → declarado × {@link WEB_API_DELAY_SCALE} (ej. 100 → 1000 ms sim).
 */
export function effectiveWebApiDelayMs(delayMs: number | undefined): number {
  const declared = delayMs ?? 0
  if (declared <= 0) return WEB_API_ZERO_DELAY_SIM_MS
  return declared * WEB_API_DELAY_SCALE
}

/** Etiqueta didáctica: delay en código → tiempo simulado en Web APIs. */
export function formatDidacticTimerDelay(declaredMs: number | undefined): string {
  const declared = declaredMs ?? 0
  const effective = effectiveWebApiDelayMs(declaredMs)
  if (declared <= 0) {
    return `0 (~${WEB_API_MIN_DELAY_MS} ms motor) × ${WEB_API_DELAY_SCALE} → ${effective} ms sim`
  }
  return `${declared} × ${WEB_API_DELAY_SCALE} → ${effective} ms sim`
}

export function getWebApiReadyAtSim(task: Task): number {
  const start = task.registeredAtSim ?? 0
  return start + effectiveWebApiDelayMs(task.delayMs)
}

export function findReadyWebApiTask(webApis: Task[], simNow: number): Task | undefined {
  const ready = webApis
    .map((t, i) => ({ t, i, readyAt: getWebApiReadyAtSim(t) }))
    .filter((x) => simNow >= x.readyAt)
  if (ready.length === 0) return undefined
  ready.sort((a, b) => a.readyAt - b.readyAt || a.i - b.i)
  return ready[0]?.t
}

export function formatTimerPendingLabel(webApis: Task[], simNow: number): string {
  const next = webApis
    .map((t) => ({
      t,
      readyAt: getWebApiReadyAtSim(t),
      rem: Math.max(0, getWebApiReadyAtSim(t) - simNow),
    }))
    .sort((a, b) => a.rem - b.rem || a.t.label.localeCompare(b.t.label))[0]
  if (!next) return 'Timer pendiente…'
  const ms = Math.ceil(next.rem)
  return ms > 0
    ? `Reloj automático (~${ms} ms sim restantes)`
    : 'Timer listo — pasa a macrotareas…'
}

/** Aún hay setTimeout por registrar en el script síncrono (cola o stack). */
export function isRegisteringTimeouts(state: {
  pendingScriptQueue: readonly { syncKind?: Task['syncKind'] }[]
  callStack: readonly { syncKind?: Task['syncKind'] }[]
}): boolean {
  const isTimeout = (t: { syncKind?: Task['syncKind'] }) => t.syncKind === 'registerTimeout'
  return state.pendingScriptQueue.some(isTimeout) || state.callStack.some(isTimeout)
}

/** Convierte ms sim restantes en segundos reales aproximados (para la UI). */
export function estimatedRealSecondsRemaining(remainingSimMs: number): number {
  if (remainingSimMs <= 0) return 0
  const ticks = remainingSimMs / WEB_API_PARALLEL_CLOCK_SIM_MS
  return (ticks * WEB_API_PARALLEL_CLOCK_INTERVAL_MS) / 1000
}

