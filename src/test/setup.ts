/** Shim mínimo para dependencias que esperan `process` (p. ej. Babel en tests). */
;(globalThis as { process?: { env: { NODE_ENV: string } } }).process ??= {
  env: { NODE_ENV: 'test' },
}
