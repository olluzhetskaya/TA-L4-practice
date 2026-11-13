import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { TIMEOUTS } from '../../harness-config.ts'
import { commandGate } from '../../lib/eval/command-gate.ts'
import { readCaseOutcomes, type CaseOutcome } from '../../lib/eval/playwright-report.ts'
import { fail, pass, type GateResult } from '../../lib/gateResults.ts'
import type { SpecContext } from './spec-context.ts'

const TEST_CASE_ANNOTATION = 'test-case'
const PLAYWRIGHT_DETAIL_LINES = 25

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
    const outcomes = readCaseOutcomes(readReport(reportFile), TEST_CASE_ANNOTATION)
    if (!outcomes) return [run]
    const perCase = testCases.map(tc => caseGate(tc.id, outcomes.get(tc.id)))
    const unexplained = run.status === 'fail' && perCase.every(gate => gate.status === 'pass')
    return unexplained ? [...perCase, run] : perCase
  } finally {
    rmSync(reportDir, { recursive: true, force: true })
  }
}
