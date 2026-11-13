import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { judgePrompt, parseVerdicts, type Criterion } from './judge.ts'

const criteria: Criterion[] = [
  { id: 'a', description: 'first thing' },
  { id: 'b', description: 'second thing' },
]

describe('parseVerdicts', () => {
  it('maps each verdict to its criterion gate', () => {
    const reply = '[{"id":"a","pass":true,"reason":"ok"},{"id":"b","pass":false,"reason":"weak matcher"}]'
    assert.deepEqual(parseVerdicts(reply, criteria), [
      { gate: 'judge:a', status: 'pass' },
      { gate: 'judge:b', status: 'fail', detail: 'weak matcher' },
    ])
  })

  it('fails missing or unusable verdicts', () => {
    assert.equal(parseVerdicts('[{"id":"a","pass":true,"reason":"ok"}]', criteria)[1]?.status, 'fail')
    for (const reply of ['no json here', '[not json]', '[{"id":"a"}]'])
      assert.deepEqual(parseVerdicts(reply, criteria).map(gate => gate.status), ['fail', 'fail'], reply)
  })
})

describe('judgePrompt', () => {
  it('includes context, reference, output, and every criterion', () => {
    const prompt = judgePrompt({ context: 'the task', reference: 'a good one', output: 'the output', criteria })
    for (const part of ['<context>', '<reference>', '<output>', '- a: first thing', '- b: second thing'])
      assert.ok(prompt.includes(part), part)
  })
})
