import { describe, expect, it } from 'vitest'
import {
  driveStepModeToCompletion,
  finishInnerStepPauses,
  flushEventLoopUntilStable,
  instrumentDefaultSnippet,
  runDefaultSnippetRunMode,
} from './eventLoopTestHelpers.ts'
import { executeInstrumented } from './executeUserCode.ts'
import { StepController } from './stepController.ts'

/** Orden canónico del motor (modo fluido: `awaitSyncProbes: false` + `ctl.mode = 'run'`). */
const EXPECTED_CONSOLE_RUN = [
  'inicio',
  'fin',
  'micro: then 1',
  'macro: timeout',
] as const

/**
 * Modo paso: sigue habiendo `await __loupeProbe` en cada línea; entre líneas el motor puede
 * ejecutar microtareas antes del siguiente `console.log` síncrono (artefacto pedagógico).
 */
const EXPECTED_CONSOLE_STEP = [
  'inicio',
  'micro: then 1',
  'fin',
  'macro: timeout',
] as const

describe('orden del event loop (snippet por defecto)', () => {
  it('happy-dom: then reacciona tras restaurar prototype.then', async () => {
    const log: string[] = []
    const origThen = Promise.prototype.then
    Promise.prototype.then = function promiseThenShim(
      this: Promise<unknown>,
      onFulfilled: Parameters<typeof origThen>[0],
      onRejected: Parameters<typeof origThen>[1],
    ) {
      return origThen.call(
        this,
        typeof onFulfilled === 'function'
          ? (...args: unknown[]) => {
              log.push('wrapped')
              return (onFulfilled as (...a: unknown[]) => unknown)(...args)
            }
          : onFulfilled,
        onRejected,
      ) as ReturnType<typeof origThen>
    } as typeof Promise.prototype.then
    Promise.resolve().then(() => {
      log.push('inner')
    })
    Promise.prototype.then = origThen
    await new Promise<void>((r) => queueMicrotask(r))
    expect(log).toEqual(['wrapped', 'inner'])
  })

  it('modo fluido: consola igual al orden canónico del navegador', async () => {
    const ctl = await runDefaultSnippetRunMode()
    expect(ctl.snapshot().consoleLines).toEqual([...EXPECTED_CONSOLE_RUN])
  })

  it('modo paso a paso: fin y micro antes que macro', async () => {
    const ctl = new StepController()
    ctl.mode = 'step'
    const code = instrumentDefaultSnippet()
    const execution = executeInstrumented(code, ctl, 0)
    await driveStepModeToCompletion(ctl, execution)
    await finishInnerStepPauses(ctl, { untilLines: 4 })
    await flushEventLoopUntilStable(() => ctl.snapshot().consoleLines, {
      minLineCount: 4,
    })

    const lines = ctl.snapshot().consoleLines
    expect(lines).toEqual([...EXPECTED_CONSOLE_STEP])

    const iFin = lines.indexOf('fin')
    const iMicro = lines.indexOf('micro: then 1')
    const iMacro = lines.indexOf('macro: timeout')
    expect(iFin).toBeGreaterThanOrEqual(0)
    expect(iMacro).toBeGreaterThanOrEqual(0)
    expect(iFin).toBeLessThan(iMacro)
    expect(iMicro).toBeLessThan(iMacro)
  })

  it('modo paso a paso: hay pausa con Web API (timer) antes de log de macro', async () => {
    const ctl = new StepController()
    ctl.mode = 'step'
    let lastPhase = ''
    const marks: Array<{ phase: string; web: number; hasMacro: boolean }> = []
    const unsub = ctl.subscribe((s) => {
      if (s.phase === lastPhase) return
      lastPhase = s.phase
      marks.push({
        phase: s.phase,
        web: s.webTimers.length,
        hasMacro: s.consoleLines.includes('macro: timeout'),
      })
    })

    const code = instrumentDefaultSnippet()
    const execution = executeInstrumented(code, ctl, 0)
    await driveStepModeToCompletion(ctl, execution)
    await finishInnerStepPauses(ctl, { untilLines: 4 })
    await flushEventLoopUntilStable(() => ctl.snapshot().consoleLines, {
      minLineCount: 4,
    })
    unsub()

    const sawTimerBeforeMacro = marks.some(
      (m) =>
        m.phase.startsWith('Pausado') &&
        m.web > 0 &&
        !m.hasMacro &&
        m.phase.includes('línea 7'),
    )
    expect(sawTimerBeforeMacro).toBe(true)
  })
})
