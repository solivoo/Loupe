const CONSOLE_LOG_RE = /console\.log\(\s*["'`]([^"'`]*)["'`]\s*\)/

/** Extrae el literal de un `console.log("…")` simple, si aplica. */
export function parseSimpleConsoleLog(code: string): string | null {
  const match = CONSOLE_LOG_RE.exec(code)
  return match?.[1] ?? null
}
