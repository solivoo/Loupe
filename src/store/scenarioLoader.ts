import type { EventLoopStore, ParsedScenario } from './types'
import { parseSnippetFromAst } from './scenarioLoaderAst'
import { parseSnippetLegacy } from './scenarioLoaderLegacy'

/**
 * Parsea el snippet: primero por AST (sentencias de nivel superior, TS, top-level await);
 * si falla, usa el parseo línea a línea anterior.
 */
export function parseSnippet(source: string): ParsedScenario {
  const trimmed = source.trim()
  if (trimmed.length === 0) {
    return { scriptSequence: [] }
  }
  try {
    const ast = parseSnippetFromAst(source)
    if (ast.scriptSequence.length > 0) {
      return ast
    }
  } catch {
    /* fallback */
  }
  return parseSnippetLegacy(source)
}

export function loadScenarioIntoStore(
  store: Pick<
    EventLoopStore,
    | 'setPhase' | 'setSourceCode' | 'setPendingScriptQueue'
  >,
  source: string,
): ParsedScenario {
  const scenario = parseSnippet(source)

  store.setSourceCode(source)
  store.setPendingScriptQueue([...scenario.scriptSequence])
  store.setPhase('executing-sync')

  return scenario
}
