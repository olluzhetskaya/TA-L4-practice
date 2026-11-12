import { gateFromProblems, type GateResult } from '../../lib/gates/gateResults.ts'
import { readDisabledTestMarkers } from '../specs-validation/spec-source.ts'
import type { SpecContext } from './spec-context.ts'

/** A pure, deterministic rule over the written specs. */
export type SpecCheck = (ctx: SpecContext) => GateResult

/** No test is switched off: a skipped test cannot fail, so it cannot be graded. */
export const noDisabledTestsCheck: SpecCheck = ({ specs }) =>
  gateFromProblems(
    'no-disabled-tests',
    [...new Set(specs.flatMap(spec => readDisabledTestMarkers(spec.source)))].map(marker => `${marker} disables a test`),
  )

/** `test.fail` marks exactly the cases that hit a known product bug — never a failure that should be fixed. */
export const bugMarkingCheck: SpecCheck = ({ tests, bugCaseIds }) =>
  gateFromProblems(
    'bug-marking',
    tests.flatMap(({ tcId, expectedFailure }) => {
      if (!tcId) return []
      if (bugCaseIds.has(tcId) && !expectedFailure) return [`${tcId} hits a product bug, so the test must call test.fail(true, 'BUG: …')`]
      if (!bugCaseIds.has(tcId) && expectedFailure) return [`${tcId} has no known product bug but calls test.fail`]
      return []
    }),
  )

/** Every HTTP status the golden asserts for a case must also be asserted by the written test; helper and constant names are free. */
export const statusParityCheck: SpecCheck = ({ tests, goldenTests }) =>
  gateFromProblems(
    'parity:statuses',
    goldenTests.flatMap(golden => {
      const written = golden.tcId ? tests.find(test => test.tcId === golden.tcId) : undefined
      const lacking = written ? golden.statuses.filter(status => !written.statuses.includes(status)) : []
      return lacking.length ? [`${golden.tcId} never asserts HttpStatus.${lacking.join(', HttpStatus.')}`] : []
    }),
  )

/** The generated test keeps at least the assertion matcher strength demonstrated by the controlled golden output. */
export const assertionParityCheck: SpecCheck = ({ tests, goldenTests }) =>
  gateFromProblems(
    'parity:assertions',
    goldenTests.flatMap(golden => {
      const written = golden.tcId ? tests.find(test => test.tcId === golden.tcId) : undefined
      if (!written) return []
      const available = [...written.matchers]
      const missing = golden.matchers.filter(matcher => {
        const index = available.indexOf(matcher)
        if (index < 0) return true
        available.splice(index, 1)
        return false
      })
      return missing.length ? [`${golden.tcId} lacks assertion matcher(s): ${missing.join(', ')}`] : []
    }),
  )

export const SPEC_CHECKS: readonly SpecCheck[] = [
  noDisabledTestsCheck,
  bugMarkingCheck,
  statusParityCheck,
  assertionParityCheck,
]
