import { fail, gateFromProblems, passFailFromSchema, type GateResult } from '../../lib/gateResults.ts'
import type { TestCaseFile } from '../input-validation/input-schemas.ts'
import { explorationSchema, type Exploration } from './schema.ts'

type Context = { testCases: TestCaseFile; exploration: Exploration }

const SEMANTIC_LOCATOR = /^(?:page\.)?getBy(?:Role|Label|Text|Placeholder|AltText|Title|TestId)\(/
const PLACEHOLDER = /\b(?:TODO|TBD|FIXME|xxx|placeholder text)\b|<[^<>]{1,40}>|\.{3}/i
const HAS_HOST = /^[a-z][a-z0-9+.-]*:\/\//i
const MAX_PROBLEMS = 4

const fromProblems = (gate: string, problems: string[]) => gateFromProblems(gate, problems.slice(0, MAX_PROBLEMS))

function referencesGate({ testCases, exploration }: Context): GateResult {
  const tcById = new Map(testCases.testCases.map(tc => [tc.id, tc]))
  const problems: string[] = []

  if (exploration.meta.ticket !== testCases.ticket)
    problems.push(`meta.ticket ${exploration.meta.ticket} ≠ test cases ticket ${testCases.ticket}`)

  for (const loc of exploration.locators)
    if (!tcById.has(loc.tcRef)) problems.push(`locator for ${loc.tcAction}: unknown tcRef ${loc.tcRef}`)
  for (const call of exploration.apiCalls)
    if (!tcById.has(call.tcRef)) problems.push(`API call for ${call.trigger}: unknown tcRef ${call.tcRef}`)

  for (const finding of exploration.findings) {
    const tc = tcById.get(finding.tcRef)
    if (!tc) problems.push(`finding for ${finding.tcRef}: unknown tcRef`)
    else if (finding.step > tc.steps.length) problems.push(`finding for ${tc.id}: no step ${finding.step}`)
  }
  return fromProblems('references', problems)
}

function coverageGate({ testCases, exploration }: Context): GateResult {
  const problems: string[] = []
  for (const tc of testCases.testCases) {
    if (tc.level === 'ui' && !exploration.locators.some(locator => locator.tcRef === tc.id))
      problems.push(`${tc.id} has no verified locator`)
    if (tc.level === 'api' && !exploration.apiCalls.some(call => call.tcRef === tc.id))
      problems.push(`${tc.id} has no observed API call`)
  }
  return fromProblems('coverage', problems)
}

function locatorGate({ exploration }: Context): GateResult {
  const problems: string[] = []
  for (const loc of exploration.locators) {
    if (!SEMANTIC_LOCATOR.test(loc.locator))
      problems.push(`${loc.tcRef}: "${loc.locator}" is not a getBy* locator (no CSS / XPath)`)
    if (PLACEHOLDER.test(loc.locator) || PLACEHOLDER.test(loc.uiLabel))
      problems.push(`${loc.tcRef}: placeholder text in locator or uiLabel`)
    if (loc.uiLabel.trim().toLowerCase() === loc.tcAction.trim().toLowerCase())
      problems.push(`${loc.tcRef}: uiLabel equals tcAction — record the text actually rendered, not the TC wording`)
  }
  return fromProblems('locators', problems)
}

function apiGate({ exploration }: Context): GateResult {
  const problems: string[] = []
  for (const call of exploration.apiCalls) {
    if (!call.pathPattern.startsWith('/') || HAS_HOST.test(call.pathPattern))
      problems.push(`${call.tcRef}: pathPattern must be a path starting with "/" (no host)`)
    if (call.auth === 'bearer' && !exploration.meta.authFile)
      problems.push(`${call.tcRef}: bearer auth but meta.authFile is null`)
  }
  return fromProblems('api-calls', problems)
}

/** The schema gate runs first; the semantic gates need its typed value and are skipped when it fails. */
export function explorationGates(testCases: TestCaseFile, raw: unknown): GateResult[] {
  const { result, value: exploration } = passFailFromSchema(explorationSchema, raw)
  if (!exploration) return [result]
  const ctx = { testCases, exploration }
  return [result, referencesGate(ctx), coverageGate(ctx), locatorGate(ctx), apiGate(ctx)]
}

export const missingExplorationGate = (path: string): GateResult =>
  fail('exploration', `${path} is missing — run the analyse-sut skill on the live system before writing specs`)
