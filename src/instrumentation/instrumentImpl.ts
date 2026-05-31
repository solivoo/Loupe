import { parse } from '@babel/parser'
import * as ts from 'typescript'
import traverseImport from '@babel/traverse'
import generateImport from '@babel/generator'
import * as t from '@babel/types'
import type { NodePath } from '@babel/traverse'

type TraverseFn = typeof import('@babel/traverse').default
type GenerateFn = (typeof import('@babel/generator'))['default']

/** CJS empaquetado para el navegador: el default a veces queda en `.default`. */
function cjsDefault<T extends (...args: never[]) => unknown>(mod: unknown): T {
  if (typeof mod === 'function') return mod as T
  if (mod && typeof mod === 'object' && 'default' in mod) {
    const d = (mod as { default: unknown }).default
    if (typeof d === 'function') return d as T
  }
  throw new Error('Export default de Babel no es invocable')
}

const traverse = cjsDefault<TraverseFn>(traverseImport)
const generate = cjsDefault<GenerateFn>(generateImport)

/** Si el callback del probe es `async` sin necesidad, `await result` en makeProbe cede turno y las microtareas (.then) pueden ejecutarse antes de la siguiente línea síncrona. */
function expressionContainsAwait(expr: t.Expression): boolean {
  let found = false
  const f = t.file(t.program([t.expressionStatement(expr)], [], 'module'))
  traverse(f, {
    AwaitExpression() {
      found = true
    },
  })
  return found
}

/**
 * Evita transpilar JS puro: `transpileModule` puede insertar líneas y romper `loc`/tests.
 */
function likelyTypeScriptSource(src: string): boolean {
  if (/\b(interface|type|enum|namespace|declare|satisfies)\b/.test(src)) return true
  if (/\b[\w$]+\s*<[\w\s,.[\]|&]+>\s*\(/.test(src)) return true
  if (/:\s*(?:void|never|any|unknown|Promise|Readonly|Record|Pick|Omit)\b/.test(src))
    return true
  if (/\)\s*:\s*\S/.test(src)) return true
  if (/!\s*:\s*\S/.test(src)) return true
  if (/\b(let|const|var)\s+[\w$]+\s*:\s*\S+/.test(src)) return true
  return false
}

/**
 * Quita anotaciones TS/generics para que el cuerpo generado sea JS válido en `new Function`
 * (el generador de Babel puede volcar `: Tipo` si el AST sigue siendo TypeScript).
 */
function stripTypeScriptSyntax(src: string): string {
  if (!likelyTypeScriptSource(src)) return src
  try {
    const { outputText } = ts.transpileModule(src, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ESNext,
        jsx: ts.JsxEmit.Preserve,
        isolatedModules: true,
      },
      fileName: 'snippet.tsx',
    })
    return outputText
  } catch {
    return src
  }
}

/** Demora estática de setTimeout para vista previa en Web APIs (solo literal u omisión → 0). */
/** `Promise.resolve(...)` — creación síncrona de una promesa (a menudo ya cumplida). */
function isPromiseResolveCall(expr: t.Expression): boolean {
  if (!t.isCallExpression(expr)) return false
  const { callee } = expr
  if (!t.isMemberExpression(callee)) return false
  if (callee.computed) return false
  if (!t.isIdentifier(callee.object, { name: 'Promise' })) return false
  if (!t.isIdentifier(callee.property, { name: 'resolve' })) return false
  return true
}

/**
 * Tras `let x = Promise.resolve()`, emite nota didáctica en el runtime (no es una microtarea FIFO).
 */
function didacticPromiseResolveNote(stmt: t.VariableDeclaration): t.ExpressionStatement | null {
  if (stmt.declarations.length !== 1) return null
  const d = stmt.declarations[0]
  if (!t.isIdentifier(d.id) || d.init == null) return null
  if (!isPromiseResolveCall(d.init)) return null
  const name = d.id.name
  return t.expressionStatement(
    t.callExpression(
      t.memberExpression(t.identifier('__loupeRt'), t.identifier('notePromiseResolved')),
      [t.stringLiteral(name)],
    ),
  )
}

function pendingTimerFromExpr(expr: t.Expression): number | undefined {
  if (!t.isCallExpression(expr)) return undefined
  const { callee } = expr
  if (!t.isIdentifier(callee) || callee.name !== 'setTimeout') return undefined
  const delayArg = expr.arguments[1]
  if (delayArg === undefined) return 0
  if (t.isNumericLiteral(delayArg)) return delayArg.value
  return undefined
}

/**
 * Nombres de callee que representan APIs asíncronas del event loop.
 * Los callbacks pasados a estas funciones NO deben instrumentarse internamente
 * porque el runtime (wrapHandler / buildRuntime.setTimeout) ya gestiona su
 * visualización en la UI. Instrumentarlos causaría gates anidados y deadlock.
 */
const ASYNC_API_CALLEES = new Set(['setTimeout', 'setInterval', 'queueMicrotask'])

/**
 * Nombres de método en cadena que son APIs asíncronas de Promise.
 * Ejemplo: `Promise.resolve().then(cb)` → `cb` no debe instrumentarse.
 */
const ASYNC_API_METHODS = new Set(['then', 'catch', 'finally'])

/**
 * ¿La función `node` es argumento de una API asíncrona (setTimeout, .then(), etc.)?
 * Si es así, su body NO debe procesarse con probes.
 *
 * Incluye `new Promise(executor)`: el ejecutor no es `async` en el motor; meter
 * `await __loupeProbe` ahí rompe `new Function` (“await solo en async”).
 */
function isCallbackOfAsyncAPI(path: NodePath<t.Function>): boolean {
  const parent = path.parent

  // new Promise(executor)
  if (t.isNewExpression(parent) && parent.arguments[0] === path.node) {
    const c = parent.callee
    if (t.isIdentifier(c) && c.name === 'Promise') return true
  }

  if (!t.isCallExpression(parent)) return false

  // Verificar que la función es un argumento del call (no el callee)
  if (parent.callee === path.node) return false

  const { callee } = parent

  // setTimeout(fn, ms), queueMicrotask(fn), etc.
  if (t.isIdentifier(callee) && ASYNC_API_CALLEES.has(callee.name)) {
    return true
  }

  // promise.then(fn), promise.catch(fn), promise.finally(fn)
  if (
    t.isMemberExpression(callee) &&
    t.isIdentifier(callee.property) &&
    ASYNC_API_METHODS.has(callee.property.name)
  ) {
    return true
  }

  return false
}

type InstrumentTransformCtx = {
  /**
   * `false`: sentencias sin `await` se emiten como `__loupeProbe(...)` sin `await`, para que en modo
   * fluido no se cedan microtareas entre líneas síncronas (orden de consola = navegador).
   * `true` (default): siempre `await __loupeProbe` para que el gate del modo paso encaje antes de cada línea.
   */
  awaitSyncProbes: boolean
}

function wrapExpressionStatement(
  stmt: t.ExpressionStatement,
  ctx: InstrumentTransformCtx,
): t.ExpressionStatement {
  const line = stmt.loc?.start.line ?? 0
  const expr = stmt.expression
  const probeProps: t.ObjectProperty[] = [
    t.objectProperty(t.identifier('line'), t.numericLiteral(line)),
  ]
  const pendingMs = pendingTimerFromExpr(expr)
  if (pendingMs !== undefined) {
    probeProps.push(
      t.objectProperty(t.identifier('pendingTimerMs'), t.numericLiteral(pendingMs)),
    )
  }
  const innerAsync = expressionContainsAwait(expr)
  const useAwait = ctx.awaitSyncProbes || innerAsync
  const call = t.callExpression(t.identifier('__loupeProbe'), [
    t.objectExpression(probeProps),
    t.arrowFunctionExpression(
      [],
      t.blockStatement([t.expressionStatement(expr)]),
      innerAsync,
    ),
  ])
  return t.expressionStatement(useAwait ? t.awaitExpression(call) : call)
}

/**
 * `let x = expr` / `const x = expr` en el cuerpo async del runtime: instrumenta el inicializador
 * para que el primer paso no “salte” a funciones que aún no se invocan.
 */
function wrapSimpleVariableDeclaration(
  stmt: t.VariableDeclaration,
  ctx: InstrumentTransformCtx,
): t.VariableDeclaration | null {
  if (stmt.declarations.length !== 1) return null
  const d = stmt.declarations[0]
  if (!t.isIdentifier(d.id) || d.init == null) return null
  if (t.isFunctionExpression(d.init) || t.isArrowFunctionExpression(d.init)) return null

  const line = stmt.loc?.start.line ?? 0
  const init: t.Expression = d.init
  const probeProps: t.ObjectProperty[] = [
    t.objectProperty(t.identifier('line'), t.numericLiteral(line)),
  ]
  const pendingMs = pendingTimerFromExpr(init)
  if (pendingMs !== undefined) {
    probeProps.push(
      t.objectProperty(t.identifier('pendingTimerMs'), t.numericLiteral(pendingMs)),
    )
  }

  const innerAsync = expressionContainsAwait(init)
  const useAwait = ctx.awaitSyncProbes || innerAsync
  const call = t.callExpression(t.identifier('__loupeProbe'), [
    t.objectExpression(probeProps),
    t.arrowFunctionExpression(
      [],
      t.blockStatement([t.returnStatement(init)]),
      innerAsync,
    ),
  ])
  const wrappedInit = useAwait ? t.awaitExpression(call) : call

  return t.variableDeclaration(stmt.kind, [
    t.variableDeclarator(d.id, wrappedInit),
  ])
}

function processBlockBody(body: t.Statement[], ctx: InstrumentTransformCtx): t.Statement[] {
  return body.flatMap((s) => transformStatement(s, ctx))
}

function ensureBlockProcessed(
  stmt: t.Statement,
  ctx: InstrumentTransformCtx,
): t.Statement {
  if (t.isBlockStatement(stmt)) {
    stmt.body = processBlockBody(stmt.body, ctx)
    return stmt
  }
  return t.blockStatement(processBlockBody([stmt], ctx))
}

function transformStatement(
  stmt: t.Statement,
  ctx: InstrumentTransformCtx,
): t.Statement[] {
  if (t.isExpressionStatement(stmt)) {
    return [wrapExpressionStatement(stmt, ctx)]
  }
  if (t.isBlockStatement(stmt)) {
    stmt.body = processBlockBody(stmt.body, ctx)
    return [stmt]
  }
  if (t.isVariableDeclaration(stmt)) {
    const pedagogy = didacticPromiseResolveNote(stmt)
    const wrapped = wrapSimpleVariableDeclaration(stmt, ctx)
    if (wrapped !== null) {
      return pedagogy ? [wrapped, pedagogy] : [wrapped]
    }
    for (const d of stmt.declarations) {
      if (t.isFunctionExpression(d.init)) {
        d.init.body.body = processBlockBody(d.init.body.body, ctx)
      } else if (t.isArrowFunctionExpression(d.init)) {
        if (!t.isBlockStatement(d.init.body)) {
          d.init.body = t.blockStatement([t.returnStatement(d.init.body)])
        }
        d.init.body.body = processBlockBody(d.init.body.body, ctx)
      }
    }
    return [stmt]
  }
  if (t.isIfStatement(stmt)) {
    stmt.consequent = ensureBlockProcessed(stmt.consequent, ctx)
    if (stmt.alternate) {
      stmt.alternate = ensureBlockProcessed(stmt.alternate, ctx)
    }
    return [stmt]
  }
  if (
    t.isWhileStatement(stmt) ||
    t.isForStatement(stmt) ||
    t.isForOfStatement(stmt) ||
    t.isForInStatement(stmt)
  ) {
    stmt.body = ensureBlockProcessed(stmt.body, ctx)
    return [stmt]
  }
  if (t.isTryStatement(stmt)) {
    stmt.block = t.blockStatement(processBlockBody(stmt.block.body, ctx))
    if (stmt.handler?.body) {
      stmt.handler.body = t.blockStatement(
        processBlockBody(stmt.handler.body.body, ctx),
      )
    }
    if (stmt.finalizer) {
      stmt.finalizer = t.blockStatement(processBlockBody(stmt.finalizer.body, ctx))
    }
    return [stmt]
  }
  if (t.isSwitchStatement(stmt)) {
    for (const c of stmt.cases) {
      c.consequent = processBlockBody(c.consequent, ctx)
    }
    return [stmt]
  }
  if (t.isFunctionDeclaration(stmt)) {
    stmt.body.body = processBlockBody(stmt.body.body, ctx)
    return [stmt]
  }
  return [stmt]
}

function normalizeArrowBody(path: NodePath<t.ArrowFunctionExpression>): void {
  if (!t.isBlockStatement(path.node.body)) {
    path.node.body = t.blockStatement([t.returnStatement(path.node.body)])
  }
}

export interface InstrumentResult {
  code: string
  error?: string
}

export interface InstrumentSourceOptions {
  /**
   * Si es `false`, las sentencias sin `await` no llevan `await` delante de `__loupeProbe` (modo fluido).
   * Default `true`: `await` en cada probe para el modo paso (gate antes de cada línea).
   */
  awaitSyncProbes?: boolean
}

/** Instrumenta sentencias envolviendo expresiones con await __loupeProbe(...) (o sin await en modo fluido). */
export function instrumentSource(
  src: string,
  options?: InstrumentSourceOptions,
): InstrumentResult {
  try {
    const jsLike = stripTypeScriptSyntax(src)
    const ast = parse(jsLike, {
      sourceType: 'module',
      /** Permite top-level await y el mismo análisis que usa el bundler para `await` en módulos. */
      plugins: ['typescript', 'jsx', 'topLevelAwait'],
      allowReturnOutsideFunction: true,
    })

    const ctx: InstrumentTransformCtx = {
      awaitSyncProbes: options?.awaitSyncProbes !== false,
    }

    traverse(ast, {
      Program(path) {
        path.node.body = processBlockBody(path.node.body, ctx)
      },
      ArrowFunctionExpression(path) {
        if (!path.node.loc) return
        // ── NO instrumentar bodies de callbacks de APIs asíncronas ──
        // Si esta arrow fn es argumento de .then(), setTimeout(), etc.,
        // la dejamos tal cual. El runtime se encarga de la visualización.
        if (isCallbackOfAsyncAPI(path)) return
        normalizeArrowBody(path)
        const b = path.node.body
        if (!t.isBlockStatement(b)) return
        b.body = processBlockBody(b.body, ctx)
      },
      FunctionExpression(path) {
        if (!path.node.loc) return
        // ── NO instrumentar bodies de callbacks de APIs asíncronas ──
        if (isCallbackOfAsyncAPI(path)) return
        path.node.body.body = processBlockBody(path.node.body.body, ctx)
      },
    })

    // Ya no necesitamos markAsyncWhenBodyContainsAwait:
    // Sin probes dentro de callbacks, no hay awaits que requieran async.

    const out = generate(ast, { retainLines: false, comments: false, jsescOption: { minimal: true } })
    return { code: out.code }
  } catch (e) {
    return {
      code: '',
      error: e instanceof Error ? e.message : String(e),
    }
  }
}
