import { z } from 'zod'
import { fail, pass, type GateResult } from '../../lib/gates/gateResults.ts'
import type { ManualTestCase } from '../input-validation/input-schemas.ts'
import type { AgentRunner } from './cursor-runner.ts'
import { buildSpecContext } from './spec-context.ts'
import type { SpecTask } from './spec-task.ts'

export type Criterion = { id: string; description: string }

const SCOPE =
  'Judge only whether the assertions verify the expected results. Ignore style, naming, annotations, constants versus literals, whether the code compiles or runs, and test.fail markers: gates already check those.'

const verdictsSchema = z.array(z.object({ id: z.string(), pass: z.boolean(), reason: z.string() }))

const section = (tag: string, body: string) => `<${tag}>\n${body}\n</${tag}>\n\n`

/** One criterion per manual test case, built from its steps: the question no deterministic check can answer. */
export function criterionFor(tc: ManualTestCase): Criterion {
  const steps = tc.steps.map((step, i) => `  ${i + 1}. ${step.action} -> ${step.expected}`).join('\n')
  return {
    id: tc.id,
    description: `The test annotated testCase('${tc.id}') (${tc.title}) verifies each expected result below with an assertion that would fail if that behaviour were wrong. Skipped results, loosened conditions and weak matchers fail this criterion.\n${steps}`,
  }
}

export function judgePrompt(parts: { context: string; reference: string; output: string; criteria: Criterion[] }): string {
  const list = parts.criteria.map(c => `- ${c.id}: ${c.description}`).join('\n')
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

const unscored = (criteria: Criterion[], detail: string): GateResult[] => criteria.map(c => fail(`judge:${c.id}`, detail))

/** One gate per criterion; a reply that is unreadable or skips a criterion counts as failed. */
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
  const byId = new Map(parsed.data.map(v => [v.id, v]))
  return criteria.map(c => {
    const verdict = byId.get(c.id)
    if (!verdict) return fail(`judge:${c.id}`, 'the judge did not score this criterion')
    return verdict.pass ? pass(`judge:${c.id}`) : fail(`judge:${c.id}`, verdict.reason)
  })
}

/**
 * LLM-as-judge for what no gate can decide: do the assertions really verify each test case's expected results?
 * Advisory: its gates are reported next to the deterministic ones and never decide whether a task passed.
 * Use a different model from the one that wrote the specs.
 */
export async function judgeSpecs(task: SpecTask, workspace: string, agent: AgentRunner, model?: string): Promise<GateResult[]> {
  const { specs, goldenSource, testCases } = buildSpecContext(task.item, task.level, workspace)
  if (specs.length === 0) return []
  const criteria = testCases.map(criterionFor)
  const prompt = judgePrompt({
    context: `${SCOPE}\n\nPlaywright ${task.level} spec generated for ${task.item.ticket} from these manual test cases:\n${JSON.stringify(testCases, null, 2)}`,
    reference: goldenSource,
    output: specs.map(spec => spec.source).join('\n'),
    criteria,
  })
  return parseVerdicts(await agent(prompt, { workspace, model }), criteria)
}
