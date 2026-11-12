import type { ZodType } from 'zod'

export type GateStatus = 'pass' | 'warn' | 'fail'
export type GateResult = { gate: string; status: GateStatus; detail?: string }

export const pass = (gate: string): GateResult => ({ gate, status: 'pass' })
export const fail = (gate: string, detail: string): GateResult => ({ gate, status: 'fail', detail })
export const warn = (gate: string, detail: string): GateResult => ({ gate, status: 'warn', detail })

export const gateFromProblems = (gate: string, problems: string[]): GateResult =>
  problems.length ? fail(gate, problems.join('; ')) : pass(gate)

export const hasFailure = (results: GateResult[]) => results.some(r => r.status === 'fail')

type ZodErrorLike = { issues: { path: PropertyKey[]; message: string }[] }

export function formatZod(error: ZodErrorLike): string {
  return error.issues.slice(0, 3).map(i => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ')
}

export function passFailFromSchema<T>(schema: ZodType<T>, raw: unknown): { result: GateResult; value?: T } {
  const parsed = schema.safeParse(raw)
  if (parsed.success) return { result: pass('schema'), value: parsed.data }
  return { result: fail('schema', formatZod(parsed.error)) }
}
