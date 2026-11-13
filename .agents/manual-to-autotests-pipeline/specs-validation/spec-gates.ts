import { gateFromProblems, type GateResult } from '../../lib/gateResults.ts'
import type { TestCaseFile } from '../input-validation/input-schemas.ts'
import { levelFromSpecName, readInlineTestData, type SpecTest } from './spec-source.ts'

const STEP_PREFIX = /^(Verify|Confirm) that /
const MAX_PROBLEMS = 4

/** Test titles are the manual TC titles; each carries a `testCase('TC-n')` annotation for the same TC, at the file's level. */
export function traceGate(file: string, tests: SpecTest[], testCases: TestCaseFile): GateResult {
  const byTitle = new Map(testCases.testCases.map(tc => [tc.title, tc]))
  const level = levelFromSpecName(file)
  const problems: string[] = []
  if (tests.length === 0) problems.push('no test(...) found')
  if (!level) problems.push('spec file name must end in .api.spec.ts or .ui.spec.ts')

  for (const { title, tcId } of tests) {
    const tc = byTitle.get(title)
    if (!tc) problems.push(`"${title}" is not a test case title in ${testCases.ticket}`)
    else if (!tcId) problems.push(`"${title}" has no testCase('${tc.id}') annotation`)
    else if (tcId !== tc.id) problems.push(`"${title}" is ${tc.id} but annotated ${tcId}`)
    else if (level && tc.level !== level) problems.push(`${tc.id} is a ${tc.level} test case but this is a ${level} spec`)
  }
  return gateFromProblems('tc-trace', problems.slice(0, MAX_PROBLEMS))
}

export function stepNamesGate(tests: SpecTest[]): GateResult {
  const missing = tests.filter(test => test.stepTitles.length === 0).map(test => `${JSON.stringify(test.title)} has no test.step`)
  const bad = tests
    .flatMap(test => test.stepTitles)
    .filter(title => !STEP_PREFIX.test(title))
    .map(title => `step must start with "Verify that" or "Confirm that": ${JSON.stringify(title)}`)
  return gateFromProblems('step-names', [...missing, ...bad].slice(0, MAX_PROBLEMS))
}

const normaliseStep = (text: string) => text.trim().replace(/[.!]$/, '').toLocaleLowerCase()

/** Every Playwright step uses an action from its annotated manual test case rather than invented wording. */
export function manualStepNamesGate(tests: SpecTest[], testCases: TestCaseFile): GateResult {
  const byId = new Map(testCases.testCases.map(tc => [tc.id, tc]))
  const problems = tests.flatMap(test => {
    const manual = test.tcId ? byId.get(test.tcId) : undefined
    if (!manual) return []
    const actions = new Set(manual.steps.map(step => normaliseStep(step.action)))
    return test.stepTitles
      .filter(title => !actions.has(normaliseStep(title.replace(STEP_PREFIX, ''))))
      .map(title => `${test.tcId} step is not a manual action: ${JSON.stringify(title)}`)
  })
  return gateFromProblems('manual-step-names', problems.slice(0, MAX_PROBLEMS))
}

/** Payloads and expected values come from fixtures, responses, or schemas—not inline literals. */
export function noHardcodedTestDataGate(specs: { file: string; source: string }[]): GateResult {
  return gateFromProblems(
    'no-hardcoded-test-data',
    specs.flatMap(spec => readInlineTestData(spec.source).map(value => `${spec.file}: inline test data ${value}`)),
  )
}

/** Specs receive framework abstractions rather than Playwright's built-in page or request fixtures. */
export function rawFixtureGate(tests: SpecTest[]): GateResult {
  return gateFromProblems(
    'fixture-injection',
    tests.flatMap(test => test.rawFixtures.map(fixture => `${JSON.stringify(test.title)} injects raw ${fixture}`)),
  )
}

/** Every manual test case is automated by exactly one test across all spec files of the ticket. */
export function coverageGate(tests: SpecTest[], testCases: TestCaseFile): GateResult {
  const counts = new Map<string, number>()
  for (const { tcId } of tests) if (tcId) counts.set(tcId, (counts.get(tcId) ?? 0) + 1)
  const ids = testCases.testCases.map(tc => tc.id)
  const missing = ids.filter(id => !counts.has(id))
  const duplicated = ids.filter(id => (counts.get(id) ?? 0) > 1)
  return gateFromProblems('tc-coverage', [
    ...(missing.length ? [`no test annotated for ${missing.join(', ')}`] : []),
    ...(duplicated.length ? [`more than one test annotated for ${duplicated.join(', ')}`] : []),
  ])
}
