import { describe, expect, it } from 'vitest'
import { EVENT_LOOP_EXAMPLES, getDefaultExample, getExampleById } from './eventLoopExamples'
import { DIDACTIC_AUDIT } from './didacticAudit'
import { runDidacticExample } from './didacticTestHelpers'
import { instrumentSource } from '../instrumentation/instrumentImpl'
import { executeInstrumented } from '../runtime/executeUserCode'
import { flushEventLoopUntilStable } from '../runtime/eventLoopTestHelpers'
import { StepController } from '../runtime/stepController'

/**
 * Orden de consola esperado (el del motor real) para cada ejemplo.
 * Si un ejemplo se rompe o cambia su comportamiento, este test falla
 * antes de que un visitante de LinkedIn lo descubra.
 */
const EXPECTED_OUTPUT: Record<string, readonly string[]> = {
  'sync-only': ['uno', 'dos', 'tres'],
  'micro-vs-macro': ['inicio', 'fin', 'micro: then 1', 'macro: timeout'],
  'microtask-chain': ['A', 'B', 'micro 1', 'micro 2', 'micro 3'],
  'timers-order': [
    'pido 3 timers',
    'sigo trabajando',
    'timer 0ms',
    'timer 50ms',
    'timer 100ms',
  ],
  'async-await': [
    'script: arranca',
    'antes del await',
    'script: termina sync',
    'después del await (microtarea)',
  ],
  'micro-priority': [
    'sync primero',
    'micro A',
    'micro B (encadenada)',
    'macro al final',
  ],
}

/** Ejecuta un ejemplo en modo "fiel al navegador" y devuelve las líneas de consola. */
async function runExample(code: string, expectedLines: number): Promise<string[]> {
  const { code: instrumented, error } = instrumentSource(code, {
    awaitSyncProbes: false,
  })
  expect(error).toBeUndefined()
  expect(instrumented).not.toBe('')

  const ctl = new StepController()
  ctl.mode = 'run'
  await executeInstrumented(instrumented, ctl, 0)
  await flushEventLoopUntilStable(() => ctl.snapshot().consoleLines, {
    minLineCount: expectedLines,
  })
  return ctl.snapshot().consoleLines
}

describe('ejemplos del selector (event loop real)', () => {
  it('todos los ejemplos se instrumentan sin error', () => {
    for (const example of EVENT_LOOP_EXAMPLES) {
      const { code, error } = instrumentSource(example.code, {
        awaitSyncProbes: false,
      })
      expect(error, `instrumentación falló en "${example.id}"`).toBeUndefined()
      expect(code, `código vacío en "${example.id}"`).not.toBe('')
    }
  })

  it('el ejemplo por defecto existe y tiene código', () => {
    const def = getDefaultExample()
    expect(def.code.trim().length).toBeGreaterThan(0)
  })

  for (const example of EVENT_LOOP_EXAMPLES) {
    const expected = EXPECTED_OUTPUT[example.id]
    it(`"${example.title}" produce el orden de consola correcto`, async () => {
      expect(expected, `falta orden esperado para "${example.id}"`).toBeDefined()
      const lines = await runExample(example.code, expected.length)
      expect(lines).toEqual([...expected])
    })
  }
})

describe('modo didáctico (simulateStep)', () => {
  /** Ejemplos con soporte completo en Step (ver didacticExampleAudit.test.ts). */
  const DIDACTIC_EXAMPLE_IDS = [
    'sync-only',
    'micro-vs-macro',
    'microtask-chain',
    'timers-order',
    'async-await',
    'micro-priority',
  ] as const

  for (const id of DIDACTIC_EXAMPLE_IDS) {
    it(`"${id}" — simulación paso a paso`, async () => {
      const example = getExampleById(id)
      const expected = DIDACTIC_AUDIT[id].expected
      expect(example).toBeDefined()
      expect(expected).toBeDefined()
      if (!example || !expected) return
      const lines = await runDidacticExample(example.code)
      expect(lines).toEqual([...expected])
    })
  }

  it('cadena .then() produce 3 microtareas encadenadas en el AST', async () => {
    const { parseSnippetFromAst } = await import('../store/scenarioLoaderAst')
    const example = getExampleById('microtask-chain')
    expect(example).toBeDefined()
    if (!example) return
    const { scriptSequence } = parseSnippetFromAst(example.code)
    const registerThen = scriptSequence.find((t) => t.syncKind === 'registerThen')
    expect(registerThen?.microtasksToEnqueue?.map((t) => t.label)).toEqual([
      '.then → "micro 1"',
      '.then → "micro 2"',
      '.then → "micro 3"',
    ])
  })
})

describe('comentarios iniciales no son código ejecutable', () => {
  const code = getDefaultExample().code

  it('parseo AST: la primera tarea no es un comentario', async () => {
    const { parseSnippetFromAst } = await import('../store/scenarioLoaderAst')
    const { scriptSequence } = parseSnippetFromAst(code)
    expect(scriptSequence.length).toBeGreaterThan(0)
    expect(scriptSequence[0].line).toBeGreaterThan(1)
    expect(scriptSequence[0].label).not.toMatch(/^\/\//)
  })

  it('instrumentación: el primer probe apunta a console.log, no a línea 1', () => {
    const { code: instrumented, error } = instrumentSource(code, { awaitSyncProbes: true })
    expect(error).toBeUndefined()
    expect(instrumented).toMatch(/line:\s*4\b/)
  })
})
