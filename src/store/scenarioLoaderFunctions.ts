import generateImport from '@babel/generator'
import * as t from '@babel/types'
import type { Statement } from '@babel/types'
import { nextId } from './eventLoopStore'
import { parseSimpleConsoleLog } from './consoleLogPattern'
import type { Task } from './types'

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

export type FunctionRegistry = Map<string, Task[]>

function cloneTask(task: Task): Task {
  return {
    ...task,
    id: nextId(),
    microtasksToEnqueue: task.microtasksToEnqueue?.map(cloneTask),
    macroCallback: task.macroCallback ? cloneTask(task.macroCallback) : undefined,
    linkedMicrotask: task.linkedMicrotask ? cloneTask(task.linkedMicrotask) : undefined,
  }
}

export function cloneTasks(tasks: readonly Task[]): Task[] {
  return tasks.map(cloneTask)
}

function expressionToMicrotask(expr: t.Expression, line: number): Task {
  const code = generate(expr, { compact: true }).code
  const logText = parseSimpleConsoleLog(code)
  return {
    id: nextId(),
    code,
    label: logText ? `await → "${logText}"` : 'continuación tras await',
    type: 'microtask',
    line,
  }
}

function continuationToMicrotasks(stmts: Statement[]): Task[] {
  const micros: Task[] = []
  for (const stmt of stmts) {
    if (t.isExpressionStatement(stmt)) {
      micros.push(expressionToMicrotask(stmt.expression, stmt.loc?.start.line ?? 1))
      continue
    }
    const line = stmt.loc?.start.line ?? 1
    const code = generate(stmt, { compact: true }).code.replace(/;+\s*$/, '')
    micros.push({
      id: nextId(),
      code,
      label: code.length > 48 ? `${code.slice(0, 45)}…` : code,
      type: 'microtask',
      line,
    })
  }
  return micros
}

function createRegisterAwaitTask(
  awaitExpr: t.AwaitExpression,
  microtasks: Task[],
  line: number,
): Task {
  const argCode = generate(awaitExpr.argument, { compact: true }).code
  return {
    id: nextId(),
    code: generate(awaitExpr).code,
    label: `await ${argCode.length > 36 ? `${argCode.slice(0, 35)}…` : argCode}`,
    type: 'sync',
    line,
    syncKind: 'registerAwait',
    microtasksToEnqueue: microtasks,
  }
}

/** Cuerpo de función → tareas; el código tras `await` se modela como microtareas. */
export function functionBodyToTasks(
  block: t.BlockStatement,
  registry: FunctionRegistry,
  parseStatement: (stmt: Statement, registry: FunctionRegistry) => Task[],
): Task[] {
  const tasks: Task[] = []
  const stmts = block.body

  for (let i = 0; i < stmts.length; i++) {
    const stmt = stmts[i]
    if (t.isExpressionStatement(stmt) && t.isAwaitExpression(stmt.expression)) {
      const microtasks = continuationToMicrotasks(stmts.slice(i + 1))
      tasks.push(
        createRegisterAwaitTask(
          stmt.expression,
          microtasks,
          stmt.loc?.start.line ?? 1,
        ),
      )
      return tasks
    }
    tasks.push(...parseStatement(stmt, registry))
  }

  return tasks
}

export function registerFunctionDeclaration(
  stmt: t.FunctionDeclaration,
  registry: FunctionRegistry,
  parseStatement: (stmt: Statement, registry: FunctionRegistry) => Task[],
): Task[] {
  const name = stmt.id?.name
  if (name && stmt.body) {
    registry.set(name, functionBodyToTasks(stmt.body, registry, parseStatement))
  }
  return []
}

export function createInvokeFunctionTask(
  name: string,
  body: readonly Task[],
  line: number,
): Task {
  const cloned = cloneTasks(body)
  cloned.push({
    id: nextId(),
    label: `← return ${name}()`,
    code: '',
    type: 'sync',
    line,
    syncKind: 'returnFromFunction',
  })
  return {
    id: nextId(),
    code: `${name}()`,
    label: `${name}()`,
    type: 'sync',
    line,
    syncKind: 'invokeFunction',
    functionBodyTasks: cloned,
  }
}

export function tryExpandFunctionCall(
  expr: t.Expression,
  registry: FunctionRegistry,
): Task[] | null {
  if (!t.isCallExpression(expr)) return null
  if (!t.isIdentifier(expr.callee)) return null
  const body = registry.get(expr.callee.name)
  if (!body) return null
  const line = expr.loc?.start.line ?? 1
  return [createInvokeFunctionTask(expr.callee.name, body, line)]
}
