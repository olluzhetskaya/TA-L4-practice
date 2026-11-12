import { TIMEOUTS } from '../../harness-config.ts'
import { fail, type GateResult } from '../../lib/gates/gateResults.ts'
import type { TestLevel } from '../input-validation/input-schemas.ts'
import {
  coverageGate,
  fixtureBoundaryGate,
  manualStepNamesGate,
  stepNamesGate,
  traceGate,
} from '../specs-validation/spec-gates.ts'
import type { EvalItem } from './dataset.ts'
import { protectedFilesGate } from './protected-files.ts'
import { commandGate } from './run-command.ts'
import { runSpecGates } from './run-specs.ts'
import { buildSpecContext } from './spec-context.ts'
import { SPEC_CHECKS } from './spec-checks.ts'

export type SpecGradeOptions = {
  /** Repo the workspace was copied from; protected files are compared against it. */
  repoRoot: string
  runSpecs?: boolean
}

/** The same traceability and coverage gates as `validate:pipeline`, plus style, typecheck, anti-shortcut checks, untouched protected files and (optionally) a per-case run. */
export function gradeSpecs(item: EvalItem, level: TestLevel, workspace: string, opts: SpecGradeOptions): GateResult[] {
  const ctx = buildSpecContext(item, level, workspace)
  if (ctx.specs.length === 0) return [fail('spec', `no tests/${level}/${item.ticket}.*.${level}.spec.ts was written`)]
  const files = ctx.specs.map(spec => spec.file)
  const run = (gate: string, command: string, args: string[], timeoutMs: number) => commandGate(gate, command, args, { cwd: workspace, timeoutMs })
  const testCases = { ticket: item.ticket, testCases: ctx.testCases }
  return [
    ...ctx.specs.flatMap(({ file, source, tests }) =>
      [
        traceGate(file, tests, testCases),
        stepNamesGate(tests),
        manualStepNamesGate(tests, testCases),
        fixtureBoundaryGate(source, tests),
      ].map(g => ({ ...g, gate: `${file}: ${g.gate}` })),
    ),
    coverageGate(ctx.tests, testCases),
    run('eslint', 'npx', ['--no-install', 'eslint', '--max-warnings=0', ...files], TIMEOUTS.style),
    run('ast-grep', 'npx', ['--no-install', 'ast-grep', 'scan', '--report-style=short', ...files], TIMEOUTS.style),
    run('tsc', 'npx', ['--no-install', 'tsc', '--noEmit'], TIMEOUTS.tscCheck),
    ...SPEC_CHECKS.map(check => check(ctx)),
    protectedFilesGate(item, workspace, opts.repoRoot),
    ...(opts.runSpecs ? runSpecGates(ctx) : []),
  ]
}
