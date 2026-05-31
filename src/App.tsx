import { useEventLoopStore } from './store'
import { EventLoopCanvas } from './canvas/EventLoopCanvas'
import { ControlPanel } from './canvas/ControlPanel'
import { CodeEditor } from './canvas/CodeEditor'
import { DidacticGlossary } from './canvas/DidacticGlossary'
import '@xyflow/react/dist/style.css'
import './app.css'

export function App() {
  const phase = useEventLoopStore((s) => s.phase)

  return (
    <div className="app-shell">
      {/* Ambient background */}
      <div className="app-aurora" aria-hidden />
      <div className="app-grid-bg" aria-hidden />

      {/* Header */}
      <header className="app-header">
        <div className="app-brand">
          <span className="app-logo" aria-hidden>◉</span>
          <div>
            <h1>Loupe</h1>
            <p className="app-tagline">
              Visualiza el <strong>event loop</strong> del navegador ·
              Call Stack → Web APIs → Colas → Console
            </p>
          </div>
        </div>
        <DidacticGlossary />
      </header>

      {/* Estado de la simulación: siempre visible arriba del lienzo */}
      <section className="app-sim-bar" aria-label="Estado y controles de la simulación">
        <ControlPanel />
      </section>

      {/* Columna código (izq.) + canvas (der.) */}
      <div className="app-main-grid">
        <aside className="app-sidebar">
          <CodeEditor />
        </aside>

        {/* Right column: React Flow canvas */}
        <main className="app-canvas-area" data-phase={phase}>
          <EventLoopCanvas />
        </main>
      </div>
    </div>
  )
}
