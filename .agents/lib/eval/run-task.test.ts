import assert from 'node:assert/strict'
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { fail, pass } from '../gateResults.ts'
import { runEvalTask } from './run-task.ts'

describe('runEvalTask', () => {
  it('runs the task, keeps judgement advisory, and cleans the workspace', async () => {
    let workspace = ''
    const outcome = await runEvalTask('task', {
      agent: async () => 'done',
      buildWorkspace: () => {
        workspace = mkdtempSync(join(tmpdir(), 'eval-lib-'))
        return workspace
      },
      promptFor: task => task,
      grade: () => [pass('grade')],
      judge: async () => [fail('judge:quality', 'advisory')],
    })
    assert.equal(outcome.passed, true)
    assert.equal(outcome.judgement[0]?.status, 'fail')
    assert.equal(existsSync(workspace), false)
  })
})
