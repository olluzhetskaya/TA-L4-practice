import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { z } from 'zod'
import { TIMEOUTS } from '../../harness-config.ts'
import { fail, pass, type GateResult } from '../../lib/gates/gateResults.ts'
import { commandGate } from './run-command.ts'
import type { SpecContext } from './spec-context.ts'

const TEST_CASE_ANNOTATION = 'test-case'
const DETAIL_MAX_CHARS = 200
const PLAYWRIGHT_DETAIL_LINES = 25

const testSchema = z.object({
  annotations: z.array(z.object({ type: z.string(), description: z.string().optional() })),
  status: z.string(),
  results: z.array(z.object({ error: z.object({ message: z.string() }).optional() })),
})
type Test = z.infer<typeof testSchema>
type Suite = { specs?: { tests: Test[] }[]; suites?: Suite[] }
const suiteSchema: z.ZodType<Suite> = z.lazy(() =>
  z.object({ specs: z.array(z.object({ tests: z.array(testSchema) })).optional(), suites: z.array(suiteSchema).optional() }),
)
const reportSchema = z.object({ suites: z.array(suiteSchema) })

export type CaseOutcome = { ok: boolean; detail?: string }

const testsOf = (suite: Suite): Test[] => [
  ...(suite.specs ?? []).flatMap(spec => spec.tests),
  ...(suite.suites ?? []).flatMap(testsOf),
]

const firstLine = (message: string | undefined): string | undefined => message?.split('\n')[0]?.slice(0, DETAIL_MAX_CHARS)

/**
 * Per test case outcome from a Playwright JSON report. `expected` means the test ended as declared,
 * so a `test.fail` bug case that fails counts as ok. A case with several tests is ok only if all are.
 */
export function readCaseOutcomes(report: unknown): Map<string, CaseOutcome> | undefined {
  const parsed = reportSchema.safeParse(report)
  if (!parsed.success) return undefined
  const outcomes = new Map<string, CaseOutcome>()
  for (const test of parsed.data.suites.flatMap(testsOf)) {
    const id = test.annotations.find(a => a.type === TEST_CASE_ANNOTATION)?.description
    if (!id) continue
    const ok = test.status === 'expected' && (outcomes.get(id)?.ok ?? true)
    const detail = ok ? undefined : (outcomes.get(id)?.detail ?? firstLine(test.results.at(-1)?.error?.message) ?? test.status)
    outcomes.set(id, { ok, detail })
  }
  return outcomes
}

function caseGate(id: string, outcome: CaseOutcome | undefined): GateResult {
  const gate = `run:${id}`
  if (!outcome) return fail(gate, 'the test did not run')
  return outcome.ok ? pass(gate) : fail(gate, outcome.detail ?? 'failed')
}

function readReport(file: string): unknown {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return undefined
  }
}

/** Run the written specs and report one gate per test case; falls back to the single run gate when no report was produced. */
export function runSpecGates({ workspace, level, specs, testCases }: SpecContext): GateResult[] {
  const reportDir = mkdtempSync(join(tmpdir(), 'pw-report-'))
  try {
    const reportFile = join(reportDir, 'report.json')
    const run = commandGate('playwright', 'npx', ['--no-install', 'playwright', 'test', `--project=${level}`, '--reporter=json', ...specs.map(spec => spec.file)], {
      cwd: workspace,
      timeoutMs: TIMEOUTS.playwright,
      maxLines: PLAYWRIGHT_DETAIL_LINES,
      env: { ...process.env, CI: '', NO_COLOR: '1', PLAYWRIGHT_JSON_OUTPUT_FILE: reportFile },
    })
    const outcomes = readCaseOutcomes(readReport(reportFile))
    if (!outcomes) return [run]
    const perCase = testCases.map(tc => caseGate(tc.id, outcomes.get(tc.id)))
    const unexplained = run.status === 'fail' && perCase.every(gate => gate.status === 'pass')
    return unexplained ? [...perCase, run] : perCase
  } finally {
    rmSync(reportDir, { recursive: true, force: true })
  }
}
