import { z } from 'zod'

const DETAIL_MAX_CHARS = 200

const testSchema = z.object({
  annotations: z.array(z.object({ type: z.string(), description: z.string().optional() })),
  status: z.string(),
  results: z.array(z.object({ error: z.object({ message: z.string() }).optional() })),
})
type Test = z.infer<typeof testSchema>
type Suite = { specs?: { tests: Test[] }[]; suites?: Suite[] }
const suiteSchema: z.ZodType<Suite> = z.lazy(() =>
  z.object({ specs: z.array(z.object({ tests: z.array(testSchema) })).optional(), suites: z.array(suiteSchema).optional() }),
)
const reportSchema = z.object({ suites: z.array(suiteSchema) })

export type CaseOutcome = { ok: boolean; detail?: string }

const testsOf = (suite: Suite): Test[] => [
  ...(suite.specs ?? []).flatMap(spec => spec.tests),
  ...(suite.suites ?? []).flatMap(testsOf),
]

const firstLine = (message: string | undefined): string | undefined => message?.split('\n')[0]?.slice(0, DETAIL_MAX_CHARS)

/** Read results keyed by a caller-selected Playwright annotation type. */
export function readCaseOutcomes(report: unknown, annotationType: string): Map<string, CaseOutcome> | undefined {
  const parsed = reportSchema.safeParse(report)
  if (!parsed.success) return undefined
  const outcomes = new Map<string, CaseOutcome>()
  for (const test of parsed.data.suites.flatMap(testsOf)) {
    const id = test.annotations.find(annotation => annotation.type === annotationType)?.description
    if (!id) continue
    const ok = test.status === 'expected' && (outcomes.get(id)?.ok ?? true)
    const detail = ok ? undefined : (outcomes.get(id)?.detail ?? firstLine(test.results.at(-1)?.error?.message) ?? test.status)
    outcomes.set(id, { ok, detail })
  }
  return outcomes
}
