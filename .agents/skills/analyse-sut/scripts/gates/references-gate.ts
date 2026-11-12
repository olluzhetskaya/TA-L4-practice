import { fail, pass, type Gate } from './types.ts'

/** Every id a scenario or finding points at must exist; steps must be contiguous and ordered. */
export const referencesGate: Gate = ({ testCases, exploration }) => {
  const tcById = new Map(testCases.testCases.map(tc => [tc.id, tc]))
  const locatorIds = new Set(exploration.locators.map(l => l.id))
  const apiIds = new Set(exploration.apiCalls.map(a => a.id))
  const problems: string[] = []

  if (exploration.meta.ticket !== testCases.ticket)
    problems.push(`meta.ticket ${exploration.meta.ticket} ≠ test cases ticket ${testCases.ticket}`)

  for (const loc of exploration.locators)
    if (!tcById.has(loc.tcRef)) problems.push(`locator ${loc.id}: unknown tcRef ${loc.tcRef}`)
  for (const call of exploration.apiCalls)
    if (!tcById.has(call.tcRef)) problems.push(`apiCall ${call.id}: unknown tcRef ${call.tcRef}`)

  for (const scenario of exploration.scenarios) {
    if (!tcById.has(scenario.tcRef)) problems.push(`scenario ${scenario.id}: unknown tcRef ${scenario.tcRef}`)
    scenario.steps.forEach((step, index) => {
      const where = `${scenario.id} step ${step.step}`
      if (step.step !== index + 1) problems.push(`${scenario.id}: steps must be numbered 1..n in order`)
      if (step.locatorRef && !locatorIds.has(step.locatorRef)) problems.push(`${where}: unknown locatorRef ${step.locatorRef}`)
      if (step.apiCallRef && !apiIds.has(step.apiCallRef)) problems.push(`${where}: unknown apiCallRef ${step.apiCallRef}`)
      if (step.dependsOn !== null && step.dependsOn >= step.step) problems.push(`${where}: dependsOn must point to an earlier step`)
      if (step.opensModal && !step.modalDismiss) problems.push(`${where}: opensModal needs modalDismiss`)
    })
  }

  for (const finding of exploration.findings) {
    const tc = tcById.get(finding.tcRef)
    if (!tc) problems.push(`finding ${finding.id}: unknown tcRef ${finding.tcRef}`)
    else if (finding.step > tc.steps.length) problems.push(`finding ${finding.id}: ${tc.id} has no step ${finding.step}`)
  }
  return problems.length ? fail('references', problems.slice(0, 4).join('; ')) : pass('references')
}
