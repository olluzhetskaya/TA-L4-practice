import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { commandGate } from './commandGate.ts'

describe('commandGate', () => {
  it('passes on exit 0', () => {
    assert.equal(commandGate('ok', process.execPath, ['-e', 'process.exit(0)']).status, 'pass')
  })

  it('fails with the output tail on a non-zero exit', () => {
    const result = commandGate('bad', process.execPath, ['-e', 'console.error("boom"); process.exit(3)'])
    assert.equal(result.status, 'fail')
    assert.match(result.detail ?? '', /exit 3.*boom/)
  })

  it('fails when the command does not exist', () => {
    assert.equal(commandGate('missing', 'definitely-not-a-binary', []).status, 'fail')
  })

  it('truncates long output', () => {
    const result = commandGate('long', process.execPath, ['-e', 'for (let i=0;i<50;i++) console.error("line"+i); process.exit(1)'], { maxDetailLines: 3 })
    assert.match(result.detail ?? '', /\+\d+ more lines/)
  })
})
