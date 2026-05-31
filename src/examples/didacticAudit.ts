/** Salida esperada en modo didáctico (UI Step). null = aún no soportado por el parser. */
export const DIDACTIC_AUDIT: Record<
  string,
  { expected: readonly string[] | null; note?: string }
> = {
  'sync-only': { expected: ['uno', 'dos', 'tres'] },
  'micro-vs-macro': {
    expected: ['inicio', 'fin', 'micro: then 1', 'macro: timeout'],
  },
  'microtask-chain': {
    expected: ['A', 'B', 'micro 1', 'micro 2', 'micro 3'],
  },
  'timers-order': {
    expected: [
      'pido 3 timers',
      'sigo trabajando',
      'timer 0ms',
      'timer 50ms',
      'timer 100ms',
    ],
    note: 'setTimeout(0) → mínimo ~4 ms × escala; N>0 → N×10 ms sim (orden como DevTools)',
  },
  'async-await': {
    expected: [
      'script: arranca',
      'antes del await',
      'script: termina sync',
      'después del await (microtarea)',
    ],
    note: 'await encola la continuación como microtarea tras el sync restante',
  },
  'micro-priority': {
    expected: ['sync primero', 'micro A', 'micro B (encadenada)', 'macro al final'],
    note: 'Micros anidadas en callback + macro al final (setTimeout 0)',
  },
}

/** IDs con soporte completo en modo didáctico (Step + Reset). */
export const DIDACTIC_SUPPORTED_IDS = (
  Object.entries(DIDACTIC_AUDIT) as [string, { expected: readonly string[] | null }][]
)
  .filter(([, a]) => a.expected !== null)
  .map(([id]) => id)

/** Orden pedagógico del dropdown (1→6). */
export const EXAMPLE_SELECTOR_ORDER = [
  'sync-only',
  'micro-vs-macro',
  'microtask-chain',
  'timers-order',
  'async-await',
  'micro-priority',
] as const
