import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { Check } from './check.ts'
import { formatSuite, formatTask } from './report.ts'
import type { TaskOutcome } from './run-task.ts'
import { scoreSuite } from './score.ts'

const outcome = (checks: Check[], judgement: Check[] = []): TaskOutcome<string> => ({
  task: 'task',
  workspace: '',
  agentOutput: '',
  checks,
  judgement,
  passed: false,
})

describe('formatTask', () => {
  it('prints ok for a clean task', () => {
    assert.equal(formatTask('TOOL-1 api', outcome([{ name: 'tsc', status: 'pass' }])), 'ok   TOOL-1 api')
  })

  it('lists failed checks and failed judge criteria under a FAIL line', () => {
    const text = formatTask(
      'TOOL-2 api',
      outcome([{ name: 'coverage', status: 'fail', detail: 'no test for TC-3' }], [{ name: 'judge:TC-1', status: 'fail', detail: 'weak' }]),
    )
    assert.equal(text, 'FAIL TOOL-2 api\n       coverage: no test for TC-3\n       judge:TC-1: weak')
  })
})

describe('formatSuite', () => {
  it('summarises rates, failing checks and the advisory judge score', () => {
    const text = formatSuite(
      scoreSuite([outcome([{ name: 'coverage', status: 'fail', detail: 'x' }], [{ name: 'judge:TC-1', status: 'pass' }])]),
    )
    assert.match(text, /tasks passed: 0\/1 \(0\.0%\); checks passed: 0\.0%/)
    assert.match(text, /coverage: 1 failed, 0 passed/)
    assert.match(text, /judge criteria passed \(advisory\): 100\.0% of 1/)
  })

  it('omits the judge line when nothing was judged', () => {
    assert.ok(!formatSuite(scoreSuite([outcome([{ name: 'tsc', status: 'pass' }])])).includes('judge'))
  })
})
