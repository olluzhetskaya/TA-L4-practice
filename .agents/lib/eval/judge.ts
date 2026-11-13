import { z } from 'zod'
import { fail, pass, type GateResult } from '../gateResults.ts'

export type Criterion = { id: string; description: string }

const verdictsSchema = z.array(z.object({ id: z.string(), pass: z.boolean(), reason: z.string() }))

const section = (tag: string, body: string) => `<${tag}>\n${body}\n</${tag}>\n\n`

/** Build a tool-free judge prompt from task context, one reference, output, and explicit criteria. */
export function judgePrompt(parts: { context: string; reference: string; output: string; criteria: Criterion[] }): string {
  const list = parts.criteria.map(criterion => `- ${criterion.id}: ${criterion.description}`).join('\n')
  return (
    'You are grading an output against explicit criteria. Do not use tools or read files; everything you need is below.\n' +
    'Judge only the criteria listed. A criterion passes only when the output clearly satisfies it. The reference is one acceptable answer, not the only one.\n\n' +
    section('context', parts.context) +
    section('reference', parts.reference) +
    section('output', parts.output) +
    section('criteria', list) +
    'Respond with only a JSON array, one object per criterion: [{"id": "<criterion id>", "pass": true, "reason": "<one sentence>"}]'
  )
}

const unscored = (criteria: Criterion[], detail: string): GateResult[] =>
  criteria.map(criterion => fail(`judge:${criterion.id}`, detail))

/** Parse one judge verdict per criterion; missing or malformed verdicts fail closed. */
export function parseVerdicts(reply: string, criteria: Criterion[]): GateResult[] {
  const start = reply.indexOf('[')
  const end = reply.lastIndexOf(']')
  if (start < 0 || end < start) return unscored(criteria, 'the judge reply held no JSON array')
  let raw: unknown
  try {
    raw = JSON.parse(reply.slice(start, end + 1))
  } catch {
    return unscored(criteria, 'the judge reply was not valid JSON')
  }
  const parsed = verdictsSchema.safeParse(raw)
  if (!parsed.success) return unscored(criteria, 'the judge verdicts did not match {id, pass, reason}')
  const byId = new Map(parsed.data.map(verdict => [verdict.id, verdict]))
  return criteria.map(criterion => {
    const verdict = byId.get(criterion.id)
    if (!verdict) return fail(`judge:${criterion.id}`, 'the judge did not score this criterion')
    return verdict.pass ? pass(`judge:${criterion.id}`) : fail(`judge:${criterion.id}`, verdict.reason)
  })
}
