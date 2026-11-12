import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import type { GateResult } from '../../lib/gates/gateResults.ts'
import { testCaseFileSchema } from '../input-validation/input-schemas.ts'
import { readTestBlocks } from '../specs-validation/spec-source.ts'
import { loadEvalItems } from './dataset.ts'
import { bugMarkingCheck, coverageCheck, noDisabledTestsCheck, parityCheck, type SpecCheck } from './spec-checks.ts'
import type { SpecContext } from './spec-context.ts'

const item = loadEvalItems(process.cwd()).find(i => i.ticket === 'TOOL-2')
if (!item) throw new Error('TOOL-2 missing from the dataset')
const testCases = testCaseFileSchema.parse(JSON.parse(readFileSync(item.testCases, 'utf8'))).testCases.filter(tc => tc.level === 'api')

const test = (id: string, body = '') => `test('title', { annotation: testCase('${id}') }, async () => {\n${body}\n})`

const contextFor = (source: string, overrides: Partial<SpecContext> = {}): SpecContext => ({
  item,
  level: 'api',
  workspace: '',
  specFiles: [],
  source,
  blocks: readTestBlocks(source),
  goldenSource: '',
  goldenBlocks: new Map(),
  testCases,
  bugCaseIds: new Set(),
  ...overrides,
})

const run = (check: SpecCheck, ctx: SpecContext, gate: string): GateResult => {
  const result = check(ctx).find(r => r.gate === gate)
  assert.ok(result, `${gate} was not reported`)
  return result
}

const allCases = testCases.map(tc => test(tc.id)).join('\n')

describe('coverageCheck', () => {
  it('passes when every test case has exactly one test', () => {
    assert.equal(run(coverageCheck, contextFor(allCases), 'coverage').status, 'pass')
  })

  it('fails on a missing test case', () => {
    const [first] = testCases
    assert.ok(first)
    const result = run(coverageCheck, contextFor(test(first.id)), 'coverage')
    assert.equal(result.status, 'fail')
    assert.match(result.detail ?? '', /no test annotated for/)
  })

  it('fails when a test case is automated twice', () => {
    const [first] = testCases
    assert.ok(first)
    const result = run(coverageCheck, contextFor(`${allCases}\n${test(first.id)}`), 'coverage')
    assert.equal(result.status, 'fail')
    assert.match(result.detail ?? '', new RegExp(`more than one test annotated for ${first.id}`))
  })
})

describe('noDisabledTestsCheck', () => {
  it('passes for tests that all run', () => {
    assert.equal(run(noDisabledTestsCheck, contextFor(allCases), 'no-disabled-tests').status, 'pass')
  })

  for (const marker of ['test.skip', 'test.fixme', 'test.only', 'test.describe.skip']) {
    it(`fails on ${marker}`, () => {
      const result = run(noDisabledTestsCheck, contextFor(`${allCases}\n${marker}('x', () => {})`), 'no-disabled-tests')
      assert.equal(result.status, 'fail')
      assert.match(result.detail ?? '', new RegExp(marker.replaceAll('.', '\\.')))
    })
  }

  it('does not mistake test.fail for a disabled test', () => {
    const source = test('TC-1', "test.fail(true, 'BUG: x')")
    assert.equal(run(noDisabledTestsCheck, contextFor(source), 'no-disabled-tests').status, 'pass')
  })
})

describe('bugMarkingCheck', () => {
  const bugs = new Set(['TC-2'])

  it('passes when test.fail is on the bug case only', () => {
    const source = `${test('TC-1')}\n${test('TC-2', "test.fail(true, 'BUG: x')")}`
    assert.equal(run(bugMarkingCheck, contextFor(source, { bugCaseIds: bugs }), 'bug-marking').status, 'pass')
  })

  it('fails when the bug case is not marked', () => {
    const result = run(bugMarkingCheck, contextFor(test('TC-2'), { bugCaseIds: bugs }), 'bug-marking')
    assert.equal(result.status, 'fail')
    assert.match(result.detail ?? '', /TC-2 hits a product bug/)
  })

  it('fails when a different case is masked with test.fail', () => {
    const source = `${test('TC-1', "test.fail(true, 'BUG: x')")}\n${test('TC-2', "test.fail(true, 'BUG: x')")}`
    const result = run(bugMarkingCheck, contextFor(source, { bugCaseIds: bugs }), 'bug-marking')
    assert.equal(result.status, 'fail')
    assert.match(result.detail ?? '', /TC-1 has no known product bug/)
  })
})

describe('parityCheck', () => {
  const golden = test('TC-1', 'expect(a).toBe(HttpStatus.CREATED)\nexpect(b).toBe(1)')
  const against = (source: string) => contextFor(source, { goldenSource: golden, goldenBlocks: readTestBlocks(golden) })

  it('passes when statuses and assertion count match', () => {
    const ctx = against(test('TC-1', 'expect(x).toBe(HttpStatus.CREATED)\nexpect(y).toBe(2)'))
    assert.deepEqual(parityCheck(ctx).map(r => r.status), ['pass', 'pass'])
  })

  it('fails when a status the golden asserts is missing', () => {
    const result = run(parityCheck, against(test('TC-1', 'expect(x).toBe(HttpStatus.OK)\nexpect(y).toBe(2)')), 'parity:statuses')
    assert.equal(result.status, 'fail')
    assert.match(result.detail ?? '', /TC-1 never asserts HttpStatus\.CREATED/)
  })

  it('only warns when fewer assertions are made', () => {
    const result = run(parityCheck, against(test('TC-1', 'expect(x).toBe(HttpStatus.CREATED)')), 'parity:assertions')
    assert.equal(result.status, 'warn')
  })

  it('leaves cases the agent did not write to the coverage check', () => {
    assert.deepEqual(parityCheck(against('')).map(r => r.status), ['pass', 'pass'])
  })
})
