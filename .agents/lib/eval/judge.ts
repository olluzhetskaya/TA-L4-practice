import { z } from 'zod'
import type { Check } from './check.ts'
import type { AgentRunner } from './cursor-runner.ts'

export type Criterion = { id: string; description: string }

export type JudgeInput = {
  /** The output under review. */
  subject: string
  /** What the subject was asked to do. */
  context?: string
  /** A known-good answer to calibrate against; the subject need not look like it. */
  reference?: string
  criteria: Criterion[]
}

export type JudgeOptions = {
  /** Disposable directory the judge agent runs in. */
  workspace: string
  model?: string
  timeoutMs?: number
}

const verdictsSchema = z.array(z.object({ id: z.string(), pass: z.boolean(), reason: z.string() }))

const section = (tag: string, body: string | undefined): string => (body ? `<${tag}>\n${body}\n</${tag}>\n\n` : '')

export function judgePrompt({ subject, context, reference, criteria }: JudgeInput): string {
  const list = criteria.map(c => `- ${c.id}: ${c.description}`).join('\n')
  return (
    'You are grading an output against explicit criteria. Do not use tools or read files; everything you need is below.\n' +
    'Judge only the criteria listed. A criterion passes only when the output clearly satisfies it. The reference is one acceptable answer, not the only one.\n\n' +
    section('context', context) +
    section('reference', reference) +
    section('output', subject) +
    `<criteria>\n${list}\n</criteria>\n\n` +
    'Respond with only a JSON array, one object per criterion: [{"id": "<criterion id>", "pass": true, "reason": "<one sentence>"}]'
  )
}

const unscored = (criteria: Criterion[], detail: string): Check[] =>
  criteria.map(c => ({ name: `judge:${c.id}`, status: 'fail', detail }))

/** Turn the judge's raw reply into one check per criterion; anything unreadable or missing counts as failed. */
export function parseVerdicts(reply: string, criteria: Criterion[]): Check[] {
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
  const byId = new Map(parsed.data.map(v => [v.id, v]))
  return criteria.map((c): Check => {
    const verdict = byId.get(c.id)
    if (!verdict) return { name: `judge:${c.id}`, status: 'fail', detail: 'the judge did not score this criterion' }
    return { name: `judge:${c.id}`, status: verdict.pass ? 'pass' : 'fail', detail: verdict.reason }
  })
}

/** Rubric grading: one agent call, one check per criterion. Prefer a different model from the one that produced the subject. */
export async function judge(agent: AgentRunner, input: JudgeInput, options: JudgeOptions): Promise<Check[]> {
  const reply = await agent(judgePrompt(input), {
    workspace: options.workspace,
    model: options.model,
    timeoutMs: options.timeoutMs,
  })
  return parseVerdicts(reply, input.criteria)
}
