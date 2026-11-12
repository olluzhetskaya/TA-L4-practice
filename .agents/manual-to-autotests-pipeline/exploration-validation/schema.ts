/**
 * Output contract of the analyse-sut skill: `.agents/manual-to-autotests-pipeline/artifacts/explore-<TICKET>.json`.
 * Single source of truth — `npm run schema:update` exports it to references/exploration.schema.json
 * so the agent reads the same shape the gates enforce.
 */
import { z } from 'zod'
import { TC_ID_PATTERN, TICKET_PATTERN } from '../input-validation/input-schemas.ts'

const tcRef = z.string().regex(TC_ID_PATTERN)

export const locatorSchema = z.object({
  tcRef,
  tcAction: z.string().min(1).describe('Business wording from the test case step'),
  uiLabel: z.string().min(1).describe('Text actually rendered in the UI'),
  locator: z.string().min(1).describe("Playwright expression, e.g. getByRole('button', { name: 'Send' })"),
  page: z.string().min(1),
  verifiedBy: z.enum(['snapshot', 'click', 'fill', 'select', 'assert']),
  notes: z.string().nullable(),
}).strict()

const observedSchema = z.object({
  case: z.string().min(1).describe('What was sent, in words'),
  status: z.number().int().min(100).max(599),
  body: z.string().nullable().describe('Short note on the response body shape — not a full dump'),
}).strict()

export const apiCallSchema = z.object({
  tcRef,
  trigger: z.string().min(1),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  pathPattern: z.string().min(1).describe('Path only, no host — e.g. /messages/{id}'),
  auth: z.enum(['none', 'bearer']),
  requestFields: z.array(z.string()),
  responseFields: z.array(z.string()),
  observed: z.array(observedSchema).min(1).describe('Live pre-flight results — the contract source of truth'),
}).strict()

/** A place where the live SUT differs from what the manual test case assumes. */
export const findingSchema = z.object({
  tcRef,
  step: z.number().int().positive(),
  expected: z.string().min(1).describe('What the test case says'),
  observed: z.string().min(1).describe('What the live SUT did'),
  resolution: z.enum(['assert-observed', 'move-to-ui', 'move-to-api', 'annotate-gap']),
}).strict()

export const explorationSchema = z.object({
  meta: z.object({
    ticket: z.string().regex(TICKET_PATTERN),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    baseURL: z.url(),
    apiURL: z.url(),
    authFile: z.string().nullable(),
  }).strict(),
  locators: z.array(locatorSchema),
  apiCalls: z.array(apiCallSchema),
  findings: z.array(findingSchema),
}).strict()

export type Exploration = z.infer<typeof explorationSchema>
