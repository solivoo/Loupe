import { describe, expect, it } from 'vitest'
import { EVENT_LOOP_EXAMPLES } from './eventLoopExamples'
import { DIDACTIC_AUDIT, EXAMPLE_SELECTOR_ORDER } from './didacticAudit'
import { runDidacticExample } from './didacticTestHelpers'

describe('auditoría didáctica — orden del selector', () => {
  it('el array EVENT_LOOP_EXAMPLES sigue la progresión 1→6 de los comentarios', () => {
    const numbers = EVENT_LOOP_EXAMPLES.map((e) => {
      const match = /^\/\/\s*(\d+)\)/m.exec(e.code)
      return match ? Number(match[1]) : null
    })
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('hay exactamente 6 ejemplos en el orden del dropdown', () => {
    expect(EVENT_LOOP_EXAMPLES.map((e) => e.id)).toEqual([...EXAMPLE_SELECTOR_ORDER])
  })

  for (const example of EVENT_LOOP_EXAMPLES) {
    it(`[${example.id}] modo didáctico`, async () => {
      const audit = DIDACTIC_AUDIT[example.id]
      expect(audit, `falta entrada en DIDACTIC_AUDIT para "${example.id}"`).toBeDefined()
      const lines = await runDidacticExample(example.code)

      if (audit.expected === null) {
        expect(lines).toMatchSnapshot()
        return
      }

      expect(lines, audit.note ?? example.concept).toEqual([...audit.expected])
    })
  }
})
