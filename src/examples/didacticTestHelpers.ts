import { vi } from 'vitest'
import { FLOW_PIPE_TO_CONSOLE_MS } from '../runtime/flowPipeTiming'

export async function runDidacticExample(
  code: string,
  maxSteps = 500,
): Promise<string[]> {
  const { useEventLoopStore, resetIdCounter } = await import('../store/eventLoopStore')
  const { loadScenarioIntoStore } = await import('../store/scenarioLoader')

  vi.useFakeTimers()
  resetIdCounter()
  const store = useEventLoopStore.getState()
  store.reset()
  loadScenarioIntoStore(store, code)

  for (let i = 0; i < maxSteps; i++) {
    const state = useEventLoopStore.getState()
    if (state.phase === 'finished') break
    state.simulateStep()
    if (useEventLoopStore.getState().stepInputLocked) {
      vi.advanceTimersByTime(FLOW_PIPE_TO_CONSOLE_MS + 50)
    }
  }

  vi.useRealTimers()
  return useEventLoopStore.getState().consoleLogs.map((l) => l.text)
}
