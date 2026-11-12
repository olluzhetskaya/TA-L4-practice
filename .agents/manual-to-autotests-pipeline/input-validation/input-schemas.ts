/**
 * Pipeline input contract.
 *
 *   .agents/manual-to-autotests-pipeline/test-cases/<TICKET>.json   REQUIRED  manual test cases (this schema)
 *   .agents/manual-to-autotests-pipeline/stories/<TICKET>.md|json   OPTIONAL  the story the TCs were written for
 *
 * The test cases are already designed (Xray-style Action / Data / Expected). The
 * pipeline does not design them — it automates them.
 */
import { z } from 'zod'

export const TICKET_PATTERN = /^[A-Z][A-Z0-9]+-\d+$/
export const TC_ID_PATTERN = /^TC-\d+$/
export const AC_ID_PATTERN = /^AC-\d+$/

export const testLevelSchema = z.enum(['api', 'ui'])
export type TestLevel = z.infer<typeof testLevelSchema>

const stepSchema = z.object({
  action: z.string().min(1),
  data: z.string().min(1),
  expected: z.string().min(1),
})

export const manualTestCaseSchema = z.object({
  id: z.string().regex(TC_ID_PATTERN, 'id must look like TC-1'),
  title: z.string().min(1),
  level: testLevelSchema,
  priority: z.enum(['Critical', 'High', 'Medium', 'Low']),
  acRefs: z.array(z.string().regex(AC_ID_PATTERN)).min(1),
  preconditions: z.array(z.string()),
  steps: z.array(stepSchema).min(1),
  notes: z.string().nullable(),
})

export const testCaseFileSchema = z
  .object({
    ticket: z.string().regex(TICKET_PATTERN, 'ticket must look like TOOL-1'),
    testCases: z.array(manualTestCaseSchema).min(1),
  })
  .superRefine((file, ctx) => {
    const seen = new Set<string>()
    file.testCases.forEach((tc, index) => {
      if (seen.has(tc.id))
        ctx.addIssue({ code: 'custom', path: ['testCases', index, 'id'], message: `duplicate id ${tc.id}` })
      seen.add(tc.id)
    })
    const titles = new Set<string>()
    file.testCases.forEach((tc, index) => {
      if (titles.has(tc.title))
        ctx.addIssue({ code: 'custom', path: ['testCases', index, 'title'], message: `duplicate title "${tc.title}"` })
      titles.add(tc.title)
    })
  })

export const storyJsonSchema = z.object({
  ticket: z.string().regex(TICKET_PATTERN),
  title: z.string().min(1),
  statement: z.string().min(1),
  acceptanceCriteria: z
    .array(z.object({ id: z.string().regex(AC_ID_PATTERN), text: z.string().min(1) }))
    .min(1),
})

export type ManualTestCase = z.infer<typeof manualTestCaseSchema>
export type TestCaseFile = z.infer<typeof testCaseFileSchema>
export type Step = z.infer<typeof stepSchema>
export type StoryJson = z.infer<typeof storyJsonSchema>

/** Story normalised to what the gates need, whichever format it came in. */
export type StoryContext = { format: 'md' | 'json'; text: string; acIds: string[] }
