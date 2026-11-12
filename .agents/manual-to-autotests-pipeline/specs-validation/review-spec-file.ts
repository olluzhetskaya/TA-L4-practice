import { readFileSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import { commandGate } from '../../lib/gates/commandGate.ts'
import { fail, fixRequired, toCheckResult, type CheckResult, type GateResult } from '../../lib/gates/gateResults.ts'
import { relPosix } from '../../lib/files.ts'
import { ticketFromFileName } from '../paths.ts'
import { loadTestCases } from '../input-validation/load-test-cases.ts'
import { FILE_PATTERNS } from '../../harness-config.ts'
import { coverageWarnGate, stepNamesGate, traceGate } from './spec-gates.ts'
import { readSpecFacts } from './spec-source.ts'

/** eslint + ast-grep as gates — same entry the stop hook, `npm run runGates`, and CI use. */
function lintGates(file: string, root: string): GateResult[] {
  return [
    commandGate('eslint', 'npx', ['--no-install', 'eslint', '--max-warnings=0', file], { cwd: root }),
    commandGate('ast-grep', 'ast-grep', ['scan', '--report-style=short', file], { cwd: root }),
  ]
}

/** Spec hook: lint + ast-grep on any src/tests file; plus TC traceability on `*.spec.ts`. */
export function reviewSpecFile(file: string, opts: { root?: string; lint?: boolean } = {}): CheckResult {
  const root = opts.root ?? process.cwd()
  const abs = isAbsolute(file) ? file : join(root, file)
  const rel = relPosix(root, abs)
  const lint = opts.lint === false ? [] : lintGates(rel, root)
  if (!FILE_PATTERNS.specFile.test(rel)) return toCheckResult(file, undefined, lint)

  const ticket = ticketFromFileName(rel)
  if (!ticket)
    return fixRequired(file, ticket, fail('filename', 'spec file name must start with the ticket id, e.g. TOOL-1.contact.api.spec.ts'))

  const loaded = loadTestCases(root, ticket)
  if (!loaded.ok) return fixRequired(file, ticket, loaded.gate)
  const { testCases } = loaded

  const facts = readSpecFacts(readFileSync(abs, 'utf8'))
  return toCheckResult(file, ticket, [
    traceGate(rel, facts, testCases),
    stepNamesGate(facts),
    coverageWarnGate(rel, facts, testCases),
    ...lint,
  ])
}
