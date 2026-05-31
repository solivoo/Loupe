import { nextId } from './eventLoopStore'
import type { ParsedScenario, Task } from './types'

/**
 * Parseo línea a línea (regex). Fallback cuando falla el AST o para snippets mínimos.
 * No entiende bloques multi-línea salvo Promise.then / setTimeout al inicio de línea.
 */
export function parseSnippetLegacy(source: string): ParsedScenario {
  const lines = source.split('\n')
  const scriptSequence: Task[] = []

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()
    const lineNum = i + 1

    if (trimmed.length === 0 || trimmed.startsWith('//')) {
      i++
      continue
    }
    if (trimmed.startsWith('/*')) {
      i++
      continue
    }

    if (/Promise\s*\.\s*resolve\s*\(\s*\)\s*\.\s*then\s*\(/.test(trimmed)) {
      const { body, endLine } = extractBlock(lines, i)
      const innerCode = extractInnerStatements(body)
      const microtasksToEnqueue: Task[] = [{
        id: nextId(),
        code: innerCode || trimmed,
        label: 'then callback',
        type: 'microtask',
        line: lineNum,
      }]
      scriptSequence.push({
        id: nextId(),
        code: trimmed.length > 120 ? `${trimmed.slice(0, 117)}…` : trimmed,
        label: 'Promise.resolve().then(…)',
        type: 'sync',
        line: lineNum,
        syncKind: 'registerThen',
        microtasksToEnqueue,
      })
      i = endLine + 1
      continue
    }

    if (/setTimeout\s*\(/.test(trimmed)) {
      const { body, endLine } = extractBlock(lines, i)
      const delayMatch = body.match(/,\s*(\d+)\s*\)\s*;?\s*$/)
      const delay = delayMatch ? parseInt(delayMatch[1], 10) : 0
      const innerCode = extractInnerStatements(body)
      const macroCallback: Task = {
        id: nextId(),
        code: innerCode || trimmed,
        label: `setTimeout cb (${delay}ms)`,
        type: 'macrotask',
        line: lineNum,
        delayMs: delay,
      }
      scriptSequence.push({
        id: nextId(),
        code: trimmed.length > 120 ? `${trimmed.slice(0, 117)}…` : trimmed,
        label: `setTimeout(…, ${delay})`,
        type: 'sync',
        line: lineNum,
        syncKind: 'registerTimeout',
        delayMs: delay,
        macroCallback,
      })
      i = endLine + 1
      continue
    }

    scriptSequence.push({
      id: nextId(),
      code: trimmed.replace(/;$/, ''),
      label:
        trimmed.length > 40 ? `${trimmed.slice(0, 37)}…` : trimmed.replace(/;$/, ''),
      type: 'sync',
      line: lineNum,
      syncKind: 'statement',
    })
    i++
  }

  return { scriptSequence }
}

function extractBlock(
  lines: string[],
  startLine: number,
): { body: string; endLine: number } {
  let depth = 0
  let started = false
  const parts: string[] = []

  for (let j = startLine; j < lines.length; j++) {
    const ln = lines[j]
    parts.push(ln)

    for (const ch of ln) {
      if (ch === '(' || ch === '{') {
        depth++
        started = true
      } else if (ch === ')' || ch === '}') {
        depth--
      }
    }

    if (started && depth <= 0) {
      return { body: parts.join('\n'), endLine: j }
    }
  }

  return { body: parts.join('\n'), endLine: lines.length - 1 }
}

function extractInnerStatements(block: string): string {
  const match = block.match(/\{([\s\S]*)\}/)
  if (!match) return ''
  return match[1]
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('//'))
    .join('; ')
    .replace(/;+\s*$/, '')
}
