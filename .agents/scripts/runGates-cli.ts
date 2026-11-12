/**
 * One entry for every gate check: Cursor stop hook, local CLI, and CI.
 *
 *   npm run runGates -- .agents/manual-to-autotests-pipeline/artifacts/explore-TOOL-1.json     review specific files
 *   npm run runGates -- --all [--stage specs]                     review every file of every stage
 *   npm run runGates -- --ci [--json] [--no-lint] [--with-tests] CI: all stages, machine-readable, optional test run
 *   node --import tsx .agents/scripts/runGates-cli.ts --hook      Cursor stop hook — reviews all stage files (no lint)
 *
 * Exit: 0 = all gates passed, 1 = a gate failed, 2 = wrong usage.
 */
import { isAbsolute, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { commandGate } from '../lib/gates/commandGate.ts'
import { hasFailure, type CheckResult, type GateResult } from '../lib/gates/gateResults.ts'
import { MAX_DETAIL_LINES, TIMEOUTS } from '../harness-config.ts'
import { relPosix } from '../lib/files.ts'
import { STAGES, stageFor, type Stage } from '../manual-to-autotests-pipeline/pipeline.config.ts'

const icon = { pass: '✓', warn: '!', fail: '✗' } as const
const out = (line = '') => process.stdout.write(`${line}\n`)

export type Reviewed = { stage: Stage; result: CheckResult }

export function reviewFile(root: string, file: string, lint = true): Reviewed | undefined {
  const abs = isAbsolute(file) ? file : join(root, file)
  const stage = stageFor(relPosix(root, abs))
  if (!stage) return undefined
  return { stage, result: { ...stage.review(abs, { root, lint }), stage: stage.id } }
}

export function buildFollowup(root: string, failed: Reviewed[]): string {
  const lines = ['The gates failed. Fix the files below. Save each corrected file to the same path.', '']
  for (const { result } of failed) {
    lines.push(`${relative(root, result.file)}:`)
    for (const gate of result.gates.filter((g: GateResult) => g.status === 'fail')) lines.push(`- ${gate.gate}: ${gate.detail}`)
    lines.push('')
  }
  const rules = [...new Set(failed.flatMap(item => item.stage.followupRules))]
  if (rules.length) lines.push('Rules:', ...rules)
  return lines.join('\n')
}

export function runHook(root: string) {
  const files = STAGES.flatMap(s => s.list(root))
  const reviewed = files
    .map(file => reviewFile(root, file, false)) // no lint in the loop — eslint/ast-grep run at validate:push
    .filter((item): item is Reviewed => item !== undefined)
  const failed = reviewed.filter(item => item.result.decision === 'fix_required')
  const output: { followup_message?: string } = failed.length ? { followup_message: buildFollowup(root, failed) } : {}
  return { output, results: reviewed.map(item => item.result) }
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return ''
  let data = ''
  for await (const chunk of process.stdin) data += chunk
  return data
}

function parsePayload(text: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(text || '{}')
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

async function hookMode(root: string) {
  const payload = parsePayload(await readStdin())
  if (payload.status === 'aborted' || payload.status === 'error') {
    process.stdout.write('{}')
    return
  }
  const { output } = runHook(root)
  process.stdout.write(JSON.stringify(output))
}

function printHuman(root: string, results: CheckResult[]) {
  for (const result of results) {
    const ticket = result.ticket ? ` (${result.ticket})` : ''
    out(`── ${relative(root, result.file)}${ticket} [${result.stage ?? '?'}]`)
    for (const g of result.gates) out(`   ${icon[g.status]} ${g.gate.padEnd(18)} ${g.detail ?? ''}`)
    out(`   decision: ${result.decision}\n`)
  }
}

function runTests(root: string): GateResult {
  const project = process.env.PW_PROJECT
  return commandGate('playwright', 'npx', ['--no-install', 'playwright', 'test', '--reporter=line', ...(project ? [`--project=${project}`] : [])], {
    cwd: root,
    timeoutMs: TIMEOUTS.playwright,
    maxDetailLines: MAX_DETAIL_LINES.playwright,
  })
}

function flagValue(argv: string[], flag: string): string | undefined {
  const i = argv.indexOf(flag)
  return i >= 0 ? argv[i + 1] : undefined
}

function manualMode(root: string, argv: string[]) {
  const ci = argv.includes('--ci')
  const all = ci || argv.includes('--all')
  const stageFilter = flagValue(argv, '--stage')
  const positional = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--stage')

  const stages = STAGES.filter(s => !stageFilter || s.id === stageFilter)
  const files = all ? stages.flatMap(s => s.list(root)) : positional
  if (files.length === 0) {
    console.error('Usage: npm run runGates -- <file...> | --all [--stage <id>] | --ci [--json] [--no-lint] [--with-tests]')
    process.exit(2)
  }

  const results: CheckResult[] = []
  for (const file of files) {
    const reviewed = reviewFile(root, file, !argv.includes('--no-lint'))
    if (!reviewed) {
      console.error(`No stage owns ${file}`)
      process.exit(2)
    }
    results.push(reviewed.result)
  }

  let testsGate: GateResult | undefined
  if (argv.includes('--with-tests') && !results.some(r => r.decision === 'fix_required')) testsGate = runTests(root)

  const failed = results.some(r => r.decision === 'fix_required') || (testsGate !== undefined && hasFailure([testsGate]))
  if (argv.includes('--json')) out(JSON.stringify({ ok: !failed, results, tests: testsGate ?? null }, null, 2))
  else {
    printHuman(root, results)
    if (testsGate) out(`${icon[testsGate.status]} playwright ${testsGate.detail ?? ''}`)
  }
  process.exit(failed ? 1 : 0)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = process.cwd()
  const argv = process.argv.slice(2)
  const run = async () => {
    if (argv.includes('--hook')) await hookMode(root)
    else manualMode(root, argv)
  }
  run().catch(err => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
