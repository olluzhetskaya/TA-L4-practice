import { fail, pass, type Gate } from './types.ts'

/** Every test case is explored at its own level; UI scenarios drive locators, API scenarios drive calls. */
export const coverageGate: Gate = ({ testCases, exploration }) => {
  const problems: string[] = []
  for (const tc of testCases.testCases) {
    const scenarios = exploration.scenarios.filter(s => s.tcRef === tc.id)
    if (scenarios.length === 0) {
      problems.push(`${tc.id} has no scenario`)
      continue
    }
    for (const scenario of scenarios) {
      if (scenario.level !== tc.level) problems.push(`${scenario.id}: level ${scenario.level} ≠ ${tc.id} level ${tc.level}`)
      const usesLocator = scenario.steps.some(s => s.locatorRef)
      const usesApi = scenario.steps.some(s => s.apiCallRef)
      if (scenario.level === 'ui' && !usesLocator) problems.push(`${scenario.id}: UI scenario references no locator`)
      if (scenario.level === 'api' && !usesApi) problems.push(`${scenario.id}: API scenario references no apiCall`)
    }
  }
  return problems.length ? fail('coverage', problems.slice(0, 4).join('; ')) : pass('coverage')
}
