# Loupe

Visualizador **interactivo** del **event loop de JavaScript**. Elige un snippet, avanza **paso a paso** con **Step** y observa cómo se mueve el trabajo entre **Call Stack**, **Web APIs**, colas de **microtareas** y **macrotareas**, y la **consola**.

Reimplementación moderna inspirada en el [Loupe original](https://github.com/latentflip/loupe) (Philip Roberts) y en la charla de Jake Archibald *What the heck is the event loop anyway?*

**[→ Pruébalo en línea](https://solivoo.github.io/Loupe/)**

## ¿Qué es (y qué no es)?

Loupe **no es la consola del navegador** ni un REPL donde corre cualquier JavaScript. Usa un **parser y un simulador didáctico**: solo entiende un [subconjunto de sintaxis](#snippets-soportados) pensado para enseñar concurrencia en JS.

**Sirve para:**

- Ver por qué `.then` se ejecuta antes que `setTimeout(0)`
- Entender qué hace un `await` o cómo se ordenan varios timers
- Acompañar clases, workshops o posts sobre el event loop

**No sirve para:** ejecutar scripts reales, depurar proyectos ni probar APIs del DOM, `fetch`, etc.

## Cómo usarlo

1. Elige un **ejemplo** del menú sobre el editor, o escribe un snippet dentro de lo [soportado](#snippets-soportados).
2. Haz clic en **Step**. El **primer** clic carga el snippet en el diagrama; los siguientes avanzan un tick del loop (sync, colas, timers, consola).
3. Haz clic en **Reset** para vaciar el diagrama y la consola. El snippet del editor **se conserva**.

## Ejemplos incluidos

| # | Ejemplo | Idea clave |
| --- | --- | --- |
| 1 | Solo síncrono | Solo Call Stack; sin colas. |
| 2 | Micro vs Macro | `.then` antes que `setTimeout(0)`. |
| 3 | Cadena de microtareas | Varios `.then()` encadenados; se drenan todos. |
| 4 | Varios timers | Delays distintos; orden de consola similar a DevTools. |
| 5 | async / await | Tras `await`, la continuación es microtarea; `main()` sale de la pila. |
| 6 | Prioridad de microtareas | Todo el lote de micros (incluso anidadas) antes de la macro. |

## Snippets soportados

- `console.log`
- `Promise.resolve().then()` (cadena y `.then` anidado en callbacks)
- `setTimeout` / `setInterval` (delay numérico)
- `async function`, llamadas simples (`main()`) y `await Promise.resolve()`

## Limitaciones del modelo

La simulación prioriza **claridad pedagógica** sobre fidelidad byte a byte con el motor V8 o DevTools:

- **Timers:** el delay del código se escala ×10 (p. ej. `50` → ~500 ms visibles). `setTimeout(0)` usa el mínimo del motor (~4 ms × escala). Los contadores corren en Web APIs y, al vencer, el callback pasa a macrotareas.
- **Call Stack:** LIFO; las funciones empujan un *frame*; `await` hace pop del frame async.
- **Idealizaciones:** en algunos casos las microtareas se muestran ya en cola al registrar el `.then` (más legible en Step que en DevTools).

## Créditos

- Autor: [Sergio Olivo](https://www.sergiolivo.com)
- Idea original: [Loupe (latentflip)](https://github.com/latentflip/loupe) — Philip Roberts
- Referencia didáctica: Jake Archibald — *What the heck is the event loop anyway?*

## Licencia

[MIT](LICENSE) — Copyright © 2026 Sergio Olivo. Puedes usar, modificar y redistribuir el proyecto; conserva el aviso de copyright del archivo `LICENSE`.
