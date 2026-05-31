import { describe, expect, it } from 'vitest'
import { parseSnippetFromAst } from './scenarioLoaderAst'
import { getExampleById } from '../examples/eventLoopExamples'

describe('scenarioLoaderAst', () => {
  it('micro-vs-macro: setTimeout con cuerpo en bloque y Promise.then', () => {
    const example = getExampleById('micro-vs-macro')
    expect(example).toBeDefined()
    if (!example) return

    const { scriptSequence } = parseSnippetFromAst(example.code)
    const labels = scriptSequence.map((t) => t.label)

    expect(labels).toContain('console.log("inicio")')
    expect(labels).toContain('Promise…then(…)')
    expect(labels).toContain('setTimeout(…, 0)')
    expect(labels).toContain('console.log("fin")')

    const timeout = scriptSequence.find((t) => t.syncKind === 'registerTimeout')
    expect(timeout?.macroCallback?.code).toMatch(/macro: timeout/)
    expect(timeout?.macroCallback?.delayMs).toBe(0)

    const promise = scriptSequence.find((t) => t.syncKind === 'registerThen')
    expect(promise?.microtasksToEnqueue?.[0]?.code).toMatch(/micro: then 1/)
  })

  it('async-await: declara main, expande main() e encola micro tras await', () => {
    const example = getExampleById('async-await')
    expect(example).toBeDefined()
    if (!example) return

    const { scriptSequence } = parseSnippetFromAst(example.code)
    const labels = scriptSequence.map((t) => t.label)

    expect(labels[0]).toContain('script: arranca')
    expect(labels).toContain('main()')
    expect(labels.at(-1)).toContain('script: termina sync')

    const invoke = scriptSequence.find((t) => t.syncKind === 'invokeFunction')
    expect(invoke?.functionBodyTasks?.some((t) => t.code.includes('antes del await'))).toBe(true)
    const awaitTask = invoke?.functionBodyTasks?.find((t) => t.syncKind === 'registerAwait')
    expect(awaitTask?.microtasksToEnqueue?.[0]?.code).toMatch(/después del await/)
  })

  it('micro-priority: .then anidado dentro del callback del .then exterior', () => {
    const example = getExampleById('micro-priority')
    expect(example).toBeDefined()
    if (!example) return

    const { scriptSequence } = parseSnippetFromAst(example.code)
    const registerThen = scriptSequence.find((t) => t.syncKind === 'registerThen')
    expect(registerThen?.microtasksToEnqueue?.map((t) => t.label)).toEqual([
      '.then → "micro A"',
      '.then → "micro B (encadenada)"',
    ])
  })
})
