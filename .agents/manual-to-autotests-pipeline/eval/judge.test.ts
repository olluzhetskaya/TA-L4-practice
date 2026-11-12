import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { Criterion } from './judge.ts'
import { judgePrompt, parseVerdicts } from './judge.ts'

const criteria: Criterion[] = [
  { id: 'a', description: 'first thing' },
  { id: 'b', description: 'second thing' },
]

describe('parseVerdicts', () => {
  it('maps each verdict to a gate named after its criterion', () => {
    const reply = 'Sure!\n[{"id":"a","pass":true,"reason":"ok"},{"id":"b","pass":false,"reason":"weak matcher"}]'
    assert.deepEqual(parseVerdicts(reply, criteria), [
      { gate: 'judge:a', status: 'pass' },
      { gate: 'judge:b', status: 'fail', detail: 'weak matcher' },
    ])
  })

  it('fails a criterion the judge skipped', () => {
    const gates = parseVerdicts('[{"id":"a","pass":true,"reason":"ok"}]', criteria)
    assert.equal(gates[1]?.status, 'fail')
    assert.match(gates[1]?.detail ?? '', /did not score/)
  })

  it('fails every criterion when the reply is not usable', () => {
    for (const reply of ['no json here', '[not json]', '[{"id":"a"}]']) {
      assert.deepEqual(parseVerdicts(reply, criteria).map(g => g.status), ['fail', 'fail'], reply)
    }
  })
})

describe('judgePrompt', () => {
  it('puts context, reference, output and every criterion in the prompt', () => {
    const prompt = judgePrompt({ context: 'the task', reference: 'a good one', output: 'the spec', criteria })
    for (const part of ['<context>', '<reference>', '<output>', '- a: first thing', '- b: second thing'])
      assert.ok(prompt.includes(part), part)
  })
})
