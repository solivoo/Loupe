import {
  instrumentSource,
  type InstrumentSourceOptions,
} from '../instrumentation/instrumentImpl.ts'
import { executeInstrumented } from './executeUserCode.ts'
import { FLOW_PIPE_TO_CONSOLE_MS } from './flowPipeTiming.ts'
import { StepController } from './stepController.ts'

/** Mismo snippet que el editor por defecto en App. */
export const DEFAULT_EVENT_LOOP_SNIPPET = `console.log("inicio");

Promise.resolve().then(() => {
  console.log("micro: then 1");
});

setTimeout(() => {
  console.log("macro: timeout");
}, 0);

console.log("fin");
`

export function instrumentDefaultSnippet(
  options?: InstrumentSourceOptions,
): string {
  const { code, error } = instrumentSource(DEFAULT_EVENT_LOOP_SNIPPET, options)
  if (error || !code) throw new Error(error ?? 'instrumentSource vacío')
  return code
}

/** Después de `executeInstrumented`, drena micro + macro hasta que la consola deja de cambiar. */
export async function flushEventLoopUntilStable(
  lines: () => readonly string[],
  options?: { maxTicks?: number; stableTicks?: number; minLineCount?: number },
): Promise<void> {
  const maxTicks = options?.maxTicks ?? 80
  const stableTicks = options?.stableTicks ?? 3
  const minLineCount = options?.minLineCount ?? 0
  let prev = JSON.stringify(lines())
  let stable = 0
  for (let i = 0; i < maxTicks; i++) {
    await new Promise<void>((r) => queueMicrotask(r))
    const needLines = minLineCount > 0 && lines().length < minLineCount
    /* Consola del panel se rellena tras FLOW_PIPE_TO_CONSOLE_MS por línea; hace falta tiempo real > setTimeout(0). */
    await new Promise<void>((r) =>
      setTimeout(r, needLines ? Math.min(250, Math.max(80, FLOW_PIPE_TO_CONSOLE_MS / 5)) : 0),
    )
    const cur = lines()
    const next = JSON.stringify(cur)
    const longEnough = minLineCount === 0 || cur.length >= minLineCount
    if (next === prev && longEnough) {
      stable++
      if (stable >= stableTicks) return
    } else {
      stable = 0
      prev = next
    }
  }
}

export async function runDefaultSnippetRunMode(): Promise<StepController> {
  const ctl = new StepController()
  ctl.mode = 'run'
  const code = instrumentDefaultSnippet({ awaitSyncProbes: false })
  await executeInstrumented(code, ctl, 0)
  await flushEventLoopUntilStable(() => ctl.snapshot().consoleLines, {
    minLineCount: 4,
  })
  return ctl
}

const MAX_STEP_PUMPS = 400

/** Tras resolver `executeInstrumented`, puede quedar un `gate` en una microtarea (.then). */
export async function finishInnerStepPauses(
  ctl: StepController,
  options?: { maxTicks?: number; untilLines?: number },
): Promise<void> {
  const maxTicks = options?.maxTicks ?? 120
  const untilLines = options?.untilLines ?? 4
  for (let i = 0; i < maxTicks; i++) {
    if (ctl.snapshot().consoleLines.length >= untilLines) return
    if (ctl.awaitingManualStep) ctl.continueStep()
    await new Promise<void>((r) => queueMicrotask(r))
    if (ctl.awaitingManualStep) ctl.continueStep()
    const needConsole = ctl.snapshot().consoleLines.length < untilLines
    await new Promise<void>((r) =>
      setTimeout(r, needConsole ? Math.min(250, Math.max(80, FLOW_PIPE_TO_CONSOLE_MS / 5)) : 0),
    )
  }
}

/** Alterna temporizador y `continueStep` hasta que termina `execution`. */
export async function driveStepModeToCompletion(
  ctl: StepController,
  execution: Promise<void>,
): Promise<void> {
  for (let n = 0; n < MAX_STEP_PUMPS; n++) {
    const outcome = await Promise.race([
      execution.then((): 'done' => 'done'),
      new Promise<'tick'>((r) => setTimeout(() => r('tick'), 0)),
    ])
    if (outcome === 'done') {
      await execution
      return
    }
    if (ctl.awaitingManualStep) ctl.continueStep()
    await new Promise<void>((r) => queueMicrotask(r))
    if (ctl.awaitingManualStep) ctl.continueStep()
  }
  await execution
}

export async function runDefaultSnippetStepMode(): Promise<StepController> {
  const ctl = new StepController()
  ctl.mode = 'step'
  const code = instrumentDefaultSnippet()
  const execution = executeInstrumented(code, ctl, 0)
  await driveStepModeToCompletion(ctl, execution)
  await finishInnerStepPauses(ctl, { untilLines: 4 })
  await flushEventLoopUntilStable(() => ctl.snapshot().consoleLines, {
    minLineCount: 4,
  })
  return ctl
}
