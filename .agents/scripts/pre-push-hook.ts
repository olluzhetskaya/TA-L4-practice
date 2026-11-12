import { fileURLToPath } from 'node:url'
import { MAX_DETAIL_LINES, NPM_SCRIPTS, TIMEOUTS } from '../harness-config.ts'
import { commandGate } from '../lib/gates/commandGate.ts'
import type { GateResult } from '../lib/gates/gateResults.ts'

export function runPrePush(root: string): GateResult[] {
  const npm = (name: string, args: string[]) =>
    commandGate(name, 'npm', ['run', '--silent', ...args], { cwd: root, timeoutMs: TIMEOUTS.npmScript, maxDetailLines: MAX_DETAIL_LINES.npmScript })
  return [
    npm('typecheck', [NPM_SCRIPTS.typecheck]),
    npm('eslint', [NPM_SCRIPTS.lint]),
    npm('ast-grep', [NPM_SCRIPTS.astGrep]),
    npm('pipeline-gates', [NPM_SCRIPTS.runGates, '--', '--ci', '--no-lint']),
  ]
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const failed = runPrePush(process.cwd()).filter(g => g.status === 'fail')
  for (const g of failed) process.stderr.write(`✗ ${g.gate}: ${g.detail}\n`)
  process.exit(failed.length ? 1 : 0)
}
