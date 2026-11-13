import { spawnSync } from 'node:child_process'
import { delimiter, join } from 'node:path'
import { fail, pass, type GateResult } from '../gateResults.ts'

const MAX_BUFFER = 16 * 1024 * 1024

export type CommandOptions = {
  cwd: string
  timeoutMs: number
  env?: NodeJS.ProcessEnv
  maxLines?: number
}

/** Run a CLI inside an eval workspace and convert its exit status into a gate result. */
export function commandGate(gate: string, command: string, args: string[], opts: CommandOptions): GateResult {
  const env = opts.env ?? { ...process.env, PATH: `${join(opts.cwd, 'node_modules/.bin')}${delimiter}${process.env.PATH ?? ''}` }
  const run = spawnSync(command, args, { cwd: opts.cwd, env, encoding: 'utf8', timeout: opts.timeoutMs, maxBuffer: MAX_BUFFER })
  if (run.error) return fail(gate, `could not run "${command}": ${run.error.message}`)
  if (run.status === 0) return pass(gate)
  const lines = `${run.stdout}\n${run.stderr}`.split('\n').map(line => line.trimEnd()).filter(Boolean)
  const kept = lines.slice(0, opts.maxLines ?? 12)
  const more = lines.length > kept.length ? ` (+${lines.length - kept.length} more lines)` : ''
  return fail(gate, `exit ${run.status ?? 'signal'}: ${kept.join(' | ')}${more}`)
}
