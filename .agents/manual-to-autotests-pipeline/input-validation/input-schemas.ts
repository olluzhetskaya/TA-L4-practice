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

/** What the pipeline works with, whatever the Jira export looked like. */
export const manualTestCaseSchema = z.object({
  id: z.string().regex(TC_ID_PATTERN, 'id must look like TC-1'),
  title: z.string().min(1),
  level: testLevelSchema,
  priority: z.enum(['Highest', 'High', 'Medium', 'Low', 'Lowest']),
  acRefs: z.array(z.string().regex(AC_ID_PATTERN)).min(1),
  preconditions: z.array(z.string()),
  steps: z.array(stepSchema).min(1),
  notes: z.string().nullable(),
})

const normalisedFileSchema = z
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

/**
 * The input file is what Jira + Xray give you: the issues returned by a search for the story's tests
 * (`GET /rest/api/2/search?jql=issue in linkedIssues(TOOL-1)`), trimmed to the fields we use.
 * https://docs.getxray.app/space/XRAY/301474262/Tests+-+REST
 *
 *   key                      test id, `TC-n`
 *   fields.summary           test case title
 *   fields.description       free-form notes
 *   fields.priority.name     Jira priority
 *   fields.components        the level: `api` or `ui`
 *   fields.labels            the acceptance criteria the test covers: `AC-n`
 *   fields.issuelinks        link type "Test" → the story; link type "Precondition" → a precondition issue
 *   fields.customfield_10004 Xray "Manual Test Steps" (the id differs per Jira instance)
 */
export const MANUAL_STEPS_FIELD = 'customfield_10004'
const STORY_LINK = 'Test'
const PRECONDITION_LINK = 'Precondition'

const xrayStepSchema = z.object({
  index: z.number().int().positive(),
  fields: z.object({
    action: z.string().min(1),
    data: z.string().min(1),
    'expected result': z.string().min(1),
  }),
})

const issueLinkSchema = z.object({
  type: z.object({ name: z.string() }),
  /** The story the test belongs to: only its key is used. */
  outwardIssue: z.object({ key: z.string().min(1) }).optional(),
  /** A precondition issue: its summary is the precondition text. */
  inwardIssue: z.object({ key: z.string().min(1), fields: z.object({ summary: z.string().min(1) }) }).optional(),
})
type IssueLink = z.infer<typeof issueLinkSchema>

const xrayTestSchema = z.object({
  key: z.string().regex(TC_ID_PATTERN, 'key must look like TC-1'),
  fields: z.object({
    issuetype: z.object({ name: z.literal('Test') }),
    summary: z.string().min(1),
    description: z.string().nullable(),
    priority: z.object({ name: manualTestCaseSchema.shape.priority }),
    components: z.tuple([z.object({ name: testLevelSchema })]),
    labels: z.array(z.string()),
    issuelinks: z.array(issueLinkSchema),
    [MANUAL_STEPS_FIELD]: z.object({ steps: z.array(xrayStepSchema).min(1) }),
  }),
})
type XrayTest = z.infer<typeof xrayTestSchema>

const linksOfType = (test: XrayTest, type: string): IssueLink[] =>
  test.fields.issuelinks.filter(link => link.type.name === type)

const storyKeyOf = (test: XrayTest): string | undefined => linksOfType(test, STORY_LINK)[0]?.outwardIssue?.key

const acRefsOf = (test: XrayTest): string[] => test.fields.labels.filter(label => AC_ID_PATTERN.test(label))

function toManualTestCase(test: XrayTest): z.input<typeof manualTestCaseSchema> {
  const { fields } = test
  return {
    id: test.key,
    title: fields.summary,
    level: fields.components[0].name,
    priority: fields.priority.name,
    acRefs: acRefsOf(test),
    preconditions: linksOfType(test, PRECONDITION_LINK).flatMap(link => link.inwardIssue?.fields.summary ?? []),
    steps: [...fields[MANUAL_STEPS_FIELD].steps]
      .sort((a, b) => a.index - b.index)
      .map(step => ({ action: step.fields.action, data: step.fields.data, expected: step.fields['expected result'] })),
    notes: fields.description,
  }
}

const xrayExportSchema = z
  .object({ issues: z.array(xrayTestSchema).min(1) })
  .superRefine(({ issues }, ctx) => {
    issues.forEach((test, index) => {
      const path = ['issues', index, 'fields', 'issuelinks']
      if (linksOfType(test, STORY_LINK).length !== 1)
        ctx.addIssue({ code: 'custom', path, message: `${test.key} must have exactly one "${STORY_LINK}" link to its story` })
      else if (storyKeyOf(test) !== storyKeyOf(issues[0] ?? test))
        ctx.addIssue({ code: 'custom', path, message: `${test.key} tests ${storyKeyOf(test)}, not ${storyKeyOf(issues[0] ?? test)}` })
    })
  })

/** Parses the Jira/Xray export and yields the normalised `{ ticket, testCases }` every gate and skill reads. */
export const testCaseFileSchema = xrayExportSchema
  .transform(({ issues }) => {
    const [first] = issues
    return { ticket: (first && storyKeyOf(first)) ?? '', testCases: issues.map(toManualTestCase) }
  })
  .pipe(normalisedFileSchema)

export type ManualTestCase = z.infer<typeof manualTestCaseSchema>
export type TestCaseFile = z.infer<typeof testCaseFileSchema>
export const storyJsonSchema = z.object({
  ticket: z.string().regex(TICKET_PATTERN),
  title: z.string().min(1),
  statement: z.string().min(1),
  acceptanceCriteria: z
    .array(z.object({ id: z.string().regex(AC_ID_PATTERN), text: z.string().min(1) }))
    .min(1),
})

export type Step = z.infer<typeof stepSchema>
export type StoryJson = z.infer<typeof storyJsonSchema>

/** Story normalised to what the gates need, whichever format it came in. */
export type StoryContext = { format: 'md' | 'json'; text: string; acIds: string[] }
