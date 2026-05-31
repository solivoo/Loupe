import { describe, expect, it } from 'vitest'
import {
  driveStepModeToCompletion,
  finishInnerStepPauses,
  flushEventLoopUntilStable,
  instrumentDefaultSnippet,
} from './eventLoopTestHelpers.ts'
import { executeInstrumented } from './executeUserCode.ts'
import { type FlowHint, StepController } from './stepController.ts'

/** Líneas donde el modo paso hace `Pausado antes de línea N` (snippet por defecto instrumentado). */
const EXPECTED_PAUSE_LINES_DEFAULT_SNIPPET = [1, 3, 7, 11] as const

describe('granularidad modo paso (snippet por defecto)', () => {
  it('secuencia de líneas en cada Pausado: 1 → 3 → 7 → 11', async () => {
    const ctl = new StepController()
    ctl.mode = 'step'
    const code = instrumentDefaultSnippet()
    const execution = executeInstrumented(code, ctl, 0)

    const lines: number[] = []
    let lastPhase = ''
    const unsub = ctl.subscribe((s) => {
      if (s.phase === lastPhase) return
      lastPhase = s.phase
      const m = /^Pausado antes de línea (\d+)/.exec(s.phase)
      if (m) lines.push(Number(m[1]))
    })

    await driveStepModeToCompletion(ctl, execution)
    await finishInnerStepPauses(ctl, { untilLines: 4 })
    await flushEventLoopUntilStable(() => ctl.snapshot().consoleLines, {
      minLineCount: 4,
    })
    unsub()

    expect(lines).toEqual([...EXPECTED_PAUSE_LINES_DEFAULT_SNIPPET])
  })

  it('flowHint: al encolar microtarea, tubería stack → micro', async () => {
    const ctl = new StepController()
    ctl.mode = 'step'
    const hints: NonNullable<FlowHint>[] = []
    const unsub = ctl.subscribe((s) => {
      if (s.flowHint?.to === 'micro') hints.push(s.flowHint)
    })
    const code = instrumentDefaultSnippet()
    const execution = executeInstrumented(code, ctl, 0)
    await driveStepModeToCompletion(ctl, execution)
    await finishInnerStepPauses(ctl, { untilLines: 4 })
    await flushEventLoopUntilStable(() => ctl.snapshot().consoleLines, {
      minLineCount: 4,
    })
    unsub()

    expect(hints.length).toBeGreaterThan(0)
    expect(hints.some((h) => h.from === 'stack' && h.to === 'micro')).toBe(true)
  })

  it('flowHint: timer listo pasa de Web API a cola de tareas (web → task)', async () => {
    const ctl = new StepController()
    ctl.mode = 'step'
    const hints: NonNullable<FlowHint>[] = []
    const unsub = ctl.subscribe((s) => {
      if (s.flowHint?.from === 'web' && s.flowHint.to === 'task') hints.push(s.flowHint)
    })
    const code = instrumentDefaultSnippet()
    const execution = executeInstrumented(code, ctl, 0)
    await driveStepModeToCompletion(ctl, execution)
    await finishInnerStepPauses(ctl, { untilLines: 4 })
    await flushEventLoopUntilStable(() => ctl.snapshot().consoleLines, {
      minLineCount: 4,
    })
    unsub()

    expect(hints.length).toBeGreaterThan(0)
    expect(hints.some((h) => h.label.includes('callback'))).toBe(true)
  })

  it('modo paso: pausa dedicada para ver la macrotarea en cola antes del callback', async () => {
    const ctl = new StepController()
    ctl.mode = 'step'
    let sawMacroQueueStep = false
    const unsub = ctl.subscribe((s) => {
      if (s.phase.startsWith('Pausado: macrotarea en cola')) {
        sawMacroQueueStep = true
        expect(s.taskQueue.length).toBeGreaterThan(0)
      }
    })
    const code = instrumentDefaultSnippet()
    const execution = executeInstrumented(code, ctl, 0)
    await driveStepModeToCompletion(ctl, execution)
    await finishInnerStepPauses(ctl, { untilLines: 4 })
    await flushEventLoopUntilStable(() => ctl.snapshot().consoleLines, {
      minLineCount: 4,
    })
    unsub()

    expect(sawMacroQueueStep).toBe(true)
  })

  it('flowHint: microtarea ejecutándose (micro → stack)', async () => {
    const ctl = new StepController()
    ctl.mode = 'step'
    const hints: NonNullable<FlowHint>[] = []
    const unsub = ctl.subscribe((s) => {
      if (s.flowHint?.from === 'micro' && s.flowHint.to === 'stack') hints.push(s.flowHint)
    })
    const code = instrumentDefaultSnippet()
    const execution = executeInstrumented(code, ctl, 0)
    await driveStepModeToCompletion(ctl, execution)
    await finishInnerStepPauses(ctl, { untilLines: 4 })
    await flushEventLoopUntilStable(() => ctl.snapshot().consoleLines, {
      minLineCount: 4,
    })
    unsub()

    expect(hints.length).toBeGreaterThan(0)
  })
})
