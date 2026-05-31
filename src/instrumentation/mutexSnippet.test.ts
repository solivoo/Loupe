import { describe, expect, it } from 'vitest'
import { instrumentSource } from './instrumentImpl.ts'
import { executeInstrumented } from '../runtime/executeUserCode.ts'
import { StepController } from '../runtime/stepController.ts'

/**
 * Mismo patrón que el usuario (mutex + main), con delays en 0 ms para que el test termine rápido.
 * TypeScript: tipos y genéricos deben transpilar + instrumentar sin error.
 */
const MUTEX_TS_FAST = `let hubMutex: Promise<void> = Promise.resolve();

async function withHubMutex<T>(fn: () => Promise<T>): Promise<T> {
  const previous = hubMutex;
  let release!: () => void;

  hubMutex = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;

  try {
    return await fn();
  } finally {
    release();
  }
}

async function enviarMensaje1(mensaje: string) {
  await new Promise((r) => setTimeout(r, 0));
  console.log("Enviado:", mensaje);
}

async function main() {
  await withHubMutex(() => enviarMensaje1("Hola"));
}

main();
`

describe('instrumentación mutex + async/await (snippet usuario)', () => {
  it('instrumentSource no devuelve error y genera código con __loupeProbe', () => {
    const { code, error } = instrumentSource(MUTEX_TS_FAST)
    expect(error, error).toBeUndefined()
    expect(code.length).toBeGreaterThan(0)
    expect(code).toContain('__loupeProbe')
  })

  it('executeInstrumented avanza con StepController sin lanzar (modo paso acotado)', async () => {
    const { code, error } = instrumentSource(MUTEX_TS_FAST)
    expect(error).toBeUndefined()
    if (!code) throw new Error('sin código instrumentado')

    const ctl = new StepController()
    ctl.mode = 'step'
    const execution = executeInstrumented(code, ctl, 0)

    const maxPumps = 400
    for (let n = 0; n < maxPumps; n++) {
      const done = await Promise.race([
        execution.then((): 'done' => 'done'),
        new Promise<'tick'>((r) => setTimeout(() => r('tick'), 0)),
      ])
      if (done === 'done') {
        await execution
        return
      }
      if (ctl.awaitingManualStep) ctl.continueStep()
      await new Promise<void>((r) => queueMicrotask(r))
      if (ctl.awaitingManualStep) ctl.continueStep()
    }
    await execution
  })
})
