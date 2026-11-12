import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { AgentRunner } from './cursor-runner.ts'
import { judge, judgePrompt, parseVerdicts, type Criterion } from './judge.ts'

const criteria: Criterion[] = [
  { id: 'a', description: 'first thing' },
  { id: 'b', description: 'second thing' },
]

describe('parseVerdicts', () => {
  it('maps each verdict to a check named after its criterion', () => {
    const reply = 'Sure!\n[{"id":"a","pass":true,"reason":"ok"},{"id":"b","pass":false,"reason":"weak matcher"}]'
    assert.deepEqual(parseVerdicts(reply, criteria), [
      { name: 'judge:a', status: 'pass', detail: 'ok' },
      { name: 'judge:b', status: 'fail', detail: 'weak matcher' },
    ])
  })

  it('fails a criterion the judge skipped', () => {
    const checks = parseVerdicts('[{"id":"a","pass":true,"reason":"ok"}]', criteria)
    assert.equal(checks[1]?.status, 'fail')
    assert.match(checks[1]?.detail ?? '', /did not score/)
  })

  it('fails every criterion when the reply is not usable', () => {
    for (const reply of ['no json here', '[not json]', '[{"id":"a"}]']) {
      assert.deepEqual(parseVerdicts(reply, criteria).map(c => c.status), ['fail', 'fail'], reply)
    }
  })
})

describe('judge', () => {
  it('sends criteria and sections to the agent in the given workspace and parses the reply', async () => {
    let seen: { prompt: string; workspace?: string; model?: string } | undefined
    const agent: AgentRunner = async (prompt, options) => {
      seen = { prompt, workspace: options?.workspace, model: options?.model }
      return '[{"id":"a","pass":true,"reason":"ok"},{"id":"b","pass":true,"reason":"ok"}]'
    }
    const checks = await judge(
      agent,
      { subject: 'the output', reference: 'a good one', context: 'the task', criteria },
      { workspace: '/tmp/ws', model: 'other-model' },
    )
    assert.deepEqual(checks.map(c => c.status), ['pass', 'pass'])
    assert.equal(seen?.workspace, '/tmp/ws')
    assert.equal(seen?.model, 'other-model')
    for (const part of ['<output>', '<reference>', '<context>', '- a: first thing', '- b: second thing']) {
      assert.ok(seen?.prompt.includes(part), part)
    }
  })

  it('leaves out sections it was not given', () => {
    const prompt = judgePrompt({ subject: 'x', criteria })
    assert.ok(!prompt.includes('<reference>') && !prompt.includes('<context>'))
  })
})
