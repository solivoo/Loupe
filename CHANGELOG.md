# Changelog

## [Unreleased]

### Mejoras

- Glosario didáctico en la cabecera (popover).
- Editor con scroll usable; sidebar más compacto.
- Reloj de Web APIs unificado (Step y automático) con escala ×10 más legible.
- Barra de progreso en timers activos.
- Promoción automática de timers listos durante el sync (comportamiento real del event loop).
- Call stack corregido en `async/await`.

### Tests

- 51 tests de regresión.

## [1.0.0] — 2026-05-30

Primera versión pública de **Loupe**.

- Modo didáctico **Step + Reset** con diagrama interactivo (React Flow).
- 6 ejemplos integrados: sync, micro vs macro, cadena `.then`, timers, `async/await`, prioridad de micros.
- Reloj automático en Web APIs (timers con escala didáctica).
- Call Stack LIFO con frames de función y `await`.
- Parser AST: `console.log`, `Promise.then`, `setTimeout`, `async/await`.
- Tests de regresión (48) para consola y simulación paso a paso.
- Licencia MIT.
