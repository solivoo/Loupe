import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const nodeEnv = mode === 'production' ? 'production' : 'development'
  const forGitHubPages = process.env.GITHUB_PAGES === 'true'

  return {
    base: forGitHubPages ? '/Loupe/' : '/',
    plugins: [
      react(),
      {
        name: 'inject-process-shim',
        transformIndexHtml() {
          return [
            {
              tag: 'script',
              injectTo: 'head-prepend',
              children: `globalThis.process??={env:{NODE_ENV:${JSON.stringify(nodeEnv)}}};`,
            },
          ]
        },
      },
    ],
    define: {
      'process.env.NODE_ENV': JSON.stringify(nodeEnv),
    },
  }
})
