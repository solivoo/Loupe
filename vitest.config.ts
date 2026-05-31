import type { ConfigEnv, UserConfig } from 'vite'
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

const env: ConfigEnv = { command: 'serve', mode: 'test', isSsrBuild: false }

const base =
  typeof viteConfig === 'function'
    ? (viteConfig as (e: ConfigEnv) => UserConfig | Promise<UserConfig>)(env)
    : viteConfig

const resolved = await Promise.resolve(base)

export default mergeConfig(
  resolved,
  defineConfig({
    test: {
      environment: 'happy-dom',
      setupFiles: ['./src/test/setup.ts'],
      fileParallelism: false,
      testTimeout: 10_000,
    },
  }),
)
