import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readSpecTests } from '../specs-validation/spec-source.ts'
import { loadEvalItems } from './dataset.ts'
import {
  assertionParityCheck,
  bugMarkingCheck,
  noDisabledTestsCheck,
  statusParityCheck,
  type SpecCheck,
} from './spec-checks.ts'
import type { SpecContext } from './spec-context.ts'

const item = loadEvalItems(process.cwd()).find(i => i.ticket === 'TOOL-2')
if (!item) throw new Error('TOOL-2 missing from the dataset')

const test = (id: string, body = '') => `test('title', { annotation: testCase('${id}') }, async () => {\n${body}\n})`

const contextFor = (source: string, overrides: Partial<SpecContext> = {}): SpecContext => {
  const tests = readSpecTests(source)
  return {
    item,
    level: 'api',
    workspace: '',
    specs: [{ file: 'tests/api/TOOL-2.x.api.spec.ts', source, tests }],
    tests,
    goldenSource: '',
    goldenTests: [],
    testCases: [],
    bugCaseIds: new Set(),
    ...overrides,
  }
}

const status = (check: SpecCheck, ctx: SpecContext) => check(ctx).status

describe('noDisabledTestsCheck', () => {
  it('passes for tests that all run', () => {
    assert.equal(status(noDisabledTestsCheck, contextFor(test('TC-1'))), 'pass')
  })

  for (const marker of ['test.skip', 'test.fixme', 'test.only', 'test.describe.skip']) {
    it(`fails on ${marker}`, () => {
      const result = noDisabledTestsCheck(contextFor(`${test('TC-1')}\n${marker}('x', () => {})`))
      assert.equal(result.status, 'fail')
      assert.match(result.detail ?? '', new RegExp(marker.replaceAll('.', '\\.')))
    })
  }

  it('does not mistake test.fail for a disabled test', () => {
    assert.equal(status(noDisabledTestsCheck, contextFor(test('TC-1', "test.fail(true, 'BUG: x')"))), 'pass')
  })
})

describe('bugMarkingCheck', () => {
  const bugs = new Set(['TC-2'])

  it('passes when test.fail is on the bug case only', () => {
    const source = `${test('TC-1')}\n${test('TC-2', "test.fail(true, 'BUG: x')")}`
    assert.equal(status(bugMarkingCheck, contextFor(source, { bugCaseIds: bugs })), 'pass')
  })

  it('fails when the bug case is not marked', () => {
    const result = bugMarkingCheck(contextFor(test('TC-2'), { bugCaseIds: bugs }))
    assert.equal(result.status, 'fail')
    assert.match(result.detail ?? '', /TC-2 hits a product bug/)
  })

  it('fails when a different case is masked with test.fail', () => {
    const source = `${test('TC-1', "test.fail(true, 'BUG: x')")}\n${test('TC-2', "test.fail(true, 'BUG: x')")}`
    const result = bugMarkingCheck(contextFor(source, { bugCaseIds: bugs }))
    assert.equal(result.status, 'fail')
    assert.match(result.detail ?? '', /TC-1 has no known product bug/)
  })
})

describe('statusParityCheck', () => {
  const goldenTests = readSpecTests(test('TC-1', 'expect(a).toBe(HttpStatus.CREATED)'))
  const against = (source: string) => contextFor(source, { goldenTests })

  it('passes when the golden statuses are asserted', () => {
    assert.equal(status(statusParityCheck, against(test('TC-1', 'expect(x).toBe(HttpStatus.CREATED)'))), 'pass')
  })

  it('fails when a status the golden asserts is missing', () => {
    const result = statusParityCheck(against(test('TC-1', 'expect(x).toBe(HttpStatus.OK)')))
    assert.equal(result.status, 'fail')
    assert.match(result.detail ?? '', /TC-1 never asserts HttpStatus\.CREATED/)
  })

  it('leaves cases the agent did not write to the coverage gate', () => {
    assert.equal(status(statusParityCheck, against('')), 'pass')
  })
})

describe('assertionParityCheck', () => {
  it('rejects output that drops a matcher required by the golden', () => {
    const goldenTests = readSpecTests(test('TC-1', "expect(a, 'a').toBe(x); expect(b, 'b').toMatchObject(y)"))
    const source = test('TC-1', "expect(a, 'a').toBe(x)")
    assert.equal(status(assertionParityCheck, contextFor(source, { goldenTests })), 'fail')
  })
})
