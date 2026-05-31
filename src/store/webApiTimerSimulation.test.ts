import { describe, expect, it } from 'vitest'
import {
  WEB_API_DELAY_SCALE,
  WEB_API_MIN_DELAY_MS,
  WEB_API_ZERO_DELAY_SIM_MS,
  effectiveWebApiDelayMs,
  findReadyWebApiTask,
  formatDidacticTimerDelay,
  isRegisteringTimeouts,
  estimatedRealSecondsRemaining,
  WEB_API_PARALLEL_CLOCK_SIM_MS,
} from './webApiTimerSimulation'

describe('webApiTimerSimulation (escala didáctica)', () => {
  it('delay 0 usa el mínimo del motor × escala', () => {
    expect(effectiveWebApiDelayMs(0)).toBe(WEB_API_ZERO_DELAY_SIM_MS)
    expect(effectiveWebApiDelayMs(undefined)).toBe(WEB_API_ZERO_DELAY_SIM_MS)
    expect(WEB_API_ZERO_DELAY_SIM_MS).toBe(WEB_API_MIN_DELAY_MS * WEB_API_DELAY_SCALE)
  })

  it('delay N>0 se multiplica por la escala', () => {
    expect(effectiveWebApiDelayMs(50)).toBe(50 * WEB_API_DELAY_SCALE)
    expect(effectiveWebApiDelayMs(100)).toBe(100 * WEB_API_DELAY_SCALE)
    expect(effectiveWebApiDelayMs(1000)).toBe(1000 * WEB_API_DELAY_SCALE)
  })

  it('preserva el orden relativo del ejemplo timers-order (como DevTools)', () => {
    const delays = [100, 0, 50].map(effectiveWebApiDelayMs)
    expect(delays[1]).toBeLessThan(delays[2])
    expect(delays[2]).toBeLessThan(delays[0])
  })

  it('formatDidacticTimerDelay muestra código → sim', () => {
    expect(formatDidacticTimerDelay(0)).toBe(
      `0 (~${WEB_API_MIN_DELAY_MS} ms motor) × ${WEB_API_DELAY_SCALE} → ${WEB_API_ZERO_DELAY_SIM_MS} ms sim`,
    )
    expect(formatDidacticTimerDelay(100)).toBe(
      `100 × ${WEB_API_DELAY_SCALE} → ${100 * WEB_API_DELAY_SCALE} ms sim`,
    )
  })

  it('findReadyWebApiTask elige el que vence antes (mismo registeredAtSim)', () => {
    const base = { type: 'webapi' as const, code: '', registeredAtSim: 0 }
    const webApis = [
      { ...base, id: 'a', label: '100', delayMs: 100 },
      { ...base, id: 'b', label: '0', delayMs: 0 },
      { ...base, id: 'c', label: '50', delayMs: 50 },
    ]
    expect(findReadyWebApiTask(webApis, 39)).toBeUndefined()
    expect(findReadyWebApiTask(webApis, 40)?.label).toBe('0')
    const after0 = webApis.filter((t) => t.label !== '0')
    expect(findReadyWebApiTask(after0, 500)?.label).toBe('50')
    const after50 = after0.filter((t) => t.label !== '50')
    expect(findReadyWebApiTask(after50, 1000)?.label).toBe('100')
  })

  it('estimatedRealSecondsRemaining refleja el reloj paralelo lento', () => {
    expect(estimatedRealSecondsRemaining(WEB_API_PARALLEL_CLOCK_SIM_MS)).toBe(0.1)
    expect(estimatedRealSecondsRemaining(500)).toBe(5)
  })

  it('isRegisteringTimeouts detecta setTimeout pendientes en cola o stack', () => {
    expect(
      isRegisteringTimeouts({
        pendingScriptQueue: [{ syncKind: 'registerTimeout' }],
        callStack: [],
      }),
    ).toBe(true)
    expect(
      isRegisteringTimeouts({
        pendingScriptQueue: [],
        callStack: [{ syncKind: 'registerTimeout' }],
      }),
    ).toBe(true)
    expect(
      isRegisteringTimeouts({
        pendingScriptQueue: [{ syncKind: 'statement' }],
        callStack: [],
      }),
    ).toBe(false)
  })
})
