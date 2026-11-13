import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { DIRS } from '../../harness-config.ts'
import { testCaseFileSchema } from '../input-validation/input-schemas.ts'
import {
  coverageGate,
  manualStepNamesGate,
  noHardcodedTestDataGate,
  rawFixtureGate,
  stepNamesGate,
  traceGate,
} from './spec-gates.ts'
import { levelFromSpecName, readDisabledTestMarkers, readSpecTests } from './spec-source.ts'

const testCases = testCaseFileSchema.parse(JSON.parse(readFileSync(`${DIRS.testCases}/TOOL-1.json`, 'utf8')))
const uiFile = 'tests/ui/TOOL-1.contact.ui.spec.ts'
const goodSource = readFileSync(uiFile, 'utf8')
const read = (source: string) => readSpecTests(source)

describe('spec reader', () => {
  it('reads titles, annotations and steps per test', () => {
    const tests = read(goodSource)
    assert.deepEqual(tests.map(t => t.tcId), ['TC-3', 'TC-4'])
    assert.equal(tests.flatMap(t => t.stepTitles).length, 4)
    assert.ok(tests.flatMap(t => t.matchers).includes('toBeVisible'))
  })

  it('ignores test calls and annotations that only appear in comments or strings', () => {
    const tests = read(`// test('fake', { annotation: testCase('TC-9') }, async () => {})\nconst s = "test('x')"`)
    assert.deepEqual(tests, [])
  })

  it('keeps each annotation with its own test', () => {
    const tests = read(`
      test('b', { annotation: testCase('TC-2') }, async () => {})
      test('a', { tag: [], annotation: testCase('TC-1') }, async () => { test.fail(true, 'BUG') })
    `)
    assert.deepEqual(tests.map(t => [t.title, t.tcId, t.expectedFailure]), [['b', 'TC-2', false], ['a', 'TC-1', true]])
  })

  it('finds disabled-test markers', () => {
    assert.deepEqual(readDisabledTestMarkers(`test.skip('x', async () => {}); test.describe.only('y', () => {})`), ['test.skip', 'test.describe.only'])
  })

  it('reads the level from the file name', () => {
    assert.equal(levelFromSpecName('TOOL-1.x.api.spec.ts'), 'api')
    assert.equal(levelFromSpecName('TOOL-1.x.spec.ts'), undefined)
  })
})

describe('spec traceability gates', () => {
  it('accepts the reference UI spec', () => {
    const tests = read(goodSource)
    assert.equal(traceGate(uiFile, tests, testCases).status, 'pass')
    assert.equal(stepNamesGate(tests).status, 'pass')
  })

  it('fails an invented test title', () => {
    const tests = read(goodSource.replace('Verify that a visitor can send a message through the contact form', 'Sends a message'))
    assert.match(traceGate(uiFile, tests, testCases).detail ?? '', /not a test case title/)
  })

  it('fails a mismatched testCase annotation', () => {
    const tests = read(goodSource.replace("testCase('TC-3')", "testCase('TC-1')"))
    assert.match(traceGate(uiFile, tests, testCases).detail ?? '', /annotated TC-1/)
  })

  it('fails a missing testCase annotation', () => {
    const tests = read(goodSource.replace("annotation: testCase('TC-3')", 'tag: []'))
    assert.match(traceGate(uiFile, tests, testCases).detail ?? '', /no testCase\('TC-3'\) annotation/)
  })

  it('fails a UI test case placed in an API spec', () => {
    assert.match(traceGate('tests/api/TOOL-1.contact.api.spec.ts', read(goodSource), testCases).detail ?? '', /ui test case/)
  })

  it('fails step names that do not start with Verify/Confirm that', () => {
    assert.equal(stepNamesGate(read(goodSource.replace('Confirm that send the form', 'Click send and see'))).status, 'fail')
  })

  it('fails a test with no test.step', () => {
    assert.equal(stepNamesGate(read(`test('flat', async ({ contactPage }) => { await contactPage.open() })`)).status, 'fail')
  })

  it('fails a Playwright step that paraphrases the manual action', () => {
    const source = goodSource.replace('Confirm that send the form', 'Confirm that the form submits successfully')
    assert.equal(manualStepNamesGate(read(source), testCases).status, 'fail')
  })

  it('rejects raw Playwright fixtures including aliases', () => {
    const source = `test('raw', async ({ contactPage, page: browserPage }, testInfo) => { await browserPage.title(); testInfo.snapshotSuffix = '' })`
    assert.equal(rawFixtureGate(read(source)).status, 'fail')
    assert.equal(rawFixtureGate(read(`test('clean', async ({ contactPage }) => { await contactPage.open() })`)).status, 'pass')
  })

})

describe('spec coverage gate', () => {
  const allSpecs = [...read(goodSource), ...read(readFileSync('tests/api/TOOL-1.contact.api.spec.ts', 'utf8'))]

  it('accepts one test per manual test case across spec files', () => {
    assert.equal(coverageGate(allSpecs, testCases).status, 'pass')
  })

  it('fails when a test case has no test', () => {
    assert.match(coverageGate(allSpecs.slice(1), testCases).detail ?? '', /no test annotated for/)
  })

  it('fails when a test case has two tests', () => {
    assert.match(coverageGate([...allSpecs, ...allSpecs.slice(0, 1)], testCases).detail ?? '', /more than one test/)
  })
})

describe('test data gate', () => {
  it('allows fixture-exported data and rejects inline payload or expected values', () => {
    const clean = `test('title', async () => { expect(Data.actual, 'value').toBe(Data.expected) })`
    const hardcoded = `test('title', async () => { send({ email: 'inline@example.com' }); expect(result, 'result').toBe(0) })`
    assert.equal(noHardcodedTestDataGate([{ file: uiFile, source: clean }]).status, 'pass')
    assert.equal(noHardcodedTestDataGate([{ file: uiFile, source: hardcoded }]).status, 'fail')
  })

  it('leaves literals covered by focused static rules to those rules', () => {
    const source = `test('title', async ({ page }) => {
      await page.goto('/contact')
      await page.locator('#send').click()
      await new Promise(resolve => setTimeout(resolve, 1000))
      expect(response.status(), 'status').toBe(200)
    })`
    assert.equal(noHardcodedTestDataGate([{ file: uiFile, source }]).status, 'pass')
  })
})
