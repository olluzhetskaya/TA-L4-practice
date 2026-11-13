import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { commandGate } from './command-gate.ts'

const options = { cwd: process.cwd(), timeoutMs: 5_000 }

describe('commandGate', () => {
  it('maps command exit status and output to a gate', () => {
    assert.equal(commandGate('ok', process.execPath, ['-e', 'process.exit(0)'], options).status, 'pass')
    const failed = commandGate('bad', process.execPath, ['-e', 'console.error("boom"); process.exit(3)'], options)
    assert.equal(failed.status, 'fail')
    assert.match(failed.detail ?? '', /exit 3.*boom/)
  })

  it('fails when the command cannot start', () => {
    assert.equal(commandGate('missing', 'definitely-not-a-binary', [], options).status, 'fail')
  })
})
