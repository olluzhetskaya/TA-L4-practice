import type { GateResult } from '../../lib/gateResults.ts'
import type { AgentRunner } from '../../lib/eval/cursor-runner.ts'
import { judgePrompt, parseVerdicts, type Criterion } from '../../lib/eval/judge.ts'
import type { ManualTestCase } from '../input-validation/input-schemas.ts'
import { buildSpecContext } from './spec-context.ts'
import type { SpecTask } from './spec-task.ts'

const SCOPE =
  'Judge only whether the assertions verify the expected results. Ignore style, naming, annotations, constants versus literals, whether the code compiles or runs, and test.fail markers: gates already check those.'

/** One criterion per manual test case, built from its steps: the question no deterministic check can answer. */
export function criterionFor(tc: ManualTestCase): Criterion {
  const steps = tc.steps.map((step, i) => `  ${i + 1}. ${step.action} -> ${step.expected}`).join('\n')
  return {
    id: tc.id,
    description: `The test annotated testCase('${tc.id}') (${tc.title}) verifies each expected result below with an assertion that would fail if that behaviour were wrong. Skipped results, loosened conditions and weak matchers fail this criterion.\n${steps}`,
  }
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
