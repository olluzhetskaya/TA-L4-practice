import type { Check } from '../../lib/eval/check.ts'
import type { AgentRunner } from '../../lib/eval/cursor-runner.ts'
import { judge, type Criterion } from '../../lib/eval/judge.ts'
import type { ManualTestCase, TestLevel } from '../input-validation/input-schemas.ts'
import type { EvalItem } from './dataset.ts'
import { buildSpecContext } from './spec-context.ts'

const SCOPE =
  'Judge only whether the assertions verify the expected results. Ignore style, naming, annotations, constants versus literals, whether the code compiles or runs, and test.fail markers: gates already check those.'

function criterionFor(tc: ManualTestCase): Criterion {
  const steps = tc.steps.map((step, i) => `  ${i + 1}. ${step.action} -> ${step.expected}`).join('\n')
  return {
    id: tc.id,
    description: `The test annotated testCase('${tc.id}') (${tc.title}) verifies each expected result below with an assertion that would fail if that behaviour were wrong. Skipped results, loosened conditions and weak matchers fail this criterion.\n${steps}`,
  }
}

export type JudgeSpecsOptions = { model?: string; timeoutMs?: number }

/** Rubric for what no gate can decide: do the assertions really verify each test case's expected results? Advisory, not a gate. */
export async function judgeSpecs(
  item: EvalItem,
  level: TestLevel,
  workspace: string,
  agent: AgentRunner,
  options: JudgeSpecsOptions = {},
): Promise<Check[]> {
  const { specFiles, source, goldenSource, testCases } = buildSpecContext(item, level, workspace)
  if (specFiles.length === 0) return []
  return judge(
    agent,
    {
      subject: source,
      reference: goldenSource,
      context: `${SCOPE}\n\nPlaywright ${level} spec generated for ${item.ticket} from these manual test cases:\n${JSON.stringify(testCases, null, 2)}`,
      criteria: testCases.map(criterionFor),
    },
    { workspace, ...options },
  )
}
