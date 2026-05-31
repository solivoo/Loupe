# Loupe

Visualizador **paso a paso** del **event loop de JavaScript** en el navegador. Reimplementación moderna inspirada en el [Loupe original](https://github.com/latentflip/loupe) (Philip Roberts) y en *In The Loop* (Jake Archibald).

Escribís código en el editor, usás **Step** para avanzar un tick del loop y ves cómo se mueve el trabajo entre **Call Stack**, **Web APIs**, **cola de microtareas**, **cola de macrotareas** y **consola**.

## Para quién es

- Clases, workshops o posts sobre concurrencia en JS.
- Quien quiere **ver** por qué `.then` va antes que `setTimeout(0)`, qué hace un `await`, o cómo se ordenan varios timers.

No ejecuta tu código con el motor real del navegador: es un **modelo didáctico** (parser AST + simulador) pensado para enseñar el flujo del event loop.

## Inicio rápido

```bash
git clone <tu-repo>
cd loupe
pnpm install
pnpm dev
```

Abrir la URL que muestra Vite (por defecto `http://localhost:5173`).

### Controles

| Acción | Qué hace |
| --- | --- |
| **Step** | Avanza un paso. El **primer** clic carga el snippet en el diagrama; los siguientes ejecutan sync, colas, timers y consola. |
| **Reset** | Vacía el diagrama y la consola; **conserva** el código del editor. |

### Ejemplos integrados

Selector **Ejemplos** sobre el editor (orden pedagógico 1 → 6):

| # | Ejemplo | Idea clave |
| --- | --- | --- |
| 1 | Solo síncrono | Solo Call Stack; sin colas. |
| 2 | Micro vs Macro | `.then` antes que `setTimeout(0)`. |
| 3 | Cadena de microtareas | Varios `.then()` encadenados; se drenan todos. |
| 4 | Varios timers | Delays distintos; orden de consola como DevTools (timers con reloj automático en Web APIs). |
| 5 | async / await | Tras `await`, la continuación es microtarea; `main()` sale de la pila. |
| 6 | Prioridad de microtareas | Todo el lote de micros (incluso anidadas) antes de la macro. |

Podés editar el código o cargar un ejemplo y volver a **Step** desde **Reset**.

## Snippets soportados (modo didáctico)

- `console.log`
- `Promise.resolve().then()` (cadena y `.then` anidado en callbacks)
- `setTimeout` / `setInterval` (delay numérico)
- `async function`, llamadas simples (`main()`) y `await Promise.resolve()`

## Detalles del modelo (transparencia docente)

- **Timers**: el delay del código se escala ×10 en la simulación (p. ej. `50` → ~500 ms visibles). `setTimeout(0)` usa el mínimo del motor (~4 ms × escala). Los contadores arrancan al entrar en Web APIs; al vencer, el callback pasa a macrotareas (reloj automático en paralelo al sync).
- **Call Stack**: LIFO; las llamadas a función empujan un *frame*; `await` hace pop del frame async.
- **Idealizaciones**: en algunos casos las microtareas se muestran ya en cola al registrar el `.then` (más claro en Step que en DevTools).

## Stack

React 19 · TypeScript · Vite · Zustand · React Flow · CodeMirror · Babel (parseo AST).

## Scripts

```bash
pnpm dev      # desarrollo
pnpm build    # producción
pnpm test     # tests (ejemplos + simulador)
pnpm preview  # preview del build
```

## Créditos

- Idea original: [Loupe (latentflip)](https://github.com/latentflip/loupe) — Philip Roberts.
- Referencia didáctica: Jake Archibald — *What the heck is the event loop anyway?*

## Licencia

[MIT](LICENSE) — uso, copia, modificación y distribución libres, con atribución.

El [Loupe original](https://github.com/latentflip/loupe) de Philip Roberts también es MIT.

