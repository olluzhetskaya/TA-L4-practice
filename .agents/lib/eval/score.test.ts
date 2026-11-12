import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { Check } from './check.ts'
import type { TaskOutcome } from './run-task.ts'
import { scoreSuite, scoreTask } from './score.ts'

const pass = (name: string): Check => ({ name, status: 'pass' })
const warn = (name: string, detail: string): Check => ({ name, status: 'warn', detail })
const fail = (name: string, detail: string): Check => ({ name, status: 'fail', detail })

const outcome = (checks: Check[], judgement: Check[] = []): TaskOutcome<string> => ({
  task: 'task',
  workspace: '',
  agentOutput: '',
  checks,
  judgement,
  passed: false,
})

describe('scoreTask', () => {
  it('passes when no check fails, warnings included', () => {
    const score = scoreTask(outcome([pass('a'), warn('b', 'minor')]))
    assert.deepEqual(score, { passed: true, checkCount: 2, passCount: 1, passRate: 0.5 })
  })

  it('fails when any check fails', () => {
    const score = scoreTask(outcome([pass('a'), fail('b', 'broken')]))
    assert.equal(score.passed, false)
    assert.equal(score.passRate, 0.5)
  })

  it('fails a task that produced no checks', () => {
    assert.deepEqual(scoreTask(outcome([])), { passed: false, checkCount: 0, passCount: 0, passRate: 0 })
  })
})

describe('scoreSuite', () => {
  it('aggregates task and check pass rates with per-check stats', () => {
    const suite = scoreSuite([
      outcome([pass('tsc'), pass('coverage')]),
      outcome([pass('tsc'), fail('coverage', 'missing TC-1')]),
    ])
    assert.equal(suite.taskCount, 2)
    assert.equal(suite.allPassCount, 1)
    assert.equal(suite.allPassRate, 0.5)
    assert.equal(suite.checkPassRate, 0.75)
    assert.equal(suite.judgeCheckCount, 0)
    assert.deepEqual(suite.byCheck, {
      tsc: { pass: 2, fail: 0, warn: 0 },
      coverage: { pass: 1, fail: 1, warn: 0 },
    })
  })

  it('scores judge checks separately from the pass/fail checks', () => {
    const suite = scoreSuite([outcome([pass('tsc')], [pass('judge:TC-1'), fail('judge:TC-2', 'weak')])])
    assert.equal(suite.allPassRate, 1)
    assert.equal(suite.judgeCheckCount, 2)
    assert.equal(suite.judgePassRate, 0.5)
    assert.deepEqual(Object.keys(suite.byCheck), ['tsc'])
  })

  it('returns zero rates for an empty suite', () => {
    assert.deepEqual(scoreSuite([]), { taskCount: 0, allPassCount: 0, allPassRate: 0, checkPassRate: 0, byCheck: {}, judgeCheckCount: 0, judgePassRate: 0 })
  })
})
