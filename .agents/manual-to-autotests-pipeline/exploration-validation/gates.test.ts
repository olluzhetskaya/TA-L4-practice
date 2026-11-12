import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { DIRS } from '../../harness-config.ts'
import { testCaseFileSchema } from '../input-validation/input-schemas.ts'
import { explorationSchema, type Exploration } from './schema.ts'
import { explorationGates as runGates } from './gates.ts'

const testCases = testCaseFileSchema.parse(JSON.parse(readFileSync(`${DIRS.testCases}/TOOL-1.json`, 'utf8')))
const reference = explorationSchema.parse(JSON.parse(readFileSync(`${DIRS.artifacts}/explore-TOOL-1.json`, 'utf8')))

const mutate = (change: (draft: Exploration) => void) => {
  const draft = structuredClone(reference)
  change(draft)
  return runGates(testCases, draft)
}
const at = <T,>(items: T[], index: number): T => {
  const item = items[index]
  if (item === undefined) throw new Error(`no item at ${index}`)
  return item
}
const failing = (results: ReturnType<typeof runGates>) => results.filter(r => r.status === 'fail').map(r => r.gate)

describe('analyse-sut gates', () => {
  it('accepts the reference artifact', () => {
    assert.deepEqual(failing(runGates(testCases, reference)), [])
  })

  it('fails the schema gate on garbage', () => {
    assert.deepEqual(failing(runGates(testCases, { meta: {} })), ['schema'])
  })

  it('rejects implementation plans outside the evidence contract', () => {
    assert.deepEqual(failing(runGates(testCases, { ...reference, pomPlan: {} })), ['schema'])
  })

  it('rejects CSS locators', () => {
    const results = mutate(d => {
      at(d.locators, 0).locator = "locator('#first_name')"
    })
    assert.deepEqual(failing(results), ['locators'])
  })

  it('rejects placeholder locators', () => {
    const results = mutate(d => {
      at(d.locators, 0).locator = "getByRole('button', { name: '<TODO>' })"
    })
    assert.deepEqual(failing(results), ['locators'])
  })

  it('rejects a uiLabel copied from the test case wording', () => {
    const results = mutate(d => {
      at(d.locators, 0).uiLabel = at(d.locators, 0).tcAction
    })
    assert.deepEqual(failing(results), ['locators'])
  })

  it('rejects unknown references', () => {
    const results = mutate(d => {
      at(d.locators, 0).tcRef = 'TC-99'
    })
    assert.deepEqual(failing(results), ['references'])
  })

  it('requires verified locator evidence for every UI test case', () => {
    const results = mutate(d => {
      d.locators = d.locators.filter(locator => locator.tcRef !== 'TC-4')
    })
    assert.deepEqual(failing(results), ['coverage'])
  })

  it('requires observed API evidence for every API test case', () => {
    const results = mutate(d => {
      d.apiCalls = d.apiCalls.filter(call => call.tcRef !== 'TC-2')
    })
    assert.deepEqual(failing(results), ['coverage'])
  })

  it('rejects hosts in API path patterns', () => {
    const results = mutate(d => {
      at(d.apiCalls, 0).pathPattern = 'https://api.practicesoftwaretesting.com/messages'
    })
    assert.deepEqual(failing(results), ['api-calls'])
  })

  it('requires at least one observed live result per API call', () => {
    const results = mutate(d => {
      at(d.apiCalls, 0).observed = []
    })
    assert.deepEqual(failing(results), ['schema'])
  })
})
