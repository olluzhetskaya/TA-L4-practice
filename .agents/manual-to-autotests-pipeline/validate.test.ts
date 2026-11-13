import assert from 'node:assert/strict'
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { DIRS } from '../harness-config.ts'
import { hasFailure } from '../lib/gateResults.ts'
import { artifactPath, testCasePath } from './paths.ts'
import { buildFollowup, validatePipeline } from './validate.ts'

const API_SPEC = 'tests/api/TOOL-1.contact.api.spec.ts'
const UI_SPEC = 'tests/ui/TOOL-1.contact.ui.spec.ts'
const COPIED = [testCasePath('TOOL-1'), `${DIRS.stories}/TOOL-1.md`, artifactPath('TOOL-1'), 'wiki/TEST-STRATEGY.md', API_SPEC, UI_SPEC]

let root = ''
const abs = (path: string) => join(root, path)
const failing = (complete: boolean) =>
  validatePipeline(root, { complete }).flatMap(r => r.gates.filter(g => g.status === 'fail').map(g => g.gate))

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'pipeline-'))
  for (const path of COPIED) {
    mkdirSync(dirname(abs(path)), { recursive: true })
    cpSync(path, abs(path))
  }
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

describe('pipeline validation', () => {
  it('accepts the complete TOOL-1 pipeline', () => {
    assert.deepEqual(failing(true), [])
  })

  it('requires the exploration artifact', () => {
    rmSync(abs(artifactPath('TOOL-1')))
    assert.deepEqual(failing(true), ['exploration'])
  })

  it('requires the artifact as soon as a spec exists, even while work is in progress', () => {
    rmSync(abs(artifactPath('TOOL-1')))
    assert.deepEqual(failing(false), ['exploration'])
  })

  it('does not demand the artifact before any spec exists while work is in progress', () => {
    rmSync(abs(artifactPath('TOOL-1')))
    rmSync(abs(API_SPEC))
    rmSync(abs(UI_SPEC))
    assert.deepEqual(failing(false), [])
  })

  it('reports an unreadable artifact', () => {
    writeFileSync(abs(artifactPath('TOOL-1')), '{ not json')
    assert.deepEqual(failing(true), ['schema'])
  })

  it('requires a spec for every test case', () => {
    rmSync(abs(UI_SPEC))
    assert.deepEqual(failing(true), ['tc-coverage'])
    assert.deepEqual(failing(false), [])
  })

  it('requires specs to exist at all', () => {
    rmSync(abs(UI_SPEC))
    rmSync(abs(API_SPEC))
    assert.deepEqual(failing(true), ['specs'])
  })

  it('rejects a spec that belongs to no ticket', () => {
    cpSync(abs(UI_SPEC), abs('tests/ui/TOOL-9.extra.ui.spec.ts'))
    assert.deepEqual(failing(true), ['spec-ticket'])
  })

  it('stops at invalid inputs', () => {
    writeFileSync(abs(testCasePath('TOOL-1')), '{}')
    const [report] = validatePipeline(root, { complete: true })
    assert.deepEqual(report?.gates.map(g => g.gate), ['schema'])
  })

  it('fails when there are no test cases at all', () => {
    rmSync(abs(testCasePath('TOOL-1')))
    assert.deepEqual(failing(true), ['input'])
  })

  it('writes a follow-up that names each failing gate', () => {
    rmSync(abs(artifactPath('TOOL-1')))
    const reports = validatePipeline(root, { complete: true })
    assert.ok(reports.some(r => hasFailure(r.gates)))
    assert.match(buildFollowup(reports), /TOOL-1:\n- exploration: .*explore-TOOL-1\.json is missing/)
  })
})
