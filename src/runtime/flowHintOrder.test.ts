import { describe, expect, it } from 'vitest'
import { flushEventLoopUntilStable, instrumentDefaultSnippet } from './eventLoopTestHelpers.ts'
import { executeInstrumented } from './executeUserCode.ts'
import { type FlowHint, StepController } from './stepController.ts'

function pipeKey(h: FlowHint): string {
  if (!h) return 'null'
  return `${h.from}->${h.to}`
}

describe('orden canónico de flowHint (tuberías)', () => {
  it('el primer flowHint no nulo es stack → consola (primer console.log)', async () => {
    const ctl = new StepController()
    ctl.mode = 'run'
    let first: FlowHint | 'unset' = 'unset'
    ctl.subscribe((s) => {
      if (first === 'unset' && s.flowHint !== null) {
        first = s.flowHint
      }
    })
    const code = instrumentDefaultSnippet()
    await executeInstrumented(code, ctl, 0)
    await flushEventLoopUntilStable(() => ctl.snapshot().consoleLines, { minLineCount: 4 })

    expect(first).not.toBe('unset')
    expect(first).toEqual(
      expect.objectContaining({
        from: 'stack',
        to: 'console',
        label: 'console.log',
      }),
    )
  })

  it('modo fluido: encolar micro (stack→micro) antes de ejecutarla (micro→stack)', async () => {
    const ctl = new StepController()
    ctl.mode = 'run'
    const seq: string[] = []
    let last = ''
    ctl.subscribe((s) => {
      const k = pipeKey(s.flowHint)
      if (k !== last) {
        last = k
        seq.push(k)
      }
    })
    const code = instrumentDefaultSnippet()
    await executeInstrumented(code, ctl, 0)
    await flushEventLoopUntilStable(() => ctl.snapshot().consoleLines, { minLineCount: 4 })

    const iMicroIn = seq.indexOf('stack->micro')
    const iMicroRun = seq.indexOf('micro->stack')
    expect(iMicroIn).toBeGreaterThanOrEqual(0)
    expect(iMicroRun).toBeGreaterThanOrEqual(0)
    expect(iMicroIn).toBeLessThan(iMicroRun)
  })

  it('modo fluido: la secuencia no empieza por micro→stack (amarillo es después de encolar)', async () => {
    const ctl = new StepController()
    ctl.mode = 'run'
    const seq: string[] = []
    let last = ''
    ctl.subscribe((s) => {
      const k = pipeKey(s.flowHint)
      if (k !== last) {
        last = k
        seq.push(k)
      }
    })
    await executeInstrumented(instrumentDefaultSnippet(), ctl, 0)
    await flushEventLoopUntilStable(() => ctl.snapshot().consoleLines, { minLineCount: 4 })

    expect(seq[0]).toBe('null')
    const firstNonNull = seq.find((p) => p !== 'null')
    expect(firstNonNull).toBe('stack->console')
    const idxYellow = seq.indexOf('micro->stack')
    const idxFirst = seq.indexOf('stack->console')
    expect(idxYellow).toBeGreaterThan(idxFirst)
  })
})
