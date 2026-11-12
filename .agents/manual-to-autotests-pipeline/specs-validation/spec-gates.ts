import { fail, pass, warn, type GateResult } from '../../lib/gates/gateResults.ts'
import type { TestCaseFile } from '../input-validation/input-schemas.ts'
import { levelFromSpecName, type SpecFacts } from './spec-source.ts'

const STEP_PREFIX = /^(Verify|Confirm) that /

/** Test titles are the manual TC titles; each carries a `testCase('TC-n')` annotation for the same TC. */
export function traceGate(file: string, facts: SpecFacts, testCases: TestCaseFile): GateResult {
  const byTitle = new Map(testCases.testCases.map(tc => [tc.title, tc]))
  const problems: string[] = []
  if (facts.titles.length === 0) problems.push('no test(...) found')
  if (facts.titles.length !== facts.tcIds.length)
    problems.push(`${facts.titles.length} tests but ${facts.tcIds.length} testCase() annotations`)

  facts.titles.forEach((title, i) => {
    const tc = byTitle.get(title)
    if (!tc) {
      problems.push(`"${title}" is not a test case title in ${testCases.ticket}`)
      return
    }
    if (facts.tcIds[i] && facts.tcIds[i] !== tc.id)
      problems.push(`"${title}" is ${tc.id} but annotated ${facts.tcIds[i]}`)
  })

  const level = levelFromSpecName(file)
  if (!level) problems.push('spec file name must end in .api.spec.ts or .ui.spec.ts')
  else
    for (const title of facts.titles) {
      const tc = byTitle.get(title)
      if (tc && tc.level !== level) problems.push(`${tc.id} is a ${tc.level} test case but this is a ${level} spec`)
    }
  return problems.length ? fail('tc-trace', problems.slice(0, 4).join('; ')) : pass('tc-trace')
}

const quoteAll = (items: string[]) => items.map(item => JSON.stringify(item)).join(', ')

export function stepNamesGate(facts: SpecFacts): GateResult {
  const bad = facts.stepTitles.filter(title => !STEP_PREFIX.test(title))
  if (facts.stepTitles.length === 0) return fail('step-names', 'tests must group work in test.step("Verify that …" / "Confirm that …")')
  return bad.length
    ? fail('step-names', `step names must start with "Verify that" or "Confirm that": ${quoteAll(bad.slice(0, 3))}`)
    : pass('step-names')
}

/** Every TC at this spec's level should be automated somewhere — warn (not fail) so a split across files stays legal. */
export function coverageWarnGate(file: string, facts: SpecFacts, testCases: TestCaseFile): GateResult {
  const level = levelFromSpecName(file)
  if (!level) return pass('tc-coverage')
  const covered = new Set(facts.titles)
  const missing = testCases.testCases.filter(tc => tc.level === level && !covered.has(tc.title)).map(tc => tc.id)
  return missing.length
    ? warn('tc-coverage', `${level} test cases not in this file: ${missing.join(', ')}`)
    : pass('tc-coverage')
}
