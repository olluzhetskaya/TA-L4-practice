import { spawnSync } from 'node:child_process'
import { delimiter, join } from 'node:path'
import { MAX_DETAIL_LINES, TIMEOUTS } from '../../harness-config.ts'
import { fail, pass, type GateResult } from './gateResults.ts'

export type CommandGateOptions = {
  cwd?: string
  timeoutMs?: number
  env?: NodeJS.ProcessEnv
  /** Output lines kept in the failure detail (the agent reads this verbatim). */
  maxDetailLines?: number
}

/**
 * Wrap a shell command as a gate: exit 0 = pass, anything else = fail with the
 * tail of the output. Lets lint / ast-grep / playwright use the same framework
 * (hook, CLI, CI) as the schema gates.
 */
export function commandGate(
  gate: string,
  command: string,
  args: string[],
  opts: CommandGateOptions = {},
): GateResult {
  const cwd = opts.cwd ?? process.cwd()
  const env = opts.env ?? { ...process.env, PATH: `${join(cwd, 'node_modules/.bin')}${delimiter}${process.env.PATH ?? ''}` }
  const run = spawnSync(command, args, {
    cwd,
    env,
    encoding: 'utf8',
    timeout: opts.timeoutMs ?? TIMEOUTS.defaultGate,
    maxBuffer: 16 * 1024 * 1024,
  })
  if (run.error) return fail(gate, `could not run "${command}": ${run.error.message}`)
  if (run.status === 0) return pass(gate)
  const lines = `${run.stdout}\n${run.stderr}`
    .split('\n')
    .map(line => line.trimEnd())
    .filter(Boolean)
  const kept = lines.slice(0, opts.maxDetailLines ?? MAX_DETAIL_LINES.defaultGate)
  const more = lines.length > kept.length ? ` (+${lines.length - kept.length} more lines)` : ''
  return fail(gate, `exit ${run.status ?? 'signal'}: ${kept.join(' | ')}${more}`)
}
