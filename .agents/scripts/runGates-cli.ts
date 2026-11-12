/**
 * One entry for every gate check: Cursor stop hook, local CLI, and CI.
 *
 *   npm run runGates -- <file...>            review specific files
 *   npm run runGates -- --all [--no-lint]    review every file of every stage (what `validate:push` runs)
 *   node --import tsx .agents/scripts/runGates-cli.ts --hook   Cursor stop hook: review everything (no lint), answer with a follow-up message
 *
 * Exit: 0 = all gates passed, 1 = a gate failed, 2 = wrong usage.
 */
import { isAbsolute, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { CheckResult, GateResult } from '../lib/gates/gateResults.ts'
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

/** What the stop hook answers: a follow-up message when any stage file fails, nothing otherwise. */
export function runHook(root: string): { followup_message?: string } {
  const failed = STAGES.flatMap(stage => stage.list(root))
    .map(file => reviewFile(root, file, false)) // no lint in the loop: eslint and ast-grep run at validate:push
    .filter((item): item is Reviewed => item?.result.decision === 'fix_required')
  return failed.length ? { followup_message: buildFollowup(root, failed) } : {}
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
  process.stdout.write(JSON.stringify(runHook(root)))
}

function printHuman(root: string, results: CheckResult[]) {
  for (const result of results) {
    const ticket = result.ticket ? ` (${result.ticket})` : ''
    out(`── ${relative(root, result.file)}${ticket} [${result.stage ?? '?'}]`)
    for (const g of result.gates) out(`   ${icon[g.status]} ${g.gate.padEnd(18)} ${g.detail ?? ''}`)
    out(`   decision: ${result.decision}\n`)
  }
}

function manualMode(root: string, argv: string[]) {
  const files = argv.includes('--all') ? STAGES.flatMap(stage => stage.list(root)) : argv.filter(arg => !arg.startsWith('--'))
  if (files.length === 0) {
    console.error('Usage: npm run runGates -- <file...> | --all [--no-lint]')
    process.exit(2)
  }

  const lint = !argv.includes('--no-lint')
  const results = files.map(file => {
    const reviewed = reviewFile(root, file, lint)
    if (!reviewed) {
      console.error(`No stage owns ${file}`)
      process.exit(2)
    }
    return reviewed.result
  })

  printHuman(root, results)
  process.exit(results.some(result => result.decision === 'fix_required') ? 1 : 0)
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
