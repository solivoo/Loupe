import { describe, expect, it } from 'vitest'
import { getExampleById } from '../examples/eventLoopExamples'
import { useEventLoopStore, resetIdCounter } from './eventLoopStore'
import { loadScenarioIntoStore } from './scenarioLoader'
import { effectiveWebApiDelayMs } from './webApiTimerSimulation'

describe('tryAutoPromoteWebApiTimer', () => {
  it('encola timer listo aunque el sync aún tenga más setTimeout pendientes', () => {
    resetIdCounter()
    const store = useEventLoopStore.getState()
    store.reset()
    loadScenarioIntoStore(store, getExampleById('timers-order')!.code)

    let guard = 0
    while (useEventLoopStore.getState().webApis.length === 0 && guard++ < 80) {
      useEventLoopStore.getState().simulateStep()
    }

    const mid = useEventLoopStore.getState()
    expect(mid.webApis.length).toBeGreaterThan(0)
    expect(
      mid.pendingScriptQueue.some((t) => t.syncKind === 'registerTimeout'),
    ).toBe(true)

    const readyDelay = effectiveWebApiDelayMs(mid.webApis[0]?.delayMs)
    useEventLoopStore.getState().advanceWebApiSimClock(readyDelay)

    const promoted = useEventLoopStore.getState().tryAutoPromoteWebApiTimer()
    expect(promoted).toBe(true)
    expect(useEventLoopStore.getState().macrotaskQueue.length).toBe(1)
    expect(useEventLoopStore.getState().webApis.length).toBe(mid.webApis.length - 1)
  })
})
