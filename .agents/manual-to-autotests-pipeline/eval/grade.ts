import { TIMEOUTS } from '../../harness-config.ts'
import { commandGate } from '../../lib/gates/commandGate.ts'
import { fail, type GateResult } from '../../lib/gates/gateResults.ts'
import type { TestLevel } from '../input-validation/input-schemas.ts'
import { reviewSpecFile } from '../specs-validation/review-spec-file.ts'
import type { EvalItem } from './dataset.ts'
import { protectedFilesGate } from './protected-files.ts'
import { runSpecGates } from './run-specs.ts'
import { buildSpecContext } from './spec-context.ts'
import { SPEC_CHECKS } from './spec-checks.ts'

export type SpecGradeOptions = {
  /** Repo the workspace was copied from; protected files are compared against it. */
  repoRoot: string
  runSpecs?: boolean
}

const prefixed = (prefix: string, gates: GateResult[]): GateResult[] => gates.map(g => ({ ...g, gate: `${prefix}:${g.gate}` }))

/** Lint and traceability per spec file, typecheck, the deterministic spec checks, untouched protected files, and (optionally) a per-case run. */
export function gradeSpecs(item: EvalItem, level: TestLevel, workspace: string, opts: SpecGradeOptions): GateResult[] {
  const ctx = buildSpecContext(item, level, workspace)
  if (ctx.specFiles.length === 0) return [fail('spec', `no tests/${level}/${item.ticket}.*.${level}.spec.ts was written`)]
  return [
    ...ctx.specFiles.flatMap(file => prefixed(file, reviewSpecFile(file, { root: workspace }).gates)),
    commandGate('tsc', 'npx', ['--no-install', 'tsc', '--noEmit'], { cwd: workspace, timeoutMs: TIMEOUTS.tscCheck }),
    ...SPEC_CHECKS.flatMap(check => check(ctx)),
    protectedFilesGate(item, workspace, opts.repoRoot),
    ...(opts.runSpecs ? runSpecGates(ctx) : []),
  ]
}
