/**
 * The pipeline's one custom check: per ticket, are the inputs valid, was the live system explored,
 * and does every manual test case have exactly one traceable spec? Style, types and execution stay
 * with eslint, ast-grep, tsc and Playwright.
 *
 *   npm run validate:pipeline -- [--progress] [TICKET...]
 *                                           default: everything must be present and complete (push, CI);
 *                                           --progress: only what the work so far implies
 *   ... validate.ts --hook                  Cursor stop hook: complete mode, answers with a follow-up message
 *
 * Exit: 0 = all gates passed, 1 = a gate failed, 2 = unknown ticket.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DIRS } from '../harness-config.ts'
import { listFiles, readOutputJson } from '../lib/files.ts'
import { fail, hasFailure, type GateResult } from '../lib/gateResults.ts'
import { explorationGates, missingExplorationGate } from './exploration-validation/gates.ts'
import { reviewInput } from './input-validation/input-gates.ts'
import type { TestCaseFile } from './input-validation/input-schemas.ts'
import { artifactPath, ticketFromFileName } from './paths.ts'
import {
  coverageGate,
  manualStepNamesGate,
  noHardcodedTestDataGate,
  rawFixtureGate,
  stepNamesGate,
  traceGate,
} from './specs-validation/spec-gates.ts'
import { readSpecTests } from './specs-validation/spec-source.ts'

export type TicketReport = { ticket: string; gates: GateResult[] }
export type ValidateOptions = {
  /** Demand the artifact and a spec for every test case; progress mode only demands what the work so far implies. */
  complete: boolean
}

const icon = { pass: '✓', warn: '!', fail: '✗' } as const

const FOLLOWUP_RULES = [
  'Test cases are a Jira/Xray export: key TC-n, one component api|ui, AC-n labels, a link to the story, steps with action/data/"expected result"; "expected" must be concrete enough to assert on.',
  'The exploration artifact needs a verified semantic getBy* locator for every UI test case, an observed live API call for every API test case, and findings where the SUT differs from the test case.',
  'Spec titles are the manual test case titles; each test has annotation: testCase("TC-n"); steps read "Verify that …" / "Confirm that …".',
]

const specFilesOf = (root: string) => listFiles(root, 'tests', /\.spec\.ts$/)

export const ticketsOf = (root: string): string[] =>
  listFiles(root, DIRS.testCases, /\.json$/).flatMap(file => ticketFromFileName(file) ?? [])

const specGates = (root: string, files: string[], testCases: TestCaseFile, complete: boolean): GateResult[] => {
  if (files.length === 0) return complete ? [fail('specs', `no spec file for ${testCases.ticket} under tests/`)] : []
  const perFile = files.map(file => {
    const source = readFileSync(join(root, file), 'utf8')
    return { file, source, tests: readSpecTests(source) }
  })
  return [
    ...perFile.flatMap(({ file, tests }) =>
      [
        traceGate(file, tests, testCases),
        stepNamesGate(tests),
        manualStepNamesGate(tests, testCases),
        rawFixtureGate(tests),
      ].map(g => ({ ...g, gate: `${file}: ${g.gate}` })),
    ),
    noHardcodedTestDataGate(perFile),
    ...(complete ? [coverageGate(perFile.flatMap(item => item.tests), testCases)] : []),
  ]
}

export function validateTicket(root: string, ticket: string, { complete }: ValidateOptions): TicketReport {
  const input = reviewInput(root, ticket)
  const { testCases } = input
  if (!testCases) return { ticket, gates: input.gates }

  const files = specFilesOf(root).filter(file => ticketFromFileName(file) === ticket)
  const artifact = artifactPath(ticket)
  const gates = [...input.gates]

  if (existsSync(join(root, artifact))) {
    const raw = readOutputJson(join(root, artifact))
    gates.push(...(raw.ok ? explorationGates(testCases, raw.raw) : [fail('schema', `${artifact}: ${raw.detail}`)]))
  } else if (complete || files.length > 0) gates.push(missingExplorationGate(artifact))

  return { ticket, gates: [...gates, ...specGates(root, files, testCases, complete)] }
}

/** Specs that belong to no ticket would test something nobody asked for. */
const orphanSpecs = (root: string, tickets: string[]): TicketReport[] => {
  const orphans = specFilesOf(root).filter(file => !tickets.includes(ticketFromFileName(file) ?? ''))
  return orphans.length
    ? [{ ticket: '(specs)', gates: [fail('spec-ticket', `no test cases file for: ${orphans.join(', ')}`)] }]
    : []
}

export function validatePipeline(root: string, opts: ValidateOptions, only: string[] = []): TicketReport[] {
  const tickets = only.length ? only : ticketsOf(root)
  if (tickets.length === 0) return [{ ticket: '(none)', gates: [fail('input', `no test cases found in ${DIRS.testCases}`)] }]
  return [
    ...tickets.map(ticket => validateTicket(root, ticket, opts)),
    ...(only.length ? [] : orphanSpecs(root, tickets)),
  ]
}

export function buildFollowup(reports: TicketReport[]): string {
  const lines = ['The pipeline gates failed. Fix the problems below.', '']
  for (const { ticket, gates } of reports.filter(r => hasFailure(r.gates))) {
    lines.push(`${ticket}:`, ...gates.filter(g => g.status === 'fail').map(g => `- ${g.gate}: ${g.detail}`), '')
  }
  return [...lines, 'Rules:', ...FOLLOWUP_RULES.map(rule => `- ${rule}`)].join('\n')
}

function print(reports: TicketReport[]) {
  for (const { ticket, gates } of reports) {
    process.stdout.write(`── ${ticket}\n`)
    for (const g of gates) process.stdout.write(`   ${icon[g.status]} ${g.gate.padEnd(18)} ${g.detail ?? ''}\n`)
  }
}

async function readHookStatus(): Promise<unknown> {
  if (process.stdin.isTTY) return undefined
  let text = ''
  for await (const chunk of process.stdin) text += chunk
  try {
    const payload: unknown = JSON.parse(text || '{}')
    return typeof payload === 'object' && payload !== null && 'status' in payload ? payload.status : undefined
  } catch {
    return undefined
  }
}

async function main(root: string, argv: string[]) {
  if (argv.includes('--hook')) {
    const status = await readHookStatus()
    const reports = status === 'aborted' || status === 'error' ? [] : validatePipeline(root, { complete: true })
    const failed = reports.some(r => hasFailure(r.gates))
    process.stdout.write(JSON.stringify(failed ? { followup_message: buildFollowup(reports) } : {}))
    return
  }
  const only = argv.filter(arg => !arg.startsWith('--'))
  const unknown = only.filter(ticket => !ticketsOf(root).includes(ticket))
  if (unknown.length) {
    console.error(`No test cases for: ${unknown.join(', ')}`)
    process.exit(2)
  }
  const reports = validatePipeline(root, { complete: !argv.includes('--progress') }, only)
  print(reports)
  process.exit(reports.some(r => hasFailure(r.gates)) ? 1 : 0)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.cwd(), process.argv.slice(2)).catch(err => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
