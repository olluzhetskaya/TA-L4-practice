/**
 * Output contract of the analyse-sut skill: `.agents/manual-to-autotests-pipeline/artifacts/explore-<TICKET>.json`.
 * Single source of truth — `npm run schema` exports it to references/exploration.schema.json
 * so the agent reads the same shape the gates enforce.
 */
import { z } from 'zod'
import { AC_ID_PATTERN, TC_ID_PATTERN, TICKET_PATTERN, testLevelSchema } from '../../../manual-to-autotests-pipeline/input-validation/input-schemas.ts'

const tcRef = z.string().regex(TC_ID_PATTERN)

export const locatorSchema = z.object({
  id: z.string().min(1).describe('Stable key referenced by scenario steps, e.g. "contact.sendButton"'),
  tcRef,
  tcAction: z.string().min(1).describe('Business wording from the test case step'),
  uiLabel: z.string().min(1).describe('Text actually rendered in the UI'),
  locator: z.string().min(1).describe("Playwright expression, e.g. getByRole('button', { name: 'Send' })"),
  page: z.string().min(1),
  verifiedBy: z.enum(['snapshot', 'click', 'fill', 'select', 'assert']),
  notes: z.string().nullable(),
})

const observedSchema = z.object({
  case: z.string().min(1).describe('What was sent, in words'),
  status: z.number().int().min(100).max(599),
  body: z.string().nullable().describe('Short note on the response body shape — not a full dump'),
})

export const apiCallSchema = z.object({
  id: z.string().min(1),
  tcRef,
  trigger: z.string().min(1),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  pathPattern: z.string().min(1).describe('Path only, no host — e.g. /messages/{id}'),
  auth: z.enum(['none', 'bearer']),
  requestFields: z.array(z.string()),
  responseFields: z.array(z.string()),
  observed: z.array(observedSchema).min(1).describe('Live pre-flight results — the contract source of truth'),
  typedClient: z.string().nullable().describe('Existing client method, or null'),
  needsClient: z.boolean(),
})

const stepSchema = z.object({
  step: z.number().int().positive(),
  action: z.string().min(1),
  locatorRef: z.string().nullable(),
  apiCallRef: z.string().nullable(),
  opensModal: z.boolean(),
  modalDismiss: z.string().nullable(),
  buttonState: z.enum(['disabled-on-open', 'disabled-until-loaded']).nullable(),
  outcome: z.string().min(1).describe('Observable result — specific, never "it works"'),
  dependsOn: z.number().int().positive().nullable(),
  notes: z.string().nullable(),
})

export const scenarioSchema = z.object({
  id: z.string().min(1),
  tcRef,
  level: testLevelSchema,
  description: z.string().min(1),
  precondition: z.string().nullable(),
  steps: z.array(stepSchema).min(1),
})

/** A place where the live SUT differs from what the manual test case assumes. */
export const findingSchema = z.object({
  id: z.string().min(1),
  tcRef,
  step: z.number().int().positive(),
  expected: z.string().min(1).describe('What the test case says'),
  observed: z.string().min(1).describe('What the live SUT did'),
  resolution: z.enum(['assert-observed', 'move-to-ui', 'move-to-api', 'annotate-gap']),
})

const filePlan = z.object({
  className: z.string().min(1),
  file: z.string().min(1),
  newMethods: z.array(z.string()),
  reusedFrom: z.array(z.string()),
})

export const explorationSchema = z.object({
  meta: z.object({
    ticket: z.string().regex(TICKET_PATTERN),
    featureSlug: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    baseURL: z.url(),
    apiURL: z.url(),
    authMode: z.enum(['anonymous', 'customer']),
    authFile: z.string().nullable(),
    acCovered: z.array(z.string().regex(AC_ID_PATTERN)),
  }),
  locators: z.array(locatorSchema),
  apiCalls: z.array(apiCallSchema),
  scenarios: z.array(scenarioSchema).min(1),
  findings: z.array(findingSchema),
  pomPlan: z.object({
    pages: z.array(filePlan),
    apiClients: z.array(filePlan),
  }),
})

export type Exploration = z.infer<typeof explorationSchema>
