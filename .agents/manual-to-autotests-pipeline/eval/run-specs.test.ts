import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readCaseOutcomes } from './run-specs.ts'

const test = (id: string, status: string, message?: string) => ({
  annotations: [{ type: 'test-case', description: id }],
  status,
  results: [message ? { error: { message } } : {}],
})

const report = (...tests: ReturnType<typeof test>[]) => ({
  suites: [{ specs: [], suites: [{ specs: [{ tests }] }] }],
})

describe('readCaseOutcomes', () => {
  it('maps each annotated test to its test case', () => {
    const outcomes = readCaseOutcomes(report(test('TC-1', 'expected'), test('TC-2', 'unexpected', 'Expected 201\nReceived 500')))
    assert.deepEqual(outcomes?.get('TC-1'), { ok: true, detail: undefined })
    assert.deepEqual(outcomes?.get('TC-2'), { ok: false, detail: 'Expected 201' })
  })

  it('counts an expected failure (test.fail on a bug) as ok because Playwright reports it as expected', () => {
    assert.equal(readCaseOutcomes(report(test('TC-3', 'expected', 'bug reproduced')))?.get('TC-3')?.ok, true)
  })

  it('is not ok when any test of a case is not ok', () => {
    const outcomes = readCaseOutcomes(report(test('TC-1', 'expected'), test('TC-1', 'skipped')))
    assert.deepEqual(outcomes?.get('TC-1'), { ok: false, detail: 'skipped' })
  })

  it('ignores tests without a test case annotation', () => {
    const outcomes = readCaseOutcomes(report({ annotations: [], status: 'expected', results: [] }))
    assert.equal(outcomes?.size, 0)
  })

  it('returns undefined for anything that is not a Playwright report', () => {
    assert.equal(readCaseOutcomes({ nope: true }), undefined)
  })
})
