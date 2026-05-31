import type { EventLoopStore } from './types'
import { findReadyWebApiTask, effectiveWebApiDelayMs } from './webApiTimerSimulation'
import { FLOW_PIPE_TO_CONSOLE_MS } from '../runtime/flowPipeTiming'

let didacticStepLockTimer: ReturnType<typeof globalThis.setTimeout> | null = null

type PromoteWebApiOptions = {
  /** Congela Step mientras se ve la tubería (solo promociones manuales). */
  lockStep?: boolean
}

/** Promueve un timer listo de Web APIs a la cola macro (un solo paso de estado). */
export function promoteWebApiTimerToMacro(
  set: (partial: Partial<EventLoopStore>) => void,
  get: () => EventLoopStore,
  simNow: number,
  nextStep: number,
  options: PromoteWebApiOptions = {},
): boolean {
  const { lockStep = true } = options
  const s = get()
  const vencido = findReadyWebApiTask(s.webApis, simNow)
  if (!vencido) return false
  const delay = vencido.delayMs ?? 0
  const effective = effectiveWebApiDelayMs(delay)
  const patch: Partial<EventLoopStore> = {
    currentStep: nextStep,
    phase: 'timer-callback-queued',
  }
  if (lockStep) {
    patch.flowHint = {
      from: 'webapis',
      to: 'macrotask',
      label:
        delay <= 0
          ? `Timer cumplido (0 → ${effective} ms sim) → cola de macrotareas`
          : `Timer cumplido (${delay} ms × escala → ${effective} ms sim) → cola macro`,
      concept:
        'Web APIs atiende el timer en paralelo al hilo principal: el contador arranca al registrar setTimeout y, al vencer, el callback entra en macrotareas aunque el sync siga corriendo.',
    }
  }
  set(patch)
  get().resolveWebApi(vencido.id)
  get().enqueueMacrotask({ ...vencido, type: 'macrotask' })
  if (lockStep) armDidacticStepLock(set)
  return true
}

/** Congela Step en modo didáctico mientras se ve la transición en el diagrama. */
export function armDidacticStepLock(set: (partial: Partial<EventLoopStore>) => void): void {
  set({ stepInputLocked: true })
  if (didacticStepLockTimer !== null) {
    globalThis.clearTimeout(didacticStepLockTimer)
  }
  didacticStepLockTimer = globalThis.setTimeout(() => {
    didacticStepLockTimer = null
    set({ stepInputLocked: false })
  }, FLOW_PIPE_TO_CONSOLE_MS)
}

export function clearDidacticStepLockTimer(): void {
  if (didacticStepLockTimer !== null) {
    globalThis.clearTimeout(didacticStepLockTimer)
    didacticStepLockTimer = null
  }
}
