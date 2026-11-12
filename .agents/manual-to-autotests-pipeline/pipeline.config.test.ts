import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { buildFollowup, reviewFile, runHook } from '../scripts/runGates-cli.ts'
import { STAGES, stageFor } from './pipeline.config.ts'

describe('pipeline registry', () => {
  it('routes files to exactly one stage', () => {
    assert.equal(stageFor('.agents/manual-to-autotests-pipeline/test-cases/TOOL-1.json')?.id, 'input')
    assert.equal(stageFor('.agents/manual-to-autotests-pipeline/artifacts/explore-TOOL-1.json')?.id, 'analyse-sut')
    assert.equal(stageFor('tests/api/TOOL-1.contact.api.spec.ts')?.id, 'specs')
    assert.equal(stageFor('src/pages/ContactPage.ts')?.id, 'specs')
  })

  it('ignores generated and unrelated files', () => {
    assert.equal(stageFor('src/types/generated/toolshop-api.d.ts'), undefined)
    assert.equal(stageFor('README.md'), undefined)
  })

  it('has unique stage ids', () => {
    assert.equal(new Set(STAGES.map(s => s.id)).size, STAGES.length)
  })

  it('returns undefined when no stage owns a file', () => {
    assert.equal(reviewFile(process.cwd(), 'README.md'), undefined)
  })
})

describe('stop hook', () => {
  const sandbox = () => {
    const root = mkdtempSync(join(tmpdir(), 'hook-'))
    mkdirSync(join(root, '.agents/manual-to-autotests-pipeline/artifacts'), { recursive: true })
    return root
  }

  it('returns no followup when all stage files are clean', () => {
    const root = sandbox()
    try {
      assert.deepEqual(runHook(root), {})
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('returns a followup for a broken artifact', () => {
    const root = sandbox()
    try {
      writeFileSync(join(root, '.agents/manual-to-autotests-pipeline/artifacts/explore-TOOL-1.json'), '{ not json')
      const { followup_message = '' } = runHook(root)
      assert.match(followup_message, /explore-TOOL-1\.json/)
      assert.match(followup_message, /Rules:/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('buildFollowup lists each failing gate', () => {
    const [stage] = STAGES
    assert.ok(stage)
    const text = buildFollowup('/r', [
      { stage, result: { file: '/r/a.json', gates: [{ gate: 'schema', status: 'fail', detail: 'bad' }], decision: 'fix_required' } },
    ])
    assert.match(text, /- schema: bad/)
  })
})
