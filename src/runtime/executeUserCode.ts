import type { StepController } from './stepController.ts'

/**
 * Símbolo para marcar Promises internas del simulador.
 * Cualquier Promise con esta marca no pasa por el parche de .then().
 */
const _INTERNAL = Symbol('loupe-internal')

function installPromiseAndMicrotaskPatches(ctl: StepController): () => void {
  type ThenFn = typeof Promise.prototype.then
  /** No usar `.bind(Promise.prototype)`: el receptor debe ser la instancia real (#<Promise>). */
  const origThen = Promise.prototype.then as ThenFn
  let seq = 0

  /**
   * Envuelve un handler de .then()/.catch() para hacer shiftMicrotask cuando se ejecuta.
   * pushMicrotask ya se llamó al momento de invocar .then().
   */
  const wrapShift = (h: unknown): unknown => {
    if (typeof h !== 'function') return h
    return function (this: unknown, ...args: unknown[]) {
      ctl.shiftMicrotask()
      return (h as (...a: unknown[]) => unknown).apply(this, args)
    }
  }

  Promise.prototype.then = function (
    this: Promise<unknown>,
    onFulfilled: Parameters<ThenFn>[0],
    onRejected: Parameters<ThenFn>[1],
  ) {
    // ── BYPASS 1: Promesas internas del simulador (marcadas con Symbol) ──
    if ((this as unknown as Record<symbol, unknown>)[_INTERNAL]) {
      return origThen.call(this, onFulfilled, onRejected)
    }

    // ── BYPASS 2: No estamos en código del usuario ──
    // V8 usa .then() internamente para continuaciones de async/await.
    // React, React Flow, Vite HMR también usan .then().
    if (!ctl.interceptPromises) {
      return origThen.call(this, onFulfilled, onRejected)
    }

    // ── Código del usuario: registrar microtarea visualmente ──
    // pushMicrotask se llama AQUÍ (al invocar .then()), no al ejecutar el callback.
    // Esto es pedagógicamente correcto: la microtarea se ENCOLA al llamar .then().
    if (typeof onFulfilled === 'function' || typeof onRejected === 'function') {
      const label = `then #${++seq}`
      ctl.pushMicrotask(label, {
        concept:
          'Las reacciones de Promise.then / catch se encolan como microtareas (antes que la siguiente macrotarea).',
        codeFragment: 'Promise.resolve().then(() => { ... })',
      })
    }

    return origThen.call(
      this,
      wrapShift(onFulfilled) as never,
      wrapShift(onRejected) as never,
    )
  } as ThenFn

  /**
   * No reemplazar `window.queueMicrotask`: React y React Flow lo usan a montones; envolverlo con
   * pushMicrotask/shiftMicrotask + emit hacía miles de actualizaciones y, con flushSync en la UI,
   * "Maximum update depth exceeded".
   */

  return () => {
    Promise.prototype.then = origThen
  }
}

function buildRuntime(ctl: StepController, timerScale: number) {
  const nativeST = window.setTimeout.bind(window)
  const nativeLog = console.log.bind(console)

  return {
    notePromiseResolved: (bindingName: string) => {
      ctl.recordPromiseResolvedBinding(bindingName)
    },
    setTimeout: (
      cb: (...a: unknown[]) => void,
      ms: number,
      ...rest: unknown[]
    ) => {
      const label = `callback (${ms}ms)`
      const tid = ctl.takePreviewTimerOrAdd(ms, label)
      return nativeST(
        () => {
          const runInner = async () => {
            ctl.removeWebTimer(tid)
            ctl.enqueueTask(label, tid)
            await ctl.gateAfterTaskEnqueued(label)
            nativeST(() => {
              ctl.shiftTask()
              cb(...rest)
            }, timerScale)
          }
          ctl.runMacroFireWhenAllowed(runInner)
        },
        ms,
      ) as unknown as number
    },
    setInterval: window.setInterval.bind(window),
    console: {
      log: (...args: unknown[]) => {
        ctl.logConsole(
          args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '),
          {
            concept:
              'console.log escribe en la consola del navegador y en este panel (mismo orden que verías en DevTools).',
            codeFragment: 'console.log(...)',
          },
        )
        nativeLog(...args)
      },
    },
  }
}

export async function executeInstrumented(
  instrumentedBody: string,
  ctl: StepController,
  timerScale = 0,
): Promise<void> {
  const restorePatches = installPromiseAndMicrotaskPatches(ctl)
  const rt = buildRuntime(ctl, timerScale)
  const probe = ctl.makeProbe()

  /**
   * 1) `new Function` solo puede parsear cuerpos de función **normales** (sin `await` arriba del todo).
   * 2) Devolvemos explícitamente una **async function** para que todo el código instrumentado
   *    (con `await __loupeProbe`) quede dentro de un cuerpo `async`.
   * 3) Concatenación en vez de template literal: evita que `${
   *    ...}` dentro del código generado por Babel rompa el string.
   */
  const factorySrc =
    '"use strict";\n' +
    'return async function (__loupeProbe, __loupeRt) {\n' +
    'const setTimeout = __loupeRt.setTimeout;\n' +
    'const setInterval = __loupeRt.setInterval;\n' +
    'const console = __loupeRt.console;\n' +
    instrumentedBody +
    '\n};\n'

  let runUser: (p: unknown, r: unknown) => Promise<unknown>
  try {
    runUser = new Function(factorySrc)() as (p: unknown, r: unknown) => Promise<unknown>
  } catch (e) {
    throw new Error(
      e instanceof Error
        ? `${e.message}\n--- código ensamblado (primeras 800 chars) ---\n${factorySrc.slice(0, 800)}`
        : String(e),
    )
  }

  try {
    await runUser(probe, rt)
  } finally {
    restorePatches()
  }
}
