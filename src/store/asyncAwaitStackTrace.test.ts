import { describe, expect, it } from 'vitest'
import { getExampleById } from '../examples/eventLoopExamples'
import { useEventLoopStore, resetIdCounter } from './eventLoopStore'
import { loadScenarioIntoStore } from './scenarioLoader'

function traceCallStack(code: string, maxSteps = 30): string[] {
  resetIdCounter()
  const store = useEventLoopStore.getState()
  store.reset()
  loadScenarioIntoStore(store, code)

  const trace: string[][] = []
  for (let i = 0; i < maxSteps; i++) {
    const s = useEventLoopStore.getState()
    if (s.phase === 'finished') break
    trace.push(s.callStack.map((t) => `${t.label}${t.syncKind === 'functionFrame' ? '*' : ''}`))
    s.simulateStep()
  }
  return trace.map((stack, i) => `${i + 1}: [${stack.join(' | ') || '(vacío)'}]`)
}

describe('async-await call stack', () => {
  it('main() entra una sola vez y el frame permanece hasta el await', () => {
    const example = getExampleById('async-await')
    expect(example).toBeDefined()
    if (!example) return

    const report = traceCallStack(example.code).join('\n')

    expect(report).toContain('main()* | console.log("antes del await")')
    expect(report).toContain('main()* | await Promise.resolve()')
    expect(report).not.toContain('← return main()')

    const stacksWithTwoMains = report
      .split('\n')
      .filter((line) => (line.match(/main\(\)/g) ?? []).length > 1)
    expect(stacksWithTwoMains).toEqual([])
  })
})
