import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readCaseOutcomes } from './playwright-report.ts'

const annotationType = 'case-id'
const test = (id: string, status: string, message?: string) => ({
  annotations: [{ type: annotationType, description: id }],
  status,
  results: [message ? { error: { message } } : {}],
})

const report = (...tests: ReturnType<typeof test>[]) => ({
  suites: [{ specs: [], suites: [{ specs: [{ tests }] }] }],
})

describe('readCaseOutcomes', () => {
  it('maps annotated tests and keeps the first failure per case', () => {
    const outcomes = readCaseOutcomes(
      report(test('TC-1', 'expected'), test('TC-2', 'unexpected', 'Expected 201\nReceived 500'), test('TC-2', 'skipped')),
      annotationType,
    )
    assert.deepEqual(outcomes?.get('TC-1'), { ok: true, detail: undefined })
    assert.deepEqual(outcomes?.get('TC-2'), { ok: false, detail: 'Expected 201' })
  })

  it('accepts expected failures and ignores tests without annotations', () => {
    const input = report(test('TC-3', 'expected', 'bug reproduced'))
    input.suites[0]?.suites?.[0]?.specs?.[0]?.tests.push({ annotations: [], status: 'expected', results: [] })
    const outcomes = readCaseOutcomes(input, annotationType)
    assert.equal(outcomes?.get('TC-3')?.ok, true)
    assert.equal(outcomes?.size, 1)
  })

  it('rejects non-Playwright reports', () => {
    assert.equal(readCaseOutcomes({ nope: true }, annotationType), undefined)
  })
})
