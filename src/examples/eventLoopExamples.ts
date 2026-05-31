import type { InstrumentedStride } from '../store/types'

/**
 * Ejemplo didáctico cargable en el editor.
 * Cada uno ilustra un concepto del event loop y la gráfica muestra
 * exactamente cómo se mueve el trabajo entre Call Stack, Web APIs y colas.
 */
export interface EventLoopExample {
  /** Identificador estable (clave de React y selección). */
  id: string
  /** Título corto para el selector. */
  title: string
  /** Qué enseña este ejemplo (subtítulo / tooltip). */
  concept: string
  /** Código fuente que se carga en el editor. */
  code: string
  /** Modo recomendado para verlo (no fuerza, solo sugiere). */
  recommendedStride: InstrumentedStride
}

const SYNC_ONLY = `// 1) Todo síncrono: una sola pila, sin colas.
console.log("uno");
console.log("dos");
console.log("tres");
`

const MICRO_VS_MACRO = `// 2) Micro vs Macro: el clásico.
// La microtarea (.then) corre ANTES que la macrotarea (setTimeout),
// aunque el timer sea 0 ms.
console.log("inicio");

Promise.resolve().then(() => {
  console.log("micro: then 1");
});

setTimeout(() => {
  console.log("macro: timeout");
}, 0);

console.log("fin");
`

const MICROTASK_CHAIN = `// 3) Cadena de microtareas.
// Cada .then encola otra microtarea; todas se drenan
// antes de devolver el control al event loop.
console.log("A");

Promise.resolve()
  .then(() => console.log("micro 1"))
  .then(() => console.log("micro 2"))
  .then(() => console.log("micro 3"));

console.log("B");
`

const TIMERS_ORDER = `// 4) Varios timers: la cola de macrotareas es FIFO,
// pero el delay decide cuándo entra cada callback.
console.log("pido 3 timers");

setTimeout(() => console.log("timer 100ms"), 100);
setTimeout(() => console.log("timer 0ms"), 0);
setTimeout(() => console.log("timer 50ms"), 50);

console.log("sigo trabajando");
`

const ASYNC_AWAIT = `// 5) async/await es azúcar sobre microtareas.
// Lo que va DESPUÉS de un await se ejecuta como microtarea.
async function main() {
  console.log("antes del await");
  await Promise.resolve();
  console.log("después del await (microtarea)");
}

console.log("script: arranca");
main();
console.log("script: termina sync");
`

const MICRO_BEATS_MACRO_LOOP = `// 6) Las microtareas tienen prioridad: aunque programes
// un timer primero, todo el lote de microtareas corre antes.
setTimeout(() => console.log("macro al final"), 0);

Promise.resolve().then(() => {
  console.log("micro A");
  Promise.resolve().then(() => console.log("micro B (encadenada)"));
});

console.log("sync primero");
`

export const EVENT_LOOP_EXAMPLES: readonly EventLoopExample[] = [
  {
    id: 'sync-only',
    title: 'Solo síncrono',
    concept: 'Sin colas: la pila se llena y se vacía en orden.',
    code: SYNC_ONLY,
    recommendedStride: 'step',
  },
  {
    id: 'micro-vs-macro',
    title: 'Micro vs Macro',
    concept: 'La microtarea (.then) gana a la macrotarea (setTimeout 0).',
    code: MICRO_VS_MACRO,
    recommendedStride: 'step',
  },
  {
    id: 'microtask-chain',
    title: 'Cadena de microtareas',
    concept: 'Cada .then encola otra microtarea; se drenan todas juntas.',
    code: MICROTASK_CHAIN,
    recommendedStride: 'step',
  },
  {
    id: 'timers-order',
    title: 'Varios timers',
    concept: 'El delay decide el orden de entrada a la cola de macrotareas.',
    code: TIMERS_ORDER,
    recommendedStride: 'browser',
  },
  {
    id: 'async-await',
    title: 'async / await',
    concept: 'Lo que sigue a un await corre como microtarea.',
    code: ASYNC_AWAIT,
    recommendedStride: 'step',
  },
  {
    id: 'micro-priority',
    title: 'Prioridad de microtareas',
    concept: 'Todo el lote de microtareas corre antes de la próxima macrotarea.',
    code: MICRO_BEATS_MACRO_LOOP,
    recommendedStride: 'step',
  },
] as const

/** Ejemplo que se carga al abrir la app por primera vez. */
export const DEFAULT_EXAMPLE_ID = 'micro-vs-macro'

export function getExampleById(id: string): EventLoopExample | undefined {
  return EVENT_LOOP_EXAMPLES.find((e) => e.id === id)
}

export function getDefaultExample(): EventLoopExample {
  return getExampleById(DEFAULT_EXAMPLE_ID) ?? EVENT_LOOP_EXAMPLES[0]
}
