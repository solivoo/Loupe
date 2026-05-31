import { parse } from '@babel/parser'
import generateImport from '@babel/generator'
import * as t from '@babel/types'
import type { Statement } from '@babel/types'
import {
  registerFunctionDeclaration,
  tryExpandFunctionCall,
  type FunctionRegistry,
} from './scenarioLoaderFunctions'
import { nextId } from './eventLoopStore'
import { parseSimpleConsoleLog } from './consoleLogPattern'
import type { ParsedScenario, Task } from './types'

type GenerateFn = (typeof import('@babel/generator'))['default']

function isRecordWithDefault(mod: unknown): mod is { default: unknown } {
  return mod !== null && typeof mod === 'object' && 'default' in mod
}

function cjsDefault<T extends (...args: never[]) => unknown>(mod: unknown): T {
  if (typeof mod === 'function') return mod as T
  if (isRecordWithDefault(mod)) {
    const d = mod.default
    if (typeof d === 'function') return d as T
  }
  throw new Error('Export default de @babel/generator no es invocable')
}

const generate = cjsDefault<GenerateFn>(generateImport)

/**
 * Parsea por AST: una tarea por sentencia de nivel superior (funciones completas,
 * cada await …, let/const, etc.). Compatible con TypeScript y top-level await.
 */
export function parseSnippetFromAst(source: string): ParsedScenario {
  const ast = parse(source, {
    sourceType: 'module',
    plugins: ['typescript', 'topLevelAwait'],
  })
  const scriptSequence: Task[] = []
  const registry: FunctionRegistry = new Map()

  for (const raw of ast.program.body) {
    for (const stmt of flattenTopLevel(raw)) {
      if (t.isEmptyStatement(stmt)) continue
      scriptSequence.push(...statementToTasks(stmt, registry))
    }
  }

  return { scriptSequence }
}

/** Import se omite; export default/named se desempaqueta a la declaración. */
function flattenTopLevel(stmt: Statement): Statement[] {
  if (t.isImportDeclaration(stmt)) return []

  if (t.isExportNamedDeclaration(stmt) && stmt.declaration && t.isStatement(stmt.declaration)) {
    return [stmt.declaration]
  }

  if (t.isExportDefaultDeclaration(stmt)) {
    const d = stmt.declaration
    if (t.isFunctionDeclaration(d) || t.isClassDeclaration(d)) {
      return [d]
    }
    if (t.isExpression(d)) {
      return [t.expressionStatement(d)]
    }
    return []
  }

  return [stmt]
}

function statementToTasks(stmt: Statement, registry: FunctionRegistry): Task[] {
  const line = stmt.loc?.start.line ?? 1

  if (t.isFunctionDeclaration(stmt)) {
    return registerFunctionDeclaration(stmt, registry, statementToTasks)
  }

  if (t.isExpressionStatement(stmt)) {
    const expanded = tryExpandFunctionCall(stmt.expression, registry)
    if (expanded) return expanded
    const pt = tryPromiseThenRegister(stmt.expression, line)
    if (pt) return [pt]
    const st = trySetTimeoutRegister(stmt.expression, line)
    if (st) return [st]
  }

  return [statementToSyncTask(stmt, line)]
}

function unwrapAwaitExpr(e: t.Expression): t.Expression {
  return t.isAwaitExpression(e) ? e.argument : e
}

type ThenCallback = {
  fn: t.ArrowFunctionExpression | t.FunctionExpression
  line: number
}

function isThenCall(expr: t.Expression): expr is t.CallExpression {
  return (
    t.isCallExpression(expr) &&
    t.isMemberExpression(expr.callee) &&
    t.isIdentifier(expr.callee.property) &&
    expr.callee.property.name === 'then'
  )
}

/** Recorre `.then().then()…` de fuera hacia dentro; devuelve callbacks en orden de ejecución. */
function collectThenChain(expr: t.Expression): ThenCallback[] | null {
  const callbacks: ThenCallback[] = []
  let current = unwrapAwaitExpr(expr)

  while (isThenCall(current)) {
    const fn = current.arguments[0]
    if (
      !fn ||
      (!t.isFunctionExpression(fn) && !t.isArrowFunctionExpression(fn))
    ) {
      return null
    }
    callbacks.unshift({
      fn,
      line: current.loc?.start.line ?? 1,
    })
    const callee = current.callee
    if (!t.isMemberExpression(callee)) return null
    if (!t.isExpression(callee.object)) return null
    current = callee.object
  }

  return callbacks.length > 0 ? callbacks : null
}

function microtaskLabelFromCallback(
  fn: t.ArrowFunctionExpression | t.FunctionExpression,
): string {
  const innerCode = generate(fn.body, { compact: true }).code
  const logText = parseSimpleConsoleLog(innerCode)
  return logText ? `.then → "${logText}"` : 'then callback'
}

function microtaskFromExpression(expr: t.Expression, line: number): Task {
  const code = generate(expr, { compact: true }).code
  const logText = parseSimpleConsoleLog(code)
  return {
    id: nextId(),
    code,
    label: logText ? `.then → "${logText}"` : code,
    type: 'microtask',
    line,
  }
}

/** Expande el cuerpo de un callback `.then`: sync + `.then()` anidados en FIFO. */
function microtasksFromCallbackFn(
  fn: t.ArrowFunctionExpression | t.FunctionExpression,
  line: number,
): Task[] {
  if (t.isBlockStatement(fn.body)) {
    const micros: Task[] = []
    for (const stmt of fn.body.body) {
      if (!t.isExpressionStatement(stmt)) continue
      const stmtLine = stmt.loc?.start.line ?? line
      const nested = tryPromiseThenRegister(stmt.expression, stmtLine)
      if (nested?.microtasksToEnqueue?.length) {
        micros.push(...nested.microtasksToEnqueue)
        continue
      }
      micros.push(microtaskFromExpression(stmt.expression, stmtLine))
    }
    if (micros.length > 0) return micros
  }

  const innerCode = generate(fn.body, { compact: true }).code
  return [
    {
      id: nextId(),
      code: innerCode,
      label: microtaskLabelFromCallback(fn),
      type: 'microtask',
      line,
    },
  ]
}

/** Una microtarea por callback en la cadena `.then().then()…`. */
function buildMicrotasksFromCallbacks(callbacks: ThenCallback[]): Task[] {
  return callbacks.flatMap(({ fn, line }) => microtasksFromCallbackFn(fn, line))
}

function tryPromiseThenRegister(expr: t.Expression, line: number): Task | null {
  const callbacks = collectThenChain(expr)
  if (!callbacks) return null

  const microtasksToEnqueue = buildMicrotasksFromCallbacks(callbacks)
  const code = generate(unwrapAwaitExpr(expr)).code
  return {
    id: nextId(),
    code: code.length > 120 ? `${code.slice(0, 117)}…` : code,
    label:
      callbacks.length > 1
        ? `Promise…then()×${callbacks.length}`
        : 'Promise…then(…)',
    type: 'sync',
    line,
    syncKind: 'registerThen',
    microtasksToEnqueue,
  }
}

function trySetTimeoutRegister(expr: t.Expression, line: number): Task | null {
  const e = unwrapAwaitExpr(expr)
  if (!t.isCallExpression(e)) return null
  if (!t.isIdentifier(e.callee) || e.callee.name !== 'setTimeout') return null
  const delayArg = e.arguments[1]
  let delay = 0
  if (t.isNumericLiteral(delayArg)) delay = delayArg.value
  const cb = e.arguments[0]
  if (
    !cb ||
    (!t.isFunctionExpression(cb) && !t.isArrowFunctionExpression(cb))
  ) {
    return null
  }
  const innerCode = generate(cb.body, { compact: true }).code
  const macroCallback: Task = {
    id: nextId(),
    code: innerCode,
    label: `setTimeout cb (${delay}ms)`,
    type: 'macrotask',
    line,
    delayMs: delay,
  }
  const code = generate(e).code
  return {
    id: nextId(),
    code: code.length > 120 ? `${code.slice(0, 117)}…` : code,
    label: `setTimeout(…, ${delay})`,
    type: 'sync',
    line,
    syncKind: 'registerTimeout',
    delayMs: delay,
    macroCallback,
  }
}

function statementToSyncTask(stmt: Statement, line: number): Task {
  const code = generate(stmt, { retainLines: false, comments: false }).code.replace(/;+\s*$/, '')
  const label = code.length > 48 ? `${code.slice(0, 45)}…` : code
  return {
    id: nextId(),
    code,
    label,
    type: 'sync',
    line,
    syncKind: 'statement',
  }
}
