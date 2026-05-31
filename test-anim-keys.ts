import { StepController } from './src/runtime/stepController.ts'

async function run() {
  const ctl = new StepController(0, queueMicrotask)
  ctl.mode = 'run'
  
  let lastKey = ''
  ctl.subscribe(() => {
    const s = ctl.snapshot()
    const k = s.flowHint ? `${s.flowHint.from}-${s.flowHint.to}-${s.flowPipeRevision}` : ''
    if (k && k !== lastKey) {
      console.log('KEY EMITTED:', k)
      lastKey = k
    }
  })
  
  await ctl.makeProbe()({line: 6}, async () => {
    ctl.logConsole("3. Microtarea: then 1")
  })
}

run()
