import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

const g = globalThis as typeof globalThis & {
  process?: { env: Record<string, string | undefined> }
}
g.process ??= {
  env: {
    NODE_ENV: import.meta.env.PROD ? 'production' : 'development',
  },
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
