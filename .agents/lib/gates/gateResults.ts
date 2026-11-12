// Pass, warn, or fail for one deterministic rule on a pipeline artifact.
// A gate is either a pure function over parsed data (schema/semantic gates) or a
// wrapped shell command (see commandGate.ts) — both return the same GateResult.
import type { ZodType } from 'zod'
export type GateStatus = 'pass' | 'warn' | 'fail'
export type GateResult = { gate: string; status: GateStatus; detail?: string }

export const pass = (gate: string): GateResult => ({ gate, status: 'pass' })
export const fail = (gate: string, detail: string): GateResult => ({ gate, status: 'fail', detail })
export const warn = (gate: string, detail: string): GateResult => ({ gate, status: 'warn', detail })

/** Pass when there are no problems, otherwise fail listing them. */
export const gateFromProblems = (gate: string, problems: string[]): GateResult =>
  problems.length ? fail(gate, problems.join('; ')) : pass(gate)

export const hasFailure = (results: GateResult[]) => results.some(r => r.status === 'fail')

export type Decision = 'fix_required' | 'continue'
export type CheckResult = {
  file: string
  ticket?: string
  stage?: string
  gates: GateResult[]
  decision: Decision
}

/** Derive the decision from gate results: any failure blocks the pipeline. */
export const toCheckResult = (
  file: string,
  ticket: string | undefined,
  gates: GateResult[],
): CheckResult => ({
  file,
  ticket,
  gates,
  decision: hasFailure(gates) ? 'fix_required' : 'continue',
})

export const fixRequired = (file: string, ticket: string | undefined, gate: GateResult): CheckResult =>
  toCheckResult(file, ticket, [gate])

type ZodIssueLike = { path: PropertyKey[]; message: string }
type ZodErrorLike = { issues: ZodIssueLike[] }

export function formatZod(error: ZodErrorLike): string {
  return error.issues.slice(0, 3).map(i => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ')
}

/** Parse `raw` with `schema`. Return pass or fail, plus the typed value on success. */
export function passFailFromSchema<T>(schema: ZodType<T>, raw: unknown): { result: GateResult; value?: T } {
  const parsed = schema.safeParse(raw)
  if (parsed.success) return { result: pass('schema'), value: parsed.data }
  return { result: fail('schema', formatZod(parsed.error)) }
}
