import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { DIRS } from '../../harness-config.ts'
import { testCaseFileSchema } from '../input-validation/input-schemas.ts'
import { coverageWarnGate, stepNamesGate, traceGate } from './spec-gates.ts'
import { levelFromSpecName, readSpecFacts } from './spec-source.ts'

const testCases = testCaseFileSchema.parse(JSON.parse(readFileSync(`${DIRS.testCases}/TOOL-1.json`, 'utf8')))
const uiFile = 'tests/ui/TOOL-1.contact.ui.spec.ts'
const goodSource = readFileSync(uiFile, 'utf8')

describe('spec traceability gates', () => {
  it('reads titles, steps and testCase ids from a spec', () => {
    const facts = readSpecFacts(goodSource)
    assert.equal(facts.titles.length, 2)
    assert.deepEqual(facts.tcIds, ['TC-3', 'TC-4'])
    assert.equal(facts.stepTitles.length, 4)
  })

  it('accepts the reference UI spec', () => {
    const facts = readSpecFacts(goodSource)
    assert.equal(traceGate(uiFile, facts, testCases).status, 'pass')
    assert.equal(stepNamesGate(facts).status, 'pass')
    assert.equal(coverageWarnGate(uiFile, facts, testCases).status, 'pass')
  })

  it('fails an invented test title', () => {
    const facts = readSpecFacts(goodSource.replace('Verify that a visitor can send a message through the contact form', 'Sends a message'))
    assert.match(traceGate(uiFile, facts, testCases).detail ?? '', /not a test case title/)
  })

  it('fails a mismatched testCase annotation', () => {
    const facts = readSpecFacts(goodSource.replace("testCase('TC-3')", "testCase('TC-1')"))
    assert.match(traceGate(uiFile, facts, testCases).detail ?? '', /annotated TC-1/)
  })

  it('fails a UI test case placed in an API spec', () => {
    const facts = readSpecFacts(goodSource)
    assert.match(traceGate('tests/api/TOOL-1.contact.api.spec.ts', facts, testCases).detail ?? '', /ui test case/)
  })

  it('fails step names that do not start with Verify/Confirm that', () => {
    const facts = readSpecFacts(goodSource.replace('Confirm that sending', 'Click send and see'))
    assert.equal(stepNamesGate(facts).status, 'fail')
  })

  it('warns when a test case of the spec level is missing', () => {
    const facts = readSpecFacts(goodSource.replace(/test\(\n {2}'Verify that the contact form blocks[\s\S]*$/, ''))
    assert.equal(coverageWarnGate(uiFile, facts, testCases).status, 'warn')
  })

  it('reads the level from the file name', () => {
    assert.equal(levelFromSpecName('TOOL-1.x.api.spec.ts'), 'api')
    assert.equal(levelFromSpecName('TOOL-1.x.spec.ts'), undefined)
  })
})
