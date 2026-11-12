import { gateFromProblems, pass, warn, type GateResult } from '../../lib/gates/gateResults.ts'
import { readBlockFacts, readDisabledTestMarkers, readSpecFacts } from '../specs-validation/spec-source.ts'
import type { SpecContext } from './spec-context.ts'

/** A pure, deterministic rule over the written specs. */
export type SpecCheck = (ctx: SpecContext) => GateResult[]

const idsOf = (testCases: { id: string }[]) => testCases.map(tc => tc.id)

/** Every manual test case of the level is automated by exactly one test. */
export const coverageCheck: SpecCheck = ({ source, testCases }) => {
  const annotated = new Map<string, number>()
  for (const id of readSpecFacts(source).tcIds) annotated.set(id, (annotated.get(id) ?? 0) + 1)
  const missing = idsOf(testCases).filter(id => !annotated.has(id))
  const duplicated = idsOf(testCases).filter(id => (annotated.get(id) ?? 0) > 1)
  const problems = [
    ...(missing.length ? [`no test annotated for ${missing.join(', ')}`] : []),
    ...(duplicated.length ? [`more than one test annotated for ${duplicated.join(', ')}`] : []),
  ]
  return [gateFromProblems('coverage', problems)]
}

/** No test is switched off: a skipped test cannot fail, so it cannot be graded. */
export const noDisabledTestsCheck: SpecCheck = ({ source }) => [
  gateFromProblems(
    'no-disabled-tests',
    readDisabledTestMarkers(source).map(marker => `${marker} disables a test`),
  ),
]

/** `test.fail` marks exactly the cases that hit a known product bug — never a failure that should be fixed. */
export const bugMarkingCheck: SpecCheck = ({ blocks, bugCaseIds }) => {
  const problems = [...blocks].flatMap(([id, block]) => {
    const marked = readBlockFacts(block).expectedFailure
    if (bugCaseIds.has(id) && !marked) return [`${id} hits a product bug, so the test must call test.fail(true, 'BUG: …')`]
    if (!bugCaseIds.has(id) && marked) return [`${id} has no known product bug but calls test.fail`]
    return []
  })
  return [gateFromProblems('bug-marking', problems)]
}

/** Naming-independent facts the golden asserts per case: HTTP statuses (fail) and assertion count (warn). */
export const parityCheck: SpecCheck = ({ blocks, goldenBlocks }) => {
  const missingStatuses: string[] = []
  const thin: string[] = []
  for (const [id, goldenBlock] of goldenBlocks) {
    const block = blocks.get(id)
    if (!block) continue
    const want = readBlockFacts(goldenBlock)
    const got = readBlockFacts(block)
    const lacking = want.statuses.filter(status => !got.statuses.includes(status))
    if (lacking.length) missingStatuses.push(`${id} never asserts HttpStatus.${lacking.join(', HttpStatus.')}`)
    if (got.assertions < want.assertions) thin.push(`${id} has ${got.assertions} assertions, the golden has ${want.assertions}`)
  }
  return [
    gateFromProblems('parity:statuses', missingStatuses),
    thin.length ? warn('parity:assertions', thin.join('; ')) : pass('parity:assertions'),
  ]
}

export const SPEC_CHECKS: readonly SpecCheck[] = [coverageCheck, noDisabledTestsCheck, bugMarkingCheck, parityCheck]
